import 'dotenv/config';
import express from 'express';
import pg from 'pg';
import path from 'path';
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
app.use(express.json({limit:'5mb'}));
app.use(express.static(path.join(__dirname,'public')));

function clamp(n,a,b){ return Math.max(a,Math.min(b,n)); }
function vec(v){ return '[' + v.map(x=>Number(x).toFixed(8)).join(',') + ']'; }
function norm(v){ return Math.sqrt(v.reduce((s,x)=>s+x*x,0)); }
function tokenizeApprox(text){ return (text.match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu)||[]); }

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
  chunkSize=clamp(Number(chunkSize)||90,30,300);
  overlap=clamp(Number(overlap)||0,0,Math.max(0,chunkSize-1));
  const chunks=[]; let idx=0;
  for(const s of sectionsFromMarkdown(text)){
    const words=s.text.split(/\s+/).filter(Boolean);
    const stride=Math.max(1,chunkSize-overlap);
    for(let start=0;start<words.length;start+=stride){
      const part=words.slice(start,start+chunkSize);
      if(!part.length) break;
      chunks.push({chunk_index:idx++,section:s.section,content:part.join(' '),word_start:start,word_end:start+part.length});
      if(start+chunkSize>=words.length) break;
    }
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

app.post('/api/ingest', async (req,res)=>{
  try{
    const text=String(req.body.text||'').trim();
    const title=String(req.body.title||'documento.md').slice(0,180);
    if(text.length<20) return res.status(400).json({error:'El documento es demasiado corto.'});
    const chunkSize=clamp(Number(req.body.chunkSize)||90,30,300);
    const overlap=clamp(Number(req.body.overlap)||18,0,chunkSize-1);
    const chunks=chunkDocument(text,chunkSize,overlap);
    const embeddings=await embed(chunks.map(c=>c.content));
    const client=await pool.connect();
    let documentId;
    try{
      await client.query('begin');
      await client.query('delete from rag_documents where title=$1',[title]);
      const dr=await client.query('insert into rag_documents(title) values($1) returning id',[title]);
      documentId=dr.rows[0].id;
      for(let i=0;i<chunks.length;i++){
        const c=chunks[i];
        const metadata={source:title,section:c.section,chunk_id:'chunk_'+String(c.chunk_index+1).padStart(3,'0'),word_start:c.word_start,word_end:c.word_end};
        await client.query('insert into rag_chunks(document_id,chunk_index,section,content,embedding,metadata) values($1,$2,$3,$4,$5::vector,$6::jsonb)',[documentId,c.chunk_index,c.section,c.content,vec(embeddings[i]),JSON.stringify(metadata)]);
      }
      await client.query('commit');
    }catch(e){await client.query('rollback');throw e;}finally{client.release();}
    res.json({ok:true,documentId,title,chunkSize,overlap,tokenEstimate:tokenizeApprox(text).length,chunks:chunks.map((c,i)=>({chunkId:'chunk_'+String(c.chunk_index+1).padStart(3,'0'),section:c.section,content:c.content,wordStart:c.word_start,wordEnd:c.word_end,dimensions:embeddings[i].length,vectorSample:embeddings[i].slice(0,10),norm:norm(embeddings[i])}))});
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/analyze', async (req,res)=>{
  try{
    const question=String(req.body.question||'').trim();
    if(!question) return res.status(400).json({error:'Falta la pregunta.'});
    const topK=clamp(Number(req.body.topK)||5,1,12);
    const threshold=clamp(Number(req.body.threshold)||0.35,-1,1);
    const [qv]=await embed(question);
    const qr=await pool.query("select id,document_id,chunk_index,section,content,metadata,embedding::text as embedding_text,1-(embedding <=> $1::vector) as similarity from rag_chunks order by embedding <=> $1::vector limit $2",[vec(qv),topK]);
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

app.use((req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

initDb().then(()=>app.listen(PORT,'127.0.0.1',()=>console.log('RAG Engine Lab http://127.0.0.1:'+PORT))).catch(e=>{console.error(e);process.exit(1)});
