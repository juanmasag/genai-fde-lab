import fs from 'fs';
import pg from 'pg';

const base=process.env.RAG_LAB_URL||'http://127.0.0.1:4173';
const config=JSON.parse(fs.readFileSync(new URL('../data/validation-cases.json',import.meta.url),'utf8'));
const sourcePath=new URL('../'+config.source,import.meta.url);
const documentText=fs.readFileSync(sourcePath,'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

async function post(path,body){
  const response=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok)throw new Error(path+' '+response.status+' '+await response.text());
  return response.json();
}

function isAbstention(text){
  return /(no encontr|informaci[oó]n suficiente|no hay informaci[oó]n|no se (indica|especifica|menciona)|no figura|no est[aá] (indicado|especificado|disponible)|evidencia no alcanza)/i.test(String(text||''));
}

const ingest=await post('/api/ingest',{
  title:config.ingest.title,
  text:documentText,
  chunkSize:config.ingest.chunkSize,
  overlap:config.ingest.overlap
});

const results=[];
try{
  for(const testCase of config.cases){
    const analysis=await post('/api/analyze',{
      question:testCase.question,
      topK:config.analysis.topK,
      threshold:config.analysis.threshold,
      documentId:ingest.documentId
    });

    const accepted=analysis.retrieval.ranked.filter(row=>row.accepted);
    const answer=String(analysis.generation.text||'');
    assert(analysis.validation.citationsValid,testCase.id+': contiene citas inválidas');

    if(testCase.kind==='answer_present'){
      assert(accepted.length>0,testCase.id+': no recuperó evidencia');
      assert(!isAbstention(answer),testCase.id+': se abstuvo aunque la respuesta existe');
      for(const fragment of testCase.answerIncludes||[]){
        assert(answer.toLowerCase().includes(String(fragment).toLowerCase()),testCase.id+': falta fragmento esperado "'+fragment+'" en: '+answer);
      }
      if(testCase.requireCitation){
        assert(analysis.validation.citedIds.length>0,testCase.id+': respondió sin citar un chunk recuperado');
      }
    }else{
      assert(isAbstention(answer),testCase.id+': debía abstenerse, obtuvo: '+answer);
      if(testCase.requireAcceptedEvidence)assert(accepted.length>0,testCase.id+': debía recuperar evidencia relacionada antes de abstenerse');
      if(testCase.topContentIncludes){
        const topText=String(analysis.retrieval.ranked[0]?.content||'').toLowerCase();
        assert(topText.includes(String(testCase.topContentIncludes).toLowerCase()),testCase.id+': el primer resultado no fue la evidencia relacionada esperada');
      }
    }

    results.push({
      id:testCase.id,
      kind:testCase.kind,
      accepted:accepted.length,
      cited:analysis.validation.citedIds,
      topSimilarity:Number(analysis.retrieval.ranked[0]?.similarity||0),
      answer
    });
    console.log('PASS',testCase.id,'| accepted:',accepted.length,'| cited:',analysis.validation.citedIds.join(',')||'-');
  }

  const answerCount=results.filter(x=>x.kind==='answer_present').length;
  const noAnswerCount=results.filter(x=>x.kind==='no_answer').length;
  const relatedCount=results.filter(x=>x.kind==='related_insufficient').length;
  assert(answerCount===5,'dataset: se esperaban 5 casos con respuesta');
  assert(noAnswerCount===3,'dataset: se esperaban 3 casos sin respuesta');
  assert(relatedCount===1,'dataset: se esperaba 1 caso relacionado pero insuficiente');

  console.log('PASS LAB-01 validation dataset: 5 answer-present + 3 no-answer + 1 related-insufficient');
  console.log('PASS grounding/citations: no invalid citations');
}finally{
  const {Pool}=pg;
  const pool=new Pool({connectionString:process.env.DATABASE_URL||'postgresql://raglab:raglab@127.0.0.1:5433/raglab'});
  await pool.query('delete from rag_documents where title=$1',[config.ingest.title]);
  await pool.end();
  console.log('PASS cleanup validation document');
}
