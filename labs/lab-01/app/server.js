import 'dotenv/config';
import express from 'express';
import pg from 'pg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const EMBED_MODEL = process.env.EMBED_MODEL || 'nomic-embed-text';
const LLM_MODEL = process.env.LLM_MODEL || 'qwen3:8b';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://raglab:raglab@127.0.0.1:5433/raglab';
const pool = new Pool({connectionString:DATABASE_URL,ssl:process.env.PGSSL==='true'?{rejectUnauthorized:false}:false});
const app = express();
app.use((req,res,next)=>{
  if(req.path==='/' || req.path==='/index.html' || req.path==='/app.js' || req.path==='/styles.css' || req.path==='/sw.js'){
    res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma','no-cache');
    res.set('Expires','0');
  }
  next();
});
app.use(express.json({limit:'5mb'}));
const FRONTEND_DIR=path.join(__dirname,'dist');
app.use(express.static(FRONTEND_DIR,{etag:false,maxAge:0}));

function clamp(n,a,b){ return Math.max(a,Math.min(b,n)); }
function vec(v){ return '[' + v.map(x=>Number(x).toFixed(8)).join(',') + ']'; }
function norm(v){ return Math.sqrt(v.reduce((s,x)=>s+x*x,0)); }
const BERT_VOCAB_PATH=path.join(__dirname,'data','bert-base-uncased-vocab.txt');
const BERT_VOCAB=new Set(fs.readFileSync(BERT_VOCAB_PATH,'utf8').split(/\r?\n/).filter(Boolean));
function normalizeBertToken(s){ return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
function basicBertTokens(text){ return String(text).replace(/[\u0000\ufffd]/g,' ').match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu)||[]; }
function wordPieceTokenize(text){
  const out=[];
  for(const raw of basicBertTokens(text)){
    const token=normalizeBertToken(raw);
    if(BERT_VOCAB.has(token)){ out.push(token); continue; }
    if(token.length>100){ out.push('[UNK]'); continue; }
    let start=0,pieces=[],bad=false;
    while(start<token.length){
      let end=token.length,cur=null;
      while(start<end){
        const sub=(start>0?'##':'')+token.slice(start,end);
        if(BERT_VOCAB.has(sub)){ cur=sub; break; }
        end--;
      }
      if(cur===null){ bad=true; break; }
      pieces.push(cur); start=end;
    }
    out.push(...(bad?['[UNK]']:pieces));
  }
  return out;
}
function detokenizeWordPieces(tokens){
  let out='';
  for(const tok of tokens){
    if(tok.startsWith('##')) out+=tok.slice(2);
    else if(/^[.,!?;:%)\]}]$/.test(tok)) out+=tok;
    else if(/^[([{¿¡]$/.test(tok)) out+=(out?' ':'')+tok;
    else out+=(out?' ':'')+tok;
  }
  return out.replace(/\s+([.,!?;:%)\]}])/g,'$1').replace(/([([{¿¡])\s+/g,'$1');
}
function tokenizeApprox(text){ return wordPieceTokenize(text); }

async function initDb(){
  await pool.query('create extension if not exists vector');
  await pool.query("create table if not exists rag_documents (id bigserial primary key,title text not null,created_at timestamptz not null default now())");
  await pool.query("create table if not exists rag_chunks (id bigserial primary key,document_id bigint not null references rag_documents(id) on delete cascade,chunk_index integer not null,section text not null,content text not null,embedding vector(768) not null,metadata jsonb not null default '{}'::jsonb)");
  await pool.query('create index if not exists rag_chunks_document_idx on rag_chunks(document_id)');
}

function sectionsFromMarkdown(text){
  let section='Documento', body=[];
  const sections=[];
  const flush=()=>{ if(body.join(' ').trim()) sections.push({section,text:body.join(' ').trim()}); body=[]; };
  for(const raw of text.split(/\r?\n/)){
    const line=raw.trim();
    if(!line) continue;
    if(/^#{1,6}\s+/.test(line)){ flush(); section=line.replace(/^#{1,6}\s+/,'').trim(); }
    else body.push(line);
  }
  flush();
  return sections.length?sections:[{section:'Documento',text:text.trim()}];
}

function chunkDocument(text,chunkSize=90,overlap=18){
  const sections=sectionsFromMarkdown(text);
  const stream=[];
  for(const sec of sections){
    const toks=wordPieceTokenize(sec.text);
    for(const tok of toks) stream.push({token:tok,section:sec.section});
  }
  const totalTokens=stream.length;
  if(!totalTokens) return [];
  chunkSize=clamp(Number(chunkSize)||Math.min(90,totalTokens),1,totalTokens);
  overlap=clamp(Number(overlap)||0,0,Math.max(0,chunkSize-1));
  const stride=Math.max(1,chunkSize-overlap);
  const chunks=[]; let idx=0;
  for(let start=0;start<totalTokens;start+=stride){
    const slice=stream.slice(start,start+chunkSize);
    if(!slice.length) break;
    const tokens=slice.map(x=>x.token);
    const sectionNames=[];
    for(const x of slice) if(sectionNames[sectionNames.length-1]!==x.section) sectionNames.push(x.section);
    const section=sectionNames.length===1?sectionNames[0]:sectionNames.join(' → ');
    const hasPrevious=start>0;
    const hasNext=start+chunkSize<totalTokens;
    chunks.push({
      chunk_index:idx++,section,sections:sectionNames,content:detokenizeWordPieces(tokens),tokens,
      token_start:start,token_end:start+tokens.length,
      overlap_from_previous:hasPrevious?Math.min(overlap,tokens.length):0,
      overlap_to_next:hasNext?Math.min(overlap,tokens.length):0
    });
    if(!hasNext) break;
  }
  return chunks;
}

async function embed(input){
  const r=await fetch(OLLAMA_URL+'/api/embed',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:EMBED_MODEL,input,truncate:true})});
  if(!r.ok) throw new Error('Embedding model: '+r.status+' '+await r.text());
  const j=await r.json();
  return j.embeddings;
}

async function chat(prompt){
  const r=await fetch(OLLAMA_URL+'/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:LLM_MODEL,stream:false,think:false,messages:[{role:'system',content:'Sos un asistente de análisis documental. Respondé sólo con la evidencia provista. Si la evidencia no alcanza, decilo explícitamente. No agregues conocimiento externo. Cada afirmación factual debe terminar con el chunk_id correspondiente entre corchetes, por ejemplo [chunk_001].'},{role:'user',content:prompt}],options:{temperature:0.1}})});
  if(!r.ok) throw new Error('LLM: '+r.status+' '+await r.text());
  const j=await r.json();
  return {text:j.message?.content||'',prompt_eval_count:j.prompt_eval_count||null,eval_count:j.eval_count||null,total_duration:j.total_duration||null};
}

app.get('/api/health', async (req,res)=>{
  try{
    const db=await pool.query('select count(*)::int as chunks from rag_chunks');
    const models=await fetch(OLLAMA_URL+'/api/tags').then(r=>r.json());
    res.json({ok:true,database:true,chunks:db.rows[0].chunks,embedModel:EMBED_MODEL,llmModel:LLM_MODEL,models:(models.models||[]).map(x=>x.name)});
  }catch(e){res.status(500).json({ok:false,error:e.message});}
});

app.post('/api/chunk-preview',(req,res)=>{
  try{
    const text=String(req.body.text||'').trim();
    const totalTokens=wordPieceTokenize(sectionsFromMarkdown(text).map(s=>s.text).join(' ')).length;
    const chunkSize=clamp(Number(req.body.chunkSize)||Math.min(90,totalTokens||1),1,Math.max(1,totalTokens));
    const overlap=clamp(Number(req.body.overlap)||0,0,Math.max(0,chunkSize-1));
    const chunks=chunkDocument(text,chunkSize,overlap);
    res.json({ok:true,chunkSize,overlap,tokenCount:totalTokens,tokenizer:'BERT WordPiece usado por el laboratorio' ,chunks:chunks.map(c=>({chunkId:'chunk_'+String(c.chunk_index+1).padStart(3,'0'),section:c.section,content:c.content,tokens:c.tokens,tokenStart:c.token_start,tokenEnd:c.token_end,overlapFromPrevious:c.overlap_from_previous,overlapToNext:c.overlap_to_next}))});
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/ingest', async (req,res)=>{
  try{
    const text=String(req.body.text||'').trim();
    const title=String(req.body.title||'documento.md').slice(0,180);
    if(text.length<20) return res.status(400).json({error:'El documento es demasiado corto.'});
    const totalTokens=wordPieceTokenize(sectionsFromMarkdown(text).map(s=>s.text).join(' ')).length;
    const chunkSize=clamp(Number(req.body.chunkSize)||Math.min(90,totalTokens||1),1,Math.max(1,totalTokens));
    const overlap=clamp(Number(req.body.overlap)||0,0,Math.max(0,chunkSize-1));
    const chunks=chunkDocument(text,chunkSize,overlap);
    const embeddings=await embed(chunks.map(c=>c.content));
    const client=await pool.connect();
    let documentId;
    const dbEvents=[];
    try{
      await client.query('begin');
      dbEvents.push({type:'transaction_begin',label:'BEGIN transaction'});
      const deleted=await client.query('delete from rag_documents where title=$1 returning id',[title]);
      if(deleted.rowCount) dbEvents.push({type:'replace_document',label:'Documento anterior reemplazado',rows:deleted.rowCount});
      const dr=await client.query('insert into rag_documents(title) values($1) returning id',[title]);
      documentId=dr.rows[0].id;
      dbEvents.push({type:'insert_document',label:'Documento insertado',documentId});
      for(let i=0;i<chunks.length;i++){
        const c=chunks[i];
        const chunkId='chunk_'+String(c.chunk_index+1).padStart(3,'0');
        const metadata={source:title,section:c.section,chunk_id:chunkId,token_start:c.token_start,token_end:c.token_end,token_count:c.tokens.length,overlap_from_previous:c.overlap_from_previous,overlap_to_next:c.overlap_to_next,sections:c.sections};
        const ir=await client.query('insert into rag_chunks(document_id,chunk_index,section,content,embedding,metadata) values($1,$2,$3,$4,$5::vector,$6::jsonb) returning id',[documentId,c.chunk_index,c.section,c.content,vec(embeddings[i]),JSON.stringify(metadata)]);
        dbEvents.push({type:'insert_chunk',label:'Chunk + embedding insertados en pgvector',chunkId,rowId:ir.rows[0].id,dimensions:embeddings[i].length,section:c.section});
      }
      await client.query('commit');
      dbEvents.push({type:'transaction_commit',label:'COMMIT confirmado'});
    }catch(e){await client.query('rollback');dbEvents.push({type:'transaction_rollback',label:'ROLLBACK'});throw e;}finally{client.release();}
    const stored=await pool.query('select count(*)::int as rows from rag_chunks where document_id=$1',[documentId]);
    res.json({ok:true,documentId,title,chunkSize,overlap,tokenEstimate:totalTokens,tokenizer:'BERT WordPiece usado por el laboratorio' ,dbEvents,storedRows:stored.rows[0].rows,chunks:chunks.map((c,i)=>({chunkId:'chunk_'+String(c.chunk_index+1).padStart(3,'0'),section:c.section,content:c.content,tokens:c.tokens,tokenStart:c.token_start,tokenEnd:c.token_end,overlapFromPrevious:c.overlap_from_previous,overlapToNext:c.overlap_to_next,dimensions:embeddings[i].length,vectorSample:embeddings[i].slice(0,10),norm:norm(embeddings[i])}))});
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/analyze', async (req,res)=>{
  try{
    const question=String(req.body.question||'').trim();
    if(!question) return res.status(400).json({error:'Falta la pregunta.'});
    const topK=clamp(Number(req.body.topK)||5,1,12);
    const threshold=clamp(Number(req.body.threshold)||0.35,-1,1);
    const documentId=req.body.documentId?Number(req.body.documentId):null;
    const [qv]=await embed(question);
    const qr=documentId
      ? await pool.query("select id,document_id,chunk_index,section,content,metadata,embedding::text as embedding_text,1-(embedding <=> $1::vector) as similarity from rag_chunks where document_id=$3 order by embedding <=> $1::vector limit $2",[vec(qv),topK,documentId])
      : await pool.query("select id,document_id,chunk_index,section,content,metadata,embedding::text as embedding_text,1-(embedding <=> $1::vector) as similarity from rag_chunks order by embedding <=> $1::vector limit $2",[vec(qv),topK]);
    const ranked=qr.rows.map((r,i)=>{const similarity=Number(r.similarity);const ev=String(r.embedding_text||'').replace(/[\[\]]/g,'').split(',').filter(Boolean).map(Number);delete r.embedding_text;return {...r,rank:i+1,similarity,angleDeg:Math.acos(clamp(similarity,-1,1))*180/Math.PI,accepted:similarity>=threshold,vectorSample:ev.slice(0,12),dimensions:ev.length};});
    const accepted=ranked.filter(r=>r.accepted);
    const context=accepted.map(r=>'['+(r.metadata?.chunk_id||r.id)+' | '+(r.metadata?.source||'documento')+' | '+r.section+']\n'+r.content).join('\n\n');
    const prompt='EVIDENCIA RECUPERADA:\n'+(context||'(ninguna evidencia superó el threshold)')+'\n\nPREGUNTA:\n'+question+'\n\nREGLAS:\n- Usá únicamente la evidencia.\n- Si no alcanza, indicá que no encontraste información suficiente.\n- No inventes datos.\n- Citá cada afirmación factual usando el chunk_id exacto entre corchetes.';
    let generation;
    if(!accepted.length) generation={text:'No encontré información suficiente en los documentos disponibles.',prompt_eval_count:0,eval_count:0,total_duration:0};
    else generation=await chat(prompt);
    const citedIds=[...generation.text.matchAll(/\[(chunk_\d+)\]/g)].map(m=>m[1]);
    const allowedIds=new Set(accepted.map(r=>r.metadata?.chunk_id).filter(Boolean));
    const invalidIds=citedIds.filter(id=>!allowedIds.has(id));
    const validation={evidenceAvailable:accepted.length>0,citedIds,invalidIds,citationsValid:invalidIds.length===0};
    if(invalidIds.length) generation.text='Respuesta rechazada por validación: el modelo citó una fuente que no fue recuperada.';
    res.json({ok:true,models:{embedding:EMBED_MODEL,llm:LLM_MODEL},question,questionTokens:tokenizeApprox(question),questionVector:{dimensions:qv.length,sample:qv.slice(0,12),norm:norm(qv)},retrieval:{topK,threshold,ranked},context,prompt,generation,validation,citations:accepted.map(r=>({chunkId:r.metadata?.chunk_id||String(r.id),source:r.metadata?.source||'documento',section:r.section,similarity:r.similarity,content:r.content}))});
  }catch(e){res.status(500).json({error:e.message});}
});

app.get('/api/chunks',async(req,res)=>{
  try{const r=await pool.query('select c.id,c.document_id,c.chunk_index,c.section,c.content,c.metadata,d.title from rag_chunks c join rag_documents d on d.id=c.document_id order by c.id desc limit 100');res.json(r.rows);}catch(e){res.status(500).json({error:e.message});}
});

app.get('/api/db-browser', async (req,res)=>{
  try{
    const requested=req.query.documentId?Number(req.query.documentId):null;
    const docs=await pool.query(`
      select d.id,d.title,d.created_at,count(c.id)::int as chunk_count
      from rag_documents d
      left join rag_chunks c on c.document_id=d.id
      group by d.id,d.title,d.created_at
      order by d.id desc
      limit 50`);
    const documentId=requested || docs.rows[0]?.id || null;
    if(!documentId) return res.json({ok:true,documents:[],documentId:null,rows:[]});
    const rows=await pool.query(`
      select c.id,c.document_id,c.chunk_index,c.section,c.content,c.metadata,
             vector_dims(c.embedding) as dimensions,
             c.embedding::text as embedding_text,
             d.title
      from rag_chunks c
      join rag_documents d on d.id=c.document_id
      where c.document_id=$1
      order by c.chunk_index,c.id`,[documentId]);
    res.json({ok:true,documents:docs.rows,documentId,rows:rows.rows.map(r=>{
      const vector=String(r.embedding_text||'').replace(/[\[\]]/g,'').split(',').filter(Boolean).map(Number);
      delete r.embedding_text;
      return {...r,dimensions:Number(r.dimensions),vectorSample:vector.slice(0,12)};
    })});
  }catch(e){res.status(500).json({error:e.message});}
});

app.get('/api/db-browser/chunk/:id', async (req,res)=>{
  try{
    const id=Number(req.params.id);
    const r=await pool.query(`
      select c.id,c.document_id,c.chunk_index,c.section,c.content,c.metadata,
             vector_dims(c.embedding) as dimensions,c.embedding::text as embedding_text,d.title,d.created_at
      from rag_chunks c
      join rag_documents d on d.id=c.document_id
      where c.id=$1`,[id]);
    if(!r.rowCount) return res.status(404).json({error:'Chunk no encontrado'});
    const row=r.rows[0];
    const vector=String(row.embedding_text||'').replace(/[\[\]]/g,'').split(',').filter(Boolean).map(Number);
    delete row.embedding_text;
    res.json({ok:true,row:{...row,dimensions:Number(row.dimensions),vector}});
  }catch(e){res.status(500).json({error:e.message});}
});

app.use((req,res)=>res.sendFile(path.join(FRONTEND_DIR,'index.html')));

initDb().then(()=>app.listen(PORT,'127.0.0.1',()=>console.log('RAG Engine Lab http://127.0.0.1:'+PORT))).catch(e=>{console.error(e);process.exit(1)});
