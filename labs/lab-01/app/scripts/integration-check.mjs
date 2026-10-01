import pg from 'pg';
const base=process.env.RAG_LAB_URL||'http://127.0.0.1:4173';
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
async function post(path,body){const r=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw new Error(path+' '+r.status+' '+await r.text());return r.json()}
async function get(path){const r=await fetch(base+path,{cache:'no-store'});if(!r.ok)throw new Error(path+' '+r.status);return r.json()}
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
const health=await get('/api/health');
console.log('PASS chunk preview == ingest:',preview.chunks.length,'chunks');
console.log('PASS overlap exacto entre límites');
console.log('PASS metadata pgvector:',db.rows.length,'filas');
console.log('PASS retrieval acotado al documento:',ingest.documentId);
console.log('PASS modelos:',health.embedModel,'+',health.llmModel);

const {Pool}=pg;
const pool=new Pool({connectionString:process.env.DATABASE_URL||'postgresql://raglab:raglab@127.0.0.1:5433/raglab'});
await pool.query("delete from rag_documents where title='integration-audit.md'");
await pool.end();
console.log('PASS cleanup audit document');
