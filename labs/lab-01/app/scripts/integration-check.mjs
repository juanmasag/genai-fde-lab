import pg from 'pg';
const base=process.env.RAG_LAB_URL||'http://127.0.0.1:4173';
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
async function post(path,body){const r=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw new Error(path+' '+r.status+' '+await r.text());return r.json()}
async function get(path){const r=await fetch(base+path,{cache:'no-store'});if(!r.ok)throw new Error(path+' '+r.status);return r.json()}
async function streamPost(path,body){
  const r=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok)throw new Error(path+' '+r.status+' '+await r.text());
  const lines=(await r.text()).trim().split(/\n/).filter(Boolean).map(JSON.parse);
  const error=lines.find(x=>x.type==='error');
  if(error)throw new Error(path+' '+error.error);
  const result=lines.find(x=>x.type==='result')?.result;
  assert(result,path+': falta result');
  return {events:lines,result};
}
const words=['usuario','acceso','sistema','soporte','contraseña','permiso','solicitud','responsable','tiempo','portal'];
const text='# Auditoría\n'+Array.from({length:9},()=>words.join(' ')).join(' ');
const params={text,chunkSize:30,overlap:5};
const preview=await post('/api/chunk-preview',params);
const ingest=await post('/api/ingest',{...params,title:'integration-audit.md'});
assert(preview.chunks.length===ingest.chunks.length,'preview/ingest: distinta cantidad de chunks');
for(let i=0;i<preview.chunks.length;i++){
  const a=preview.chunks[i],b=ingest.chunks[i];
  assert(JSON.stringify(a.tokens)===JSON.stringify(b.tokens),'preview/ingest: tokens distintos en '+a.chunkId);
  assert(a.overlapToNext===b.overlapToNext,'preview/ingest: overlap distinto en '+a.chunkId);
  if(i<preview.chunks.length-1&&a.section===preview.chunks[i+1].section&&a.overlapToNext){
    const n=a.overlapToNext;
    assert(JSON.stringify(a.tokens.slice(-n))===JSON.stringify(preview.chunks[i+1].tokens.slice(0,n)),'overlap real no coincide en '+a.chunkId);
  }
}
const db=await get('/api/db-browser?documentId='+ingest.documentId);
assert(db.rows.length===ingest.storedRows,'pgvector: cantidad de filas distinta');
for(let i=0;i<db.rows.length;i++){
  const md=db.rows[i].metadata,c=ingest.chunks[i];
  assert(md.token_count===c.tokens.length,'metadata token_count incorrecta');
  assert(md.overlap_to_next===c.overlapToNext,'metadata overlap_to_next incorrecta');
  assert(md.overlap_from_previous===c.overlapFromPrevious,'metadata overlap_from_previous incorrecta');
}
const scoped=await post('/api/analyze',{question:'acceso soporte',topK:3,threshold:1,documentId:ingest.documentId});
assert(scoped.retrieval.ranked.every(x=>String(x.document_id)===String(ingest.documentId)),'retrieval salió del documento activo');

const streamedIngest=await streamPost('/api/ingest-stream',{...params,title:'integration-audit.md'});
const ingestPhases=streamedIngest.events.filter(x=>x.type==='progress').map(x=>x.phase);
for(const phase of ['chunking','embedding','embedding_done','db_begin','db_document','db_insert','db_commit']){
  assert(ingestPhases.includes(phase),'stream ingest: falta '+phase);
}
const streamedAnalysis=await streamPost('/api/analyze-stream',{question:'consulta sin coincidencia exacta',topK:3,threshold:1,documentId:streamedIngest.result.documentId});
const analysisPhases=streamedAnalysis.events.filter(x=>x.type==='progress').map(x=>x.phase);
for(const phase of ['question_embedding','question_embedding_done','vector_search','retrieval','context','validation']){
  assert(analysisPhases.includes(phase),'stream analyze: falta '+phase);
}
assert(analysisPhases.includes('abstention')||analysisPhases.includes('llm'),'stream analyze: falta decisión LLM/abstención');

const health=await get('/api/health');
console.log('PASS chunk preview == ingest:',preview.chunks.length,'chunks');
console.log('PASS overlap exacto entre límites');
console.log('PASS metadata pgvector:',db.rows.length,'filas');
console.log('PASS retrieval acotado al documento:',ingest.documentId);
console.log('PASS modelos:',health.embedModel,'+',health.llmModel);
console.log('PASS ingest stream phases:',ingestPhases.join(' → '));
console.log('PASS analyze stream phases:',analysisPhases.join(' → '));

const {Pool}=pg;
const pool=new Pool({connectionString:process.env.DATABASE_URL||'postgresql://raglab:raglab@127.0.0.1:5433/raglab'});
await pool.query("delete from rag_documents where title='integration-audit.md'");
await pool.end();
console.log('PASS cleanup audit document');
