import './styles.css';
import { animate } from 'motion';
import * as d3 from 'd3';
import { assign, createActor, createMachine } from 'xstate';
import { createIcons, FileText, Scissors, BrainCircuit, Binary, Database, Search, PackageOpen, Bot, Quote } from 'lucide';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const EXAMPLE_DOC=$('#document').value;
const state={ingest:null,analysis:null,activeDocumentId:null,preview:null,tab:'chunks',stage:0,guide:0,playTimer:null,dbTimer:null,mobileStep:0,attentionToken:0,transformerSubstep:0};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const fmt=n=>Number(n).toFixed(3);
const tokenize=text=>(String(text).match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu)||[]);

async function api(url,body){
  const r=await fetch(url,{method:body?'POST':'GET',headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
  const j=await r.json().catch(()=>({error:'Respuesta inválida'}));
  if(!r.ok) throw new Error(j.error||('HTTP '+r.status));
  return j;
}
function setBusy(btn,on,label){btn.disabled=on;if(on){btn.dataset.old=btn.textContent;btn.textContent=label;}else if(btn.dataset.old)btn.textContent=btn.dataset.old;}

async function health(){
  try{const h=await api('/api/health');$('#health').className='pill ok';$('#health').textContent='● DB '+h.chunks+' chunks · '+h.embedModel+' · '+h.llmModel;}
  catch(e){$('#health').className='pill bad';$('#health').textContent='● Sistema no disponible';}
}

function parseSections(text){
  let section='Documento',body=[],out=[];
  const flush=()=>{if(body.length){out.push({section,text:body.join(' ')});body=[];}};
  for(const raw of text.split(/\r?\n/)){const line=raw.trim();if(!line)continue;if(/^#{1,6}\s+/.test(line)){flush();section=line.replace(/^#{1,6}\s+/,'');}else body.push(line);}
  flush();return out;
}
let previewSeq=0;
function syncChunkControlLimits(totalTokens=null){
  const chunk=$('#chunkSize'),overlap=$('#overlap');
  if(totalTokens!==null){
    const max=Math.max(1,Number(totalTokens)||1);
    chunk.max=String(max);chunk.min='1';
    if(Number(chunk.value)>max)chunk.value=String(max);
    $('#chunkMaxInfo').textContent='máx. '+max+' tokens del documento';
  }
  const chunkValue=Math.max(1,Number(chunk.value)||1);
  const overlapMax=Math.max(0,chunkValue-1);
  overlap.max=String(overlapMax);overlap.min='0';overlap.disabled=false;
  if(Number(overlap.value)>overlapMax)overlap.value=String(overlapMax);
  $('#chunkSizeOut').textContent=String(chunkValue);
  $('#overlapOut').textContent=String(Number(overlap.value)||0);
  $('#overlapMaxInfo').textContent='máx. '+overlapMax+' tokens';
}
async function previewChunking(){
  const seq=++previewSeq;
  const box=$('#chunkPreview');
  box.innerHTML='<div class="empty-state">Calculando tokens del modelo…</div>';
  try{
    const data=await api('/api/chunk-preview',{text:$('#document').value,chunkSize:+$('#chunkSize').value,overlap:+$('#overlap').value});
    if(seq!==previewSeq)return [];
    const tokenStat=$('#tokenStat');if(tokenStat)tokenStat.textContent=data.tokenCount+' tokens WordPiece';
    $('#chunkSize').value=String(data.chunkSize);$('#overlap').value=String(data.overlap);
    syncChunkControlLimits(data.tokenCount);
    const chunks=data.chunks||[];
    state.preview=data;
    renderIngestionScene(ingestionSceneActor?.getSnapshot()?.value||'document');
    const tokenHtml=(c,chunkIndex)=>(c.tokens||[]).map((tok,i)=>{
      const repeatsInNext=c.overlapToNext>0 && i>=Math.max(0,c.tokens.length-c.overlapToNext);
      const repeatedFromPrevious=c.overlapFromPrevious>0 && i<c.overlapFromPrevious;
      const cls=repeatsInNext?'overlap-token overlap-to-next':(repeatedFromPrevious?'overlap-token overlap-from-previous':'');
      const title=repeatsInNext&&chunks[chunkIndex+1]?'Se repite en '+chunks[chunkIndex+1].chunkId:(repeatedFromPrevious&&chunks[chunkIndex-1]?'Repetido desde '+chunks[chunkIndex-1].chunkId:'');
      return '<span class="chunk-token '+cls+'" title="'+esc(title)+'">'+esc(tok)+'</span>';
    }).join('');
    const hasRealOverlap=chunks.some(c=>c.overlapToNext>0);
    let overlapStatus='';
    if(chunks.length===1) overlapStatus='<p class="no-overlap-note"><b>1 solo chunk.</b> Overlap configurado: '+data.overlap+' tokens. El control sigue disponible, pero no tiene efecto hasta que el documento se divida en 2 o más chunks.</p>';
    else if(data.overlap===0) overlapStatus='<p class="no-overlap-note">Overlap = 0: hay varios chunks, pero ningún token se repite entre ellos.</p>';
    else if(!hasRealOverlap) overlapStatus='<p class="no-overlap-note">No hay un límite de chunk donde aplicar overlap con esta configuración.</p>';
    box.innerHTML=overlapStatus+chunks.map((c,idx)=>{
      const next=chunks[idx+1];
      const overlapNote=c.overlapToNext>0&&next?'<div class="chunk-overlap-note"><span></span>'+c.overlapToNext+' tokens en verde se repiten en '+esc(next.chunkId)+'</div>':'';
      return '<div class="data-card preview-card"><strong>'+esc(c.chunkId)+' · '+esc(c.section)+'</strong><div class="chunk-token-stream">'+tokenHtml(c,idx)+'</div>'+overlapNote+'<small>tokens '+c.tokenStart+'–'+(Math.max(c.tokenStart,c.tokenEnd-1))+' · '+c.tokens.length+' tokens</small></div>';
    }).join('');
    return chunks;
  }catch(e){
    if(seq===previewSeq)box.innerHTML='<div class="empty-state">No se pudo calcular la previsualización: '+esc(e.message)+'</div>';
    return [];
  }
}
function updateDocStats(){
  const t=$('#document').value,sections=parseSections(t);
  $('#docStats').innerHTML='<span>'+t.length+' caracteres</span><span>'+t.split(/\s+/).filter(Boolean).length+' palabras</span><span id="tokenStat">calculando tokens…</span><span>'+sections.length+' secciones</span>';
  populateTransformerSentences();
  previewChunking();
}

function wireRanges(){
  const chunk=$('#chunkSize'),overlap=$('#overlap');
  chunk.addEventListener('input',()=>{syncChunkControlLimits();previewChunking();});
  overlap.addEventListener('input',()=>{$('#overlapOut').textContent=String(Number(overlap.value));previewChunking();});
  [['topK','topKOut',0],['threshold','thresholdOut',2]].forEach(([id,out,d])=>{const e=$('#'+id),o=$('#'+out),f=()=>o.textContent=Number(e.value).toFixed(d);e.addEventListener('input',f);f();});
  syncChunkControlLimits();
}

$('#file').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;$('#title').value=f.name;$('#document').value=await f.text();updateDocStats();});
$('#restoreDoc').addEventListener('click',()=>{$('#title').value='guia-soporte.md';$('#document').value=EXAMPLE_DOC;updateDocStats();});
$('#document').addEventListener('input',updateDocStats);
$('#previewChunks').addEventListener('click',previewChunking);

async function runIngest(btn,status,stayOnDb=false){
  try{
    setBusy(btn,true,'Ejecutando proceso real…');status.className='status-line';status.textContent='Chunking → embeddings → BEGIN → INSERT → COMMIT…';
    if(stayOnDb) document.querySelector('#step-db')?.scrollIntoView({behavior:'smooth',block:'start'});
    state.ingest=await api('/api/ingest',{title:$('#title').value,text:$('#document').value,chunkSize:+$('#chunkSize').value,overlap:+$('#overlap').value});
    state.activeDocumentId=state.ingest.documentId;
    status.className='status-line ok';status.textContent='✓ '+state.ingest.storedRows+' filas confirmadas en pgvector · '+state.ingest.chunks[0]?.dimensions+'D';
    populateTransformerSentences();replayDbEvents();renderAll();health();setGuide(4);
    if(stayOnDb) setTimeout(()=>document.querySelector('#step-db')?.scrollIntoView({behavior:'smooth',block:'start'}),80);
  }catch(e){status.className='status-line bad';status.textContent='Error: '+e.message;}
  finally{setBusy(btn,false);}
}
$('#ingest').addEventListener('click',()=>runIngest($('#ingest'),$('#ingestStatus'),false));
$('#ingestHere').addEventListener('click',()=>runIngest($('#ingestHere'),$('#ingestHereStatus'),true));

$('#analyze').addEventListener('click',async()=>{
  const btn=$('#analyze'),status=$('#analysisStatus');
  try{
    setBusy(btn,true,'Embedding → búsqueda → LLM…');status.className='status-line';status.textContent='Calculando embedding de pregunta y comparando contra pgvector…';
    state.analysis=await api('/api/analyze',{question:$('#question').value,topK:+$('#topK').value,threshold:+$('#threshold').value,documentId:state.ingest?.documentId||state.activeDocumentId||null});
    status.className='status-line ok';status.textContent='✓ '+state.analysis.retrieval.ranked.length+' candidatos · '+state.analysis.citations.length+' aceptados';
    state.stage=5;renderAll();setGuide(6);
  }catch(e){status.className='status-line bad';status.textContent='Error: '+e.message;}
  finally{setBusy(btn,false);}
});
$$('.quick-tests button').forEach(b=>b.addEventListener('click',()=>{$('#question').value=b.dataset.q;}));


const ingestionSceneMachine=createMachine({
  id:'ingestionLearningScene',
  initial:'document',
  states:{
    document:{on:{NEXT:'tokens',TOKENS:'tokens',CHUNKS:'chunks'}},
    tokens:{on:{PREV:'document',NEXT:'chunks',DOCUMENT:'document',CHUNKS:'chunks'}},
    chunks:{on:{PREV:'tokens',DOCUMENT:'document',TOKENS:'tokens'}}
  }
});
let ingestionSceneActor=null;

function previewGlobalTokens(){
  const chunks=state.preview?.chunks||[];
  const byIndex=new Map();
  chunks.forEach(c=>(c.tokens||[]).forEach((token,i)=>{
    const globalIndex=Number(c.tokenStart||0)+i;
    if(!byIndex.has(globalIndex))byIndex.set(globalIndex,token);
  }));
  return [...byIndex.entries()].sort((a,b)=>a[0]-b[0]).map(([index,token])=>({index,token}));
}

function sceneDocumentHtml(){
  const tokenCount=state.preview?.tokenCount??'…';
  const chars=$('#document').value.length;
  const lines=Array.from({length:8},()=>'<span></span>').join('');
  return '<div class="scene-stage scene-stage-document"><div class="scene-stage-head"><h3>1. El documento es la entrada</h3><p>Todavía no hay chunks. Primero observamos la fuente que va a procesar el pipeline.</p></div><div class="scene-document-wrap"><div class="scene-document-card"><header><i data-lucide="file-text"></i><strong>'+esc($('#title').value||'documento')+'</strong></header><div class="scene-document-lines">'+lines+'</div></div></div><div class="scene-metrics"><span class="scene-metric">'+chars+' caracteres</span><span class="scene-metric">'+tokenCount+' tokens del tokenizer del laboratorio</span></div></div>';
}

function sceneTokensHtml(){
  const tokens=previewGlobalTokens();
  if(!tokens.length)return '<div class="scene-empty">Calculando tokens reales del documento…</div>';
  const shown=tokens.slice(0,180),extra=tokens.length-shown.length;
  const tokenHtml=shown.map(t=>'<span class="scene-token"><small class="scene-token-index">'+t.index+'</small>'+esc(t.token)+'</span>').join('');
  return '<div class="scene-stage scene-stage-tokens"><div class="scene-stage-head"><h3>2. El texto se convierte en una secuencia de tokens</h3><p>Cada bloque representa un token devuelto por el mismo tokenizer que usa el preview de chunking. El número indica su posición global.</p></div><div class="scene-token-cloud">'+tokenHtml+'</div><div class="scene-metrics"><span class="scene-metric">'+tokens.length+' tokens totales</span>'+(extra>0?'<span class="scene-metric">se muestran 180 · '+extra+' adicionales</span>':'')+'</div></div>';
}

function sceneChunksHtml(){
  const chunks=state.preview?.chunks||[];
  if(!chunks.length)return '<div class="scene-empty">Calculando límites reales de los chunks…</div>';
  const shown=chunks.slice(0,4);
  const cards=shown.map((c,idx)=>{
    const tokens=c.tokens||[],from=Number(c.overlapFromPrevious||0),to=Number(c.overlapToNext||0);
    const tokenHtml=tokens.map((tok,i)=>{const inPrev=from>0&&i<from,outNext=to>0&&i>=tokens.length-to,cls=inPrev?'overlap-in':outNext?'overlap-out':'';return '<span class="scene-chunk-token '+cls+'">'+esc(tok)+'</span>';}).join('');
    const flow=to>0&&chunks[idx+1]?'<div class="scene-overlap-flow"><span>'+to+' tokens se repiten</span><i></i></div>':'';
    return '<div class="scene-chunk"><header><strong>'+esc(c.chunkId)+'</strong><small>'+tokens.length+' tokens · '+c.tokenStart+'–'+Math.max(c.tokenStart,c.tokenEnd-1)+'</small></header><div class="scene-chunk-tokens">'+tokenHtml+'</div>'+flow+'</div>';
  }).join('');
  const more=chunks.length>4?'<span class="scene-metric">primeros 4 visibles</span>':'';
  return '<div class="scene-stage scene-stage-chunks"><div class="scene-stage-head"><h3>3. Los límites agrupan tokens y el overlap conserva contexto</h3><p>Verde sólido: sale hacia el siguiente chunk. Verde punteado: llegó repetido desde el chunk anterior. Cambiá chunk size u overlap y esta escena se recalcula.</p></div><div class="scene-chunks">'+cards+'</div><div class="scene-metrics"><span class="scene-metric">'+chunks.length+' chunks reales</span><span class="scene-metric">chunk_size '+state.preview.chunkSize+'</span><span class="scene-metric">overlap '+state.preview.overlap+'</span>'+more+'</div></div>';
}

function renderIngestionScene(step='document'){
  const canvas=$('#sceneCanvas');
  if(!canvas)return;
  const order=['document','tokens','chunks'];
  const i=Math.max(0,order.indexOf(String(step)));
  const labels=['Documento','Tokens','Chunks + overlap'];
  canvas.innerHTML=i===0?sceneDocumentHtml():i===1?sceneTokensHtml():sceneChunksHtml();
  $('#sceneStepTitle').textContent=labels[i];
  $('#sceneStepInfo').textContent=(i+1)+' / 3';
  $('#scenePrev').disabled=i===0;$('#sceneNext').disabled=i===2;
  $$('#sceneProgress button').forEach((b,j)=>{b.classList.toggle('active',j===i);b.classList.toggle('done',j<i);});
  createIcons({icons:{FileText,Scissors,Binary}});
  const target=canvas.querySelector('.scene-document-card,.scene-token-cloud,.scene-chunks');
  if(target&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    animate(target,{opacity:[0,1],transform:['translateY(14px) scale(.985)','translateY(0px) scale(1)']},{duration:.32});
    if(i===1){const toks=[...canvas.querySelectorAll('.scene-token')].slice(0,48);animate(toks,{opacity:[0,1],transform:['translateY(8px)','translateY(0px)']},{delay:(_,n)=>Math.min(n*.012,.45),duration:.2});}
    if(i===2){animate([...canvas.querySelectorAll('.scene-chunk')],{opacity:[0,1],transform:['translateX(12px)','translateX(0px)']},{delay:(_,n)=>n*.08,duration:.28});}
  }
}

function initIngestionScene(){
  ingestionSceneActor=createActor(ingestionSceneMachine);
  ingestionSceneActor.subscribe(snapshot=>renderIngestionScene(snapshot.value));
  ingestionSceneActor.start();
  $('#scenePrev').addEventListener('click',()=>ingestionSceneActor.send({type:'PREV'}));
  $('#sceneNext').addEventListener('click',()=>ingestionSceneActor.send({type:'NEXT'}));
  $$('#sceneProgress button').forEach(b=>b.addEventListener('click',()=>ingestionSceneActor.send({type:String(b.dataset.scene||'document').toUpperCase()})));
}

function hashToken(token){let h=2166136261;for(const ch of token){h^=ch.codePointAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function baseVector(token){let h=hashToken(token),v=[];for(let i=0;i<4;i++){h=(Math.imul(h^(h>>>13),1274126177))>>>0;v.push(((h%2001)-1000)/1000);}return v;}
function positional(i){return [Math.sin(i),Math.cos(i),Math.sin(i/10),Math.cos(i/10)].map(x=>x*.22);}
const WQ=[[.6,-.2,.1,.3],[.1,.7,-.3,.2],[-.2,.2,.8,.1],[.3,.1,.2,.6]];
const WK=[[.5,.2,-.1,.3],[-.1,.8,.2,.1],[.2,-.2,.7,.2],[.1,.3,.1,.7]];
const WV=[[.7,.1,.2,-.1],[.2,.6,.1,.2],[-.1,.2,.8,.1],[.2,-.1,.2,.7]];
function matVec(M,v){return M.map(row=>row.reduce((s,x,i)=>s+x*v[i],0));}
function dot(a,b){return a.reduce((s,x,i)=>s+x*b[i],0);}
function add(a,b){return a.map((x,i)=>x+b[i]);}
function softmax(a){const m=Math.max(...a),e=a.map(x=>Math.exp(x-m)),s=e.reduce((x,y)=>x+y,0);return e.map(x=>x/s);}
function toyTransformer(text){
  const toks=tokenize(text).slice(0,10);
  const x=toks.map((t,i)=>add(baseVector(t),positional(i)));
  const q=x.map(v=>matVec(WQ,v)),k=x.map(v=>matVec(WK,v)),val=x.map(v=>matVec(WV,v));
  const scores=q.map(qv=>k.map(kv=>dot(qv,kv)/2));
  const att=scores.map(softmax);
  const ctx=att.map(row=>val[0].map((_,d)=>row.reduce((s,w,j)=>s+w*val[j][d],0)));
  const pooled=ctx[0]?ctx[0].map((_,d)=>ctx.reduce((s,v)=>s+v[d],0)/ctx.length):[0,0,0,0];
  const scalar=pooled.reduce((s,x,i)=>s+x*[.45,-.25,.55,.15][i],0);
  return {toks,x,q,k,val,scores,att,ctx,pooled,scalar};
}
function vecStr(v){return '['+v.map(x=>x.toFixed(3)).join(', ')+']';}
const transformerStages=[
  {id:'tokens',label:'Tokens'},
  {id:'vector',label:'Vector'},
  {id:'position',label:'Posición'},
  {id:'qkv',label:'Q / K / V'},
  {id:'scores',label:'Scores'},
  {id:'attention',label:'Atención'},
  {id:'context',label:'Contexto'},
  {id:'pooling',label:'Pooling'}
];
const transformerSceneMachine=createMachine({
  id:'transformerLearningScene',initial:'tokens',
  states:{
    tokens:{on:{NEXT:'vector',GOTO_VECTOR:'vector',GOTO_POSITION:'position',GOTO_QKV:'qkv',GOTO_SCORES:'scores',GOTO_ATTENTION:'attention',GOTO_CONTEXT:'context',GOTO_POOLING:'pooling'}},
    vector:{on:{PREV:'tokens',NEXT:'position',GOTO_TOKENS:'tokens',GOTO_POSITION:'position',GOTO_QKV:'qkv',GOTO_SCORES:'scores',GOTO_ATTENTION:'attention',GOTO_CONTEXT:'context',GOTO_POOLING:'pooling'}},
    position:{on:{PREV:'vector',NEXT:'qkv',GOTO_TOKENS:'tokens',GOTO_VECTOR:'vector',GOTO_QKV:'qkv',GOTO_SCORES:'scores',GOTO_ATTENTION:'attention',GOTO_CONTEXT:'context',GOTO_POOLING:'pooling'}},
    qkv:{on:{PREV:'position',NEXT:'scores',GOTO_TOKENS:'tokens',GOTO_VECTOR:'vector',GOTO_POSITION:'position',GOTO_SCORES:'scores',GOTO_ATTENTION:'attention',GOTO_CONTEXT:'context',GOTO_POOLING:'pooling'}},
    scores:{on:{PREV:'qkv',NEXT:'attention',GOTO_TOKENS:'tokens',GOTO_VECTOR:'vector',GOTO_POSITION:'position',GOTO_QKV:'qkv',GOTO_ATTENTION:'attention',GOTO_CONTEXT:'context',GOTO_POOLING:'pooling'}},
    attention:{on:{PREV:'scores',NEXT:'context',GOTO_TOKENS:'tokens',GOTO_VECTOR:'vector',GOTO_POSITION:'position',GOTO_QKV:'qkv',GOTO_SCORES:'scores',GOTO_CONTEXT:'context',GOTO_POOLING:'pooling'}},
    context:{on:{PREV:'attention',NEXT:'pooling',GOTO_TOKENS:'tokens',GOTO_VECTOR:'vector',GOTO_POSITION:'position',GOTO_QKV:'qkv',GOTO_SCORES:'scores',GOTO_ATTENTION:'attention',GOTO_POOLING:'pooling'}},
    pooling:{on:{PREV:'context',GOTO_TOKENS:'tokens',GOTO_VECTOR:'vector',GOTO_POSITION:'position',GOTO_QKV:'qkv',GOTO_SCORES:'scores',GOTO_ATTENTION:'attention',GOTO_CONTEXT:'context'}}
  }
});
let transformerSceneActor=null;

function populateTransformerSentences(){
  const sel=$('#transformerSentence'),old=sel.value;
  const options=parseSections($('#document').value).flatMap(s=>s.text.split(/(?<=[.!?])\s+/).map(x=>x.trim()).filter(Boolean)).slice(0,12);
  sel.innerHTML=options.map(x=>'<option value="'+esc(x)+'">'+esc(x.slice(0,68))+(x.length>68?'…':'')+'</option>').join('');
  if(options.includes(old))sel.value=old;
  renderTransformer();
}

function transformerData(){
  const text=$('#transformerSentence').value||parseSections($('#document').value)[0]?.text||'';
  const t=toyTransformer(text);
  if(t.toks.length)state.attentionToken=clamp(state.attentionToken,0,t.toks.length-1);
  return {text,t,focus:state.attentionToken};
}
function vectorBars(v,label){
  const max=Math.max(.001,...v.map(x=>Math.abs(x)));
  return '<div class="tf-vector-block"><strong>'+esc(label)+'</strong><div class="tf-vector-bars">'+v.map((x,i)=>'<span title="d'+i+' = '+x.toFixed(3)+'"><i style="height:'+Math.max(8,Math.abs(x)/max*100)+'%"></i><small>'+x.toFixed(2)+'</small></span>').join('')+'</div></div>';
}
function transformerVisualHtml(stage,t,f){
  const tok=esc(t.toks[f]||'');
  if(stage==='tokens')return '<div class="tf-story"><h3>1. Una frase entra como tokens</h3><p>Elegí el token que querés seguir. A partir de acá observamos cómo cambia su representación.</p><div class="tf-token-line">'+t.toks.map((x,i)=>'<button class="tf-token token-pick '+(i===f?'selected':'')+'" data-token="'+i+'"><small>'+i+'</small>'+esc(x)+'</button>').join('')+'</div></div>';
  if(stage==='vector')return '<div class="tf-story"><h3>2. El token necesita una representación numérica</h3><p><b>'+tok+'</b> deja de ser sólo texto y pasa a un vector didáctico de 4 dimensiones.</p>'+vectorBars(baseVector(t.toks[f]),'vector inicial de '+t.toks[f])+'</div>';
  if(stage==='position')return '<div class="tf-story"><h3>3. La posición también aporta información</h3><p>El mismo token en otra posición no debería verse exactamente igual. Sumamos una señal de posición al vector inicial.</p><div class="tf-equation-flow">'+vectorBars(baseVector(t.toks[f]),'token')+'<b>+</b>'+vectorBars(positional(f),'posición '+f)+'<b>=</b>'+vectorBars(t.x[f],'entrada contextualizable')+'</div></div>';
  if(stage==='qkv')return '<div class="tf-story"><h3>4. De una representación salen Q, K y V</h3><p>En este modelo didáctico, tres transformaciones distintas preparan la información para decidir relaciones y mezclar contenido.</p><div class="tf-qkv">'+vectorBars(t.q[f],'Q · qué busca')+vectorBars(t.k[f],'K · qué ofrece')+vectorBars(t.val[f],'V · qué contenido aporta')+'</div></div>';
  if(stage==='scores')return '<div class="tf-story"><h3>5. Q se compara con los K</h3><p>Para <b>'+tok+'</b>, cada score mide compatibilidad antes de normalizar. Más alto significa mayor afinidad en este ejemplo.</p><div class="tf-score-list">'+t.toks.map((x,i)=>'<div><span>'+esc(x)+'</span><i style="width:'+clamp((t.scores[f][i]+2)/4*100,4,100)+'%"></i><b>'+t.scores[f][i].toFixed(3)+'</b></div>').join('')+'</div></div>';
  if(stage==='attention')return '<div class="tf-story"><h3>6. Softmax transforma scores en atención</h3><p>Los pesos ahora suman 1. Verde marca las relaciones de mayor peso para el token seleccionado.</p><div class="tf-attention-links">'+t.toks.map((x,i)=>'<div class="tf-attention-node '+(i===f?'focus':'')+'"><span>'+esc(x)+'</span><b>'+t.att[f][i].toFixed(3)+'</b><i style="opacity:'+clamp(.18+t.att[f][i]*3,.18,1)+'"></i></div>').join('')+'</div></div>';
  if(stage==='context')return '<div class="tf-story"><h3>7. Los V se mezclan con esos pesos</h3><p>El token ya no queda representado de forma aislada: incorpora información de los demás tokens.</p><div class="tf-context-flow"><div class="tf-context-sources">'+t.toks.map((x,i)=>'<span style="opacity:'+clamp(.25+t.att[f][i]*3,.25,1)+'">'+esc(x)+' · '+t.att[f][i].toFixed(2)+'</span>').join('')+'</div><b>→</b>'+vectorBars(t.ctx[f],'vector contextual de '+t.toks[f])+'</div></div>';
  return '<div class="tf-story"><h3>8. Pooling resume las representaciones contextualizadas</h3><p>Para cerrar el ejemplo didáctico, resumimos los vectores contextuales. Esto ayuda a entender la idea de obtener una representación de la secuencia; no reproduce el pipeline interno exacto de <code>nomic-embed-text</code>.</p><div class="tf-pooling"><div><span>'+t.ctx.length+' vectores contextuales</span><b>↓ promedio didáctico</b></div>'+vectorBars(t.pooled,'representación resumida')+'<div class="tf-scalar">proyección didáctica <strong>'+t.scalar.toFixed(4)+'</strong></div></div></div>';
}
function renderTransformer(){
  if(!transformerSceneActor)return;
  const {text,t,focus:f}=transformerData();if(!t.toks.length)return;
  const stage=String(transformerSceneActor.getSnapshot().value);
  const idx=transformerStages.findIndex(x=>x.id===stage);
  state.transformerSubstep=Math.max(0,idx);
  $('#transformerSceneCanvas').innerHTML=transformerVisualHtml(stage,t,f);
  $('#tfStageTitle').textContent=transformerStages[idx]?.label||'Tokens';
  $('#tfStageProgress').textContent=(idx+1)+' / '+transformerStages.length;
  $('#tfPrev').disabled=idx===0;$('#tfNext').disabled=idx===transformerStages.length-1;
  $('#transformerStoryProgress').innerHTML=transformerStages.map((x,i)=>'<button data-tf-stage="'+x.id+'" class="'+(i===idx?'active':i<idx?'done':'')+'"><b>'+(i+1)+'</b><span>'+x.label+'</span></button>').join('');
  $$('.token-pick').forEach(b=>b.addEventListener('click',()=>{state.attentionToken=Number(b.dataset.token);renderTransformer();}));
  $$('#transformerStoryProgress button').forEach(b=>b.addEventListener('click',()=>transformerSceneActor.send({type:'GOTO_'+String(b.dataset.tfStage).toUpperCase()})));
  const calculation=[
    ['Tokens',t.toks.map((x,i)=>i+' · '+esc(x)).join(' | ')],
    ['Vector inicial',vecStr(baseVector(t.toks[f]))],
    ['Posición','pos('+f+') = '+vecStr(positional(f))+' · entrada = '+vecStr(t.x[f])],
    ['Q / K / V','Q = '+vecStr(t.q[f])+'<br>K = '+vecStr(t.k[f])+'<br>V = '+vecStr(t.val[f])],
    ['Scores','['+t.scores[f].map(x=>x.toFixed(3)).join(', ')+']'],
    ['Atención','['+t.att[f].map(x=>x.toFixed(3)).join(', ')+'] · suma = '+t.att[f].reduce((a,b)=>a+b,0).toFixed(3)],
    ['Vector contextual',vecStr(t.ctx[f])],
    ['Pooling',vecStr(t.pooled)+' · proyección = '+t.scalar.toFixed(4)]
  ];
  $('#calcSteps').innerHTML='<div class="tf-calc-inspector"><strong>Cálculo de la etapa actual · '+calculation[idx][0]+'</strong><p>'+calculation[idx][1]+'</p><small>Modelo educativo de 4 dimensiones con matrices fijas definidas en el frontend.</small></div>';
  renderHeatmap(t,f);
  const real=state.ingest?.chunks?.find(c=>c.content.includes(text.slice(0,18)))||state.ingest?.chunks?.[0];
  $('#formulaBox').innerHTML='<div class="truth-column didactic"><span>DIDÁCTICO</span><strong>Transformer visible 4D</strong><p>Vectores, Q/K/V, scores, softmax y pooling calculados por el laboratorio para estudiar la mecánica.</p></div><div class="truth-divider">≠</div><div class="truth-column real"><span>REAL</span><strong>nomic-embed-text</strong>'+(real?'<p>Embedding almacenado: <b>'+real.dimensions+'D</b><br>Primeros valores: '+real.vectorSample.slice(0,6).map(x=>Number(x).toFixed(4)).join(', ')+'…</p>':'<p>Ejecutá la ingesta para ver el embedding 768D realmente producido por Ollama.</p>')+'</div>';
  createIcons({icons:{BrainCircuit,Binary}});
  const target=$('#transformerSceneCanvas .tf-story');
  if(target&&!matchMedia('(prefers-reduced-motion: reduce)').matches)animate(target,{opacity:[0,1],transform:['translateY(12px)','translateY(0px)']},{duration:.3});
}
function renderHeatmap(t,focus){
  const n=t.toks.length,wrap=$('#attentionHeatmap');
  const row=t.att[focus]||[];
  const ranked=row.map((w,i)=>({w,i})).sort((a,b)=>b.w-a.w);
  const chosen=new Set(ranked.slice(0,Math.min(3,ranked.length)).map(x=>x.i));chosen.add(focus);
  let html='<div class="heat-grid" style="grid-template-columns:84px repeat('+n+',minmax(32px,1fr))"><span></span>'+t.toks.map((x,i)=>'<span class="heat-label '+(chosen.has(i)?'heat-label-selected':'')+'">'+esc(x)+'</span>').join('');
  t.toks.forEach((tok,i)=>{html+='<span class="heat-label row-label '+(i===focus?'heat-label-focus':'')+'">'+esc(tok)+'</span>';t.att[i].forEach((w,j)=>{const a=.10+.78*w;const selected=i===focus&&chosen.has(j);const bg=selected?'rgba(52,211,153,'+Math.min(.95,.22+a).toFixed(2)+')':'rgba(96,165,250,'+a.toFixed(2)+')';html+='<span class="heat-cell '+(selected?'heat-selected':'')+'" style="background:'+bg+'" title="'+w.toFixed(4)+'">'+w.toFixed(2)+'</span>';});});
  wrap.innerHTML=html+'</div>';
}
function initTransformerScene(){
  transformerSceneActor=createActor(transformerSceneMachine);
  transformerSceneActor.subscribe(()=>renderTransformer());
  transformerSceneActor.start();
  $('#tfPrev').addEventListener('click',()=>transformerSceneActor.send({type:'PREV'}));
  $('#tfNext').addEventListener('click',()=>transformerSceneActor.send({type:'NEXT'}));
  $('#transformerSentence').addEventListener('change',()=>{state.attentionToken=0;renderTransformer();});
}

$('#refreshDb').addEventListener('click',()=>loadDbBrowser($('#dbDocumentSelect').value).catch(()=>{}));
$('#dbDocumentSelect').addEventListener('change',()=>{state.activeDocumentId=Number($('#dbDocumentSelect').value)||null;loadDbBrowser(state.activeDocumentId).catch(()=>{});});

function replayDbEvents(){
  if(state.dbTimer)clearInterval(state.dbTimer);
  const events=state.ingest?.dbEvents||[],box=$('#dbEvents'),packet=$('#dbPacket');box.innerHTML='';$('#dbCount').textContent='0 filas';let i=0,rows=0;
  if(!events.length){box.innerHTML='<div class="empty-state">Sin eventos.</div>';return;}
  const tick=()=>{if(i>=events.length){clearInterval(state.dbTimer);state.dbTimer=null;packet.classList.remove('moving');return;}const e=events[i++];packet.classList.remove('moving');void packet.offsetWidth;packet.classList.add('moving');if(e.type==='insert_chunk')rows++;$('#dbCount').textContent=rows+' filas';box.insertAdjacentHTML('beforeend','<div class="event '+esc(e.type)+'"><span>'+String(i).padStart(2,'0')+'</span><strong>'+esc(e.label)+'</strong><small>'+(e.chunkId?esc(e.chunkId)+' · '+e.dimensions+'D':'')+'</small></div>');};
  tick();state.dbTimer=setInterval(tick,520);
}

function chunkCards(){if(!state.ingest)return '<div class="empty-state">Primero ejecutá la ingesta.</div>';return '<div class="cards">'+state.ingest.chunks.map(c=>'<div class="data-card"><strong>'+esc(c.chunkId)+' · '+esc(c.section)+'</strong><p>'+esc(c.content)+'</p><p>'+c.dimensions+'D · norma '+c.norm.toFixed(4)+'</p></div>').join('')+'</div>';}
function transformerStage(){return '<div class="cards"><div class="data-card"><strong>Tokenización</strong><p>El texto entra como tokens.</p></div><div class="data-card"><strong>Transformer</strong><p>Capas de atención contextualizan esos tokens.</p></div><div class="data-card"><strong>Pooling/proyección</strong><p>El resultado se resume en un embedding.</p></div><div class="data-card"><strong>Salida real</strong><p>'+(state.ingest?state.ingest.chunks[0].dimensions+' dimensiones de nomic-embed-text.':'Ejecutá la ingesta.')+'</p></div></div>';}
function databaseStage(){if(!state.ingest)return '<div class="empty-state">Sin datos.</div>';return '<div class="cards"><div class="data-card"><strong>Transacción real</strong><p>'+state.ingest.dbEvents.length+' eventos registrados.</p></div><div class="data-card"><strong>Filas confirmadas</strong><p>'+state.ingest.storedRows+' chunks persistidos en pgvector.</p></div></div>'+chunkCards();}
function retrievalStage(){if(!state.analysis)return '<div class="empty-state">Ejecutá una pregunta.</div>';return '<div class="cards">'+state.analysis.retrieval.ranked.map(r=>'<div class="data-card"><strong>#'+r.rank+' '+esc(r.metadata?.chunk_id||r.id)+' · '+fmt(r.similarity)+(r.accepted?' ✓':' ✕')+'</strong><p>Ángulo: '+r.angleDeg.toFixed(1)+'°</p><p>'+esc(r.content)+'</p></div>').join('')+'</div>';}
function contextStage(){return state.analysis?'<pre>'+esc(state.analysis.context||'(ningún chunk superó el threshold)')+'</pre>':'<div class="empty-state">Sin contexto.</div>';}
function llmStage(){if(!state.analysis)return '<div class="empty-state">Sin generación.</div>';const g=state.analysis.generation;return '<div class="cards"><div class="data-card"><strong>Modelo</strong><p>'+esc(state.analysis.models.llm)+'</p></div><div class="data-card"><strong>Prompt tokens</strong><p>'+(g.prompt_eval_count??'—')+'</p></div><div class="data-card"><strong>Salida tokens</strong><p>'+(g.eval_count??'—')+'</p></div></div><div class="answer" style="margin-top:12px">'+esc(g.text)+'</div>';}
function citationsStage(){if(!state.analysis)return '<div class="empty-state">Sin citas.</div>';return state.analysis.citations.length?'<div class="cards">'+state.analysis.citations.map(c=>'<div class="data-card"><strong>'+esc(c.chunkId)+' · '+fmt(c.similarity)+'</strong><p>'+esc(c.source)+' → '+esc(c.section)+'</p></div>').join('')+'</div>':'<div class="empty-state">No hubo evidencia aceptada: abstención.</div>';}
function stageHtml(i){if(i===0)return '<div class="data-card"><strong>'+esc($('#title').value)+'</strong><p>'+$('#document').value.length+' caracteres.</p></div>';if(i===1)return chunkCards();if(i===2)return transformerStage();if(i===3)return state.ingest?'<div class="cards">'+state.ingest.chunks.map(c=>'<div class="data-card"><strong>'+c.chunkId+'</strong><p>['+c.vectorSample.slice(0,6).map(x=>Number(x).toFixed(4)).join(', ')+', …]</p></div>').join('')+'</div>':'<div class="empty-state">Sin embeddings.</div>';if(i===4)return databaseStage();if(i===5)return retrievalStage();if(i===6)return contextStage();if(i===7)return llmStage();return citationsStage();}
function renderStage(){const buttons=$$('#pipeline button');buttons.forEach((b,i)=>{b.classList.toggle('active',i===state.stage);b.classList.toggle('done',i<state.stage);});$('#stageViewer').innerHTML=stageHtml(state.stage);$('#pipelineProgress').textContent=(state.stage+1)+' / 9';$('#pipelinePrev').disabled=state.stage===0;$('#pipelineNext').disabled=state.stage===8;if(window.innerWidth<760)buttons[state.stage]?.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});}

function renderBars(){const box=$('#similarityBars');if(!state.analysis){box.innerHTML='<div class="empty-state">Esperando una consulta.</div>';return;}const th=state.analysis.retrieval.threshold;box.innerHTML='<div class="threshold-label">threshold '+th.toFixed(2)+'</div>'+state.analysis.retrieval.ranked.map(r=>'<div class="bar-row '+(r.accepted?'':'reject')+'"><div class="bar-label">'+esc(r.metadata?.chunk_id||r.id)+'</div><div class="bar-track"><div class="bar-fill" style="width:'+clamp(r.similarity*100,0,100)+'%"></div><span class="threshold-mark" style="left:'+clamp(th*100,0,100)+'%"></span></div><div class="bar-score">'+fmt(r.similarity)+'</div></div>').join('');}
function renderVectorPlot(){
  const box=$('#vectorPlot'),legend=$('#vectorLegend');
  if(!state.analysis){box.innerHTML='<div class="empty-state">Esperando consulta.</div>';legend.innerHTML='';return;}
  const rows=state.analysis.retrieval.ranked,W=620,H=360,cx=150,cy=180,len=130;
  box.innerHTML='';
  const svg=d3.select(box).append('svg').attr('viewBox',`0 0 ${W} ${H}`).attr('role','img').attr('aria-label','Comparación angular real entre la pregunta y los chunks');
  svg.append('line').attr('x1',cx).attr('y1',25).attr('x2',cx).attr('y2',335).attr('stroke','#27344d');
  svg.append('line').attr('x1',20).attr('y1',cy).attr('x2',590).attr('y2',cy).attr('stroke','#27344d');
  svg.append('circle').attr('cx',cx).attr('cy',cy).attr('r',len).attr('fill','none').attr('stroke','#27344d').attr('stroke-dasharray','4 5');
  const defs=svg.append('defs');
  const marker=(id,color)=>defs.append('marker').attr('id',id).attr('markerWidth',8).attr('markerHeight',8).attr('refX',7).attr('refY',4).attr('orient','auto').append('path').attr('d','M0 0L8 4L0 8z').attr('fill',color);
  marker('aq','#f8fafc');marker('ac','#60a5fa');
  svg.append('line').attr('x1',cx).attr('y1',cy).attr('x2',cx+len).attr('y2',cy).attr('stroke','#f8fafc').attr('stroke-width',4).attr('marker-end','url(#aq)');
  svg.append('text').attr('x',cx+len+12).attr('y',cy+5).attr('fill','#f8fafc').attr('font-size',12).text('pregunta');
  const vectors=rows.map((r,i)=>{const sign=i%2===0?-1:1,a=r.angleDeg*Math.PI/180*sign;return {...r,x:cx+len*Math.cos(a),y:cy+len*Math.sin(a)};});
  svg.selectAll('.chunk-vector').data(vectors).enter().append('line').attr('class','chunk-vector').attr('x1',cx).attr('y1',cy).attr('x2',cx).attr('y2',cy).attr('stroke',d=>d.accepted?'#60a5fa':'#64748b').attr('stroke-width',d=>d.accepted?3:2).attr('opacity',d=>d.accepted?1:.55).attr('marker-end','url(#ac)').transition().duration(450).attr('x2',d=>d.x).attr('y2',d=>d.y);
  svg.selectAll('.chunk-label').data(vectors).enter().append('text').attr('class','chunk-label').attr('x',d=>d.x+8).attr('y',d=>d.y+4).attr('fill','#b9c7dc').attr('font-size',11).text(d=>d.metadata?.chunk_id||d.rank);
  svg.append('text').attr('x',18).attr('y',345).attr('fill','#98a6bd').attr('font-size',11).text('Menor ángulo = mayor similitud coseno');
  legend.innerHTML=rows.map(r=>'<span>'+esc(r.metadata?.chunk_id||r.id)+' · '+r.angleDeg.toFixed(1)+'° · '+fmt(r.similarity)+'</span>').join('');
}

function renderDimensions(){const box=$('#dimensions');if(!state.analysis){box.innerHTML='<div class="empty-state">Esperando embeddings.</div>';return;}const rows=[{name:'Pregunta',v:state.analysis.questionVector.sample},...state.analysis.retrieval.ranked.slice(0,3).map(r=>({name:r.metadata?.chunk_id||String(r.id),v:r.vectorSample}))];let h='<div class="dimension-table"><div class="dim-row dim-head"><span></span>'+Array.from({length:12},(_,i)=>'<div class="dim-cell">d'+(i+1)+'</div>').join('')+'</div>';rows.forEach(r=>{h+='<div class="dim-row"><span>'+esc(r.name)+'</span>'+r.v.slice(0,12).map(v=>'<div class="dim-cell '+(v<0?'neg':'')+'" title="'+Number(v).toFixed(5)+'"><i style="height:'+Math.min(50,Math.abs(v)*240)+'%"></i></div>').join('')+'</div>';});box.innerHTML=h+'</div>';}
function renderAnswer(){if(!state.analysis){$('#answer').innerHTML='<div class="empty-state">Esperando análisis.</div>';$('#validation').innerHTML='';$('#citations').innerHTML='';return;}$('#answer').textContent=state.analysis.generation.text;const v=state.analysis.validation;$('#validation').innerHTML=v?'<span class="'+(v.citationsValid?'valid':'invalid')+'">'+(v.citationsValid?'✓ Citas válidas':'✕ Cita inválida')+'</span><span>'+v.citedIds.length+' referencias del LLM</span>':'';$('#citations').innerHTML=state.analysis.citations.map(c=>'<div class="citation"><strong>'+esc(c.chunkId)+' · '+fmt(c.similarity)+' · '+esc(c.source)+' → '+esc(c.section)+'</strong><p>'+esc(c.content)+'</p></div>').join('');}
function renderTechnical(){const b=$('#technical');if(state.tab==='chunks'){b.innerHTML=state.ingest?'<pre>'+esc(JSON.stringify(state.ingest.chunks,null,2))+'</pre>':'<div class="empty-state">Sin chunks.</div>';return;}if(state.tab==='tokens'){const toks=state.analysis?.questionTokens||[];b.innerHTML=toks.length?toks.map((t,i)=>'<span class="token">'+i+': '+esc(t)+'</span>').join(''):'<div class="empty-state">Ejecutá una pregunta.</div>';return;}if(state.tab==='database'){b.innerHTML=state.ingest?'<pre>'+esc(JSON.stringify({documentId:state.ingest.documentId,storedRows:state.ingest.storedRows,events:state.ingest.dbEvents},null,2))+'</pre>':'<div class="empty-state">Sin transacción.</div>';return;}b.innerHTML=state.analysis?'<pre>'+esc(state.analysis.prompt)+'</pre>':'<div class="empty-state">Sin prompt.</div>';}

async function loadDbBrowser(documentId){
  const q=documentId?'?documentId='+encodeURIComponent(documentId):'';
  const data=await api('/api/db-browser'+q);
  const sel=$('#dbDocumentSelect');
  if(!sel)return;
  state.activeDocumentId=data.documentId||state.activeDocumentId;
  sel.innerHTML=data.documents.map(d=>'<option value="'+d.id+'" '+(String(d.id)===String(data.documentId)?'selected':'')+'>'+esc(d.title)+' · '+d.chunk_count+' chunks</option>').join('');
  $('#dbRealSummary').innerHTML='<span>document_id '+(data.documentId??'—')+'</span><span>'+data.rows.length+' filas</span><span>PostgreSQL real</span><span>pgvector</span>';
  const tbody=$('#dbRows');
  tbody.innerHTML=data.rows.length?data.rows.map(r=>'<tr data-row-id="'+r.id+'"><td>'+r.id+'</td><td>'+esc(r.metadata?.chunk_id||('chunk_'+r.chunk_index))+'</td><td>'+esc(r.section)+'</td><td class="db-content-cell">'+esc(r.content)+'</td><td><code>vector('+r.dimensions+')</code><br><small>['+r.vectorSample.slice(0,4).map(x=>Number(x).toFixed(3)).join(', ')+', …]</small></td><td><button class="secondary db-open" data-id="'+r.id+'">Abrir</button></td></tr>').join(''):'<tr><td colspan="6" class="empty-state">Sin filas.</td></tr>';
  $$('.db-open').forEach(b=>b.addEventListener('click',()=>openDbChunk(b.dataset.id)));
}

async function openDbChunk(id){
  const box=$('#dbChunkDetail');
  box.innerHTML='<div class="empty-state">Leyendo fila '+esc(id)+' directamente desde PostgreSQL…</div>';
  try{
    const d=await api('/api/db-browser/chunk/'+encodeURIComponent(id));
    const r=d.row;
    const cells=r.vector.map((v,i)=>'<div class="vector-dim"><span>d'+String(i+1).padStart(3,'0')+'</span><b>'+Number(v).toFixed(6)+'</b><i style="width:'+Math.min(100,Math.abs(v)*500)+'%"></i></div>').join('');
    box.innerHTML='<div class="db-detail-head"><div><div class="eyebrow">FILA REAL #'+r.id+'</div><h3>'+esc(r.metadata?.chunk_id||('chunk_'+r.chunk_index))+' · '+esc(r.section)+'</h3></div><span class="pill ok">vector('+r.dimensions+')</span></div>'+
      '<div class="db-detail-grid"><div class="data-card"><strong>Contenido almacenado</strong><p>'+esc(r.content)+'</p></div><div class="data-card"><strong>Metadata JSONB</strong><pre>'+esc(JSON.stringify(r.metadata,null,2))+'</pre></div></div>'+
      '<div class="vector-full-head"><strong>Embedding completo</strong><span>'+r.dimensions+' dimensiones reales</span></div><div class="vector-full">'+cells+'</div>';
  }catch(e){box.innerHTML='<div class="status-line bad">Error: '+esc(e.message)+'</div>';}
}

function renderAll(){renderStage();renderBars();renderVectorPlot();renderDimensions();renderAnswer();renderTechnical();renderTransformer();loadDbBrowser(state.ingest?.documentId).catch(()=>{});}

const guides=[
['Documento','Este documento corto está diseñado para probar chunking, similitud, grounding, citas y abstención. Podés editar cualquier frase y todo el sistema se recalcula.','#step-document'],
['Tokens','Antes del embedding, el texto se tokeniza. En el microscopio podés ver los tokens de una frase y cómo pasan a vectores iniciales.','#step-transformer'],
['Chunks','Chunk size y overlap cambian cómo cortamos el conocimiento. Mové los sliders y mirá la previsualización antes de guardar nada.','#step-document'],
['Transformer','Acá podés seguir una versión mínima de las operaciones: vector inicial + posición → Q/K/V → scores → softmax → contexto → pooling. El embedding real se muestra aparte.','#step-transformer'],
['Base vectorial','Al ejecutar la ingesta, PostgreSQL realmente escribe las filas. La animación es una reproducción visual de esos INSERT y del COMMIT real.','#step-db'],
['Pregunta','La pregunta también se convierte en embedding. Después la base compara ese vector contra los chunks almacenados.','#step-query'],
['Retrieval','El gráfico angular y las barras usan la similitud coseno real. top_k limita candidatos y threshold decide cuáles llegan al contexto.','#step-vectors'],
['LLM','Sólo los chunks aceptados forman el contexto. Qwen3 recibe ese contexto con instrucciones de grounding y debe citar los chunk_id.','#step-answer'],
['Respuesta','La respuesta final muestra evidencia, citas y validación. Probá “¿Cuál es el salario del equipo?” para observar abstención.','#step-answer']
];
function startOneMascotIdle(){
  const mascot=$('#oneMascot'),glow=$('.one-mascot-glow');
  if(!mascot)return;
  if(glow)glow.classList.add('one-idle-active');
}

function setGuide(i,scroll=false){state.guide=clamp(i,0,guides.length-1);const [t,p,target]=guides[state.guide];$('#guideTitle').textContent=t;$('#guideText').textContent=p;$$('#journeyTrack button').forEach((b,j)=>b.classList.toggle('active',j===state.guide));$('#guidePrev').disabled=state.guide===0;$('#guideNext').textContent=state.guide===guides.length-1?'Volver al inicio':'Siguiente paso →';if(scroll)document.querySelector(target)?.scrollIntoView({behavior:'smooth',block:'start'});}
$('#guidePrev').addEventListener('click',()=>setGuide(state.guide-1,true));
$('#guideNext').addEventListener('click',()=>setGuide(state.guide===guides.length-1?0:state.guide+1,true));
$$('#journeyTrack button').forEach((b,i)=>b.addEventListener('click',()=>setGuide(i,true)));



function installTaskAnimations(){
  const specs=[
    ['#step-document','doc',`<div class="anim-doc"><div class="anim-page"><span></span><span></span><span></span><i></i></div><div class="anim-arrow"></div><div class="anim-mini-chunks"><b></b><b></b><b></b></div></div>`,'Documento → bloques de texto'],
    ['#step-transformer','transformer',`<div class="anim-transformer"><div class="anim-tokens"><b>T1</b><b>T2</b><b>T3</b><b>T4</b></div><div class="anim-flow-line"></div><div class="anim-core"><i></i><i></i><i></i></div><div class="anim-vector-out"><span></span><span></span><span></span><span></span></div></div>`,'Tokens → atención → vector'],
    ['#step-db','db',`<div class="anim-db"><div class="anim-stack"><b></b><b></b><b></b></div><div class="anim-db-track"><i></i></div><div class="anim-db-cylinder"><span>pgvector</span><b></b><b></b><b></b></div></div>`,'Chunks + embeddings → pgvector'],
    ['#step-query .query-card','query',`<div class="anim-query"><div class="anim-question">Q</div><div class="anim-query-wave"><i></i><i></i><i></i></div><div class="anim-query-vector"><b></b><b></b><b></b><b></b></div></div>`,'Pregunta → embedding'],
    ['#step-query .pipeline-panel','pipeline',`<div class="anim-pipeline"><b>DOC</b><i></i><b>VEC</b><i></i><b>DB</b><i></i><b>RET</b><i></i><b>LLM</b></div>`,'Flujo E2E activo'],
    ['#step-vectors','vectors',`<div class="anim-vectors"><div class="anim-origin"></div><span class="anim-vq"></span><span class="anim-v1"></span><span class="anim-v2"></span><span class="anim-v3"></span><div class="anim-angle"></div></div>`,'Comparación por similitud coseno'],
    ['#step-answer','answer',`<div class="anim-answer"><div class="anim-context-pills"><b></b><b></b><b></b></div><div class="anim-answer-arrow"></div><div class="anim-llm-box">LLM</div><div class="anim-stream"><span></span><span></span><span></span><span></span></div></div>`,'Contexto → LLM → respuesta'],
    ['#step-db-browser','browser',`<div class="anim-browser"><div class="anim-table"><span></span><span></span><span></span><span></span></div><div class="anim-magnifier"></div><div class="anim-dims"><b></b><b></b><b></b><b></b><b></b></div></div>`,'Inspección de filas y dimensiones reales']
  ];
  for(const [selector,type,visual,label] of specs){
    const host=$(selector); if(!host||host.querySelector('.task-animation')) continue;
    const card=document.createElement('div');
    card.className='task-animation task-'+type;
    card.innerHTML='<div class="task-animation-visual" aria-hidden="true">'+visual+'</div><div class="task-animation-label">'+label+'</div>';
    const head=host.querySelector('.section-head');
    if(head) head.insertAdjacentElement('afterend',card); else host.prepend(card);
  }
  syncTaskAnimations();
}
function syncTaskAnimations(){
  const all=$$('.task-animation');
  all.forEach(x=>x.classList.remove('animation-active'));
  if(window.innerWidth<760){
    const current=mobileScreens[state.mobileStep]?.[1];
    if(current){
      const screen=document.querySelector(current);
      if(state.mobileStep===3)screen?.querySelector('.query-card .task-animation')?.classList.add('animation-active');
      else if(state.mobileStep===4)screen?.querySelector('.pipeline-panel .task-animation')?.classList.add('animation-active');
      else screen?.querySelector('.task-animation')?.classList.add('animation-active');
    }
  }else all.forEach(x=>x.classList.add('animation-active'));
}

const oneStepLines=['Primero vemos el documento','Ahora tokenizamos el texto','Guardamos vectores y metadata','Formulamos la pregunta','Seguimos el pipeline RAG','Comparamos los vectores','Construimos la respuesta','Miremos dentro de pgvector'];
const ONE_ASSETS={idle:'/characters/one/normalized/idle.png'};
let oneDragged=false,oneSpeechTimer=null,onePointerMoved=false,oneIdleTimers=[],oneTalkTimer=null,oneActivityEpoch=0;
const clearOneIdle=()=>{oneIdleTimers.forEach(clearTimeout);oneIdleTimers=[];};
const stopOneTalk=()=>{clearInterval(oneTalkTimer);oneTalkTimer=null;$('#oneFloatingGuide')?.classList.remove('mouth-a','mouth-b');};
function pulseOneBlink(ms=150){const el=$('#oneFloatingGuide');if(!el)return;el.classList.add('blink');oneIdleTimers.push(setTimeout(()=>el.classList.remove('blink'),ms));}
function startOneTalk(){
  stopOneTalk();const el=$('#oneFloatingGuide');if(!el)return;let open=false;el.classList.add('mouth-a');
  oneTalkTimer=setInterval(()=>{open=!open;el.classList.toggle('mouth-a',open);el.classList.toggle('mouth-b',!open);},390);
}
function scheduleOneIdle(){
  stopOneTalk();clearOneIdle();const el=$('#oneFloatingGuide');if(!el)return;const epoch=++oneActivityEpoch;el.classList.remove('funny','neutral-wait','bored');
  const later=(delay,fn)=>oneIdleTimers.push(setTimeout(()=>{if(epoch===oneActivityEpoch&&!el.classList.contains('speaking'))fn();},delay));
  later(7600,()=>pulseOneBlink(145));later(16600,()=>pulseOneBlink(155));later(28500,()=>{el.classList.add('funny');pulseOneBlink(190);});later(31500,()=>el.classList.remove('funny'));
  later(47000,()=>pulseOneBlink(160));later(58000,()=>el.classList.add('neutral-wait'));later(76000,()=>el.classList.add('bored'));
}

function clampFloatingOne(){
  const el=$('#oneFloatingGuide');if(!el)return;const r=el.getBoundingClientRect(),pad=8,maxX=Math.max(pad,innerWidth-r.width-pad),maxY=Math.max(pad,innerHeight-r.height-86);
  el.style.left=clamp(parseFloat(el.style.left)||r.left,pad,maxX)+'px';el.style.top=clamp(parseFloat(el.style.top)||r.top,pad,maxY)+'px';el.style.right='auto';el.style.bottom='auto';
}
function speakFloatingOne(step=state.mobileStep){
  const el=$('#oneFloatingGuide'),bubble=$('#oneSpeechBubble'),img=$('#oneFloatingImage'),txt=$('#oneFloatingText');if(!el||!bubble||!img)return;
  clearTimeout(oneSpeechTimer);clearOneIdle();stopOneTalk();oneActivityEpoch++;if(txt)txt.textContent=oneStepLines[step]||'Seguimos';
  el.classList.remove('funny','neutral-wait','bored','blink');el.classList.add('speaking');bubble.classList.add('visible');startOneTalk();
  oneSpeechTimer=setTimeout(()=>{bubble.classList.remove('visible');el.classList.remove('speaking');stopOneTalk();scheduleOneIdle();},3200);
}
function parkFloatingOne(step){
  const el=$('#oneFloatingGuide');if(!el)return;const r=el.getBoundingClientRect();
  const targetX=Math.max(8,innerWidth-r.width-16),targetY=118+(step%2)*38,dx=targetX-r.left,dy=targetY-r.top;
  const travel=el.animate([{transform:'translate3d(0,0,0)'},{transform:`translate3d(${dx}px,${dy}px,0)`}],{duration:720,easing:'cubic-bezier(.22,.8,.25,1)',fill:'forwards'});
  travel.onfinish=()=>{el.style.left=targetX+'px';el.style.top=targetY+'px';el.style.right='auto';el.style.transform='none';travel.cancel();clampFloatingOne();};
}
function initFloatingOne(){
  const el=$('#oneFloatingGuide'),handle=$('#oneDragHandle');if(!el||!handle)return;let drag=null;
  handle.addEventListener('pointerdown',e=>{clearOneIdle();oneActivityEpoch++;const r=el.getBoundingClientRect();drag={id:e.pointerId,dx:e.clientX-r.left,dy:e.clientY-r.top,sx:e.clientX,sy:e.clientY};onePointerMoved=false;oneDragged=true;el.classList.add('dragging');handle.setPointerCapture(e.pointerId);e.preventDefault();});
  handle.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;if(Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)>7)onePointerMoved=true;el.style.left=(e.clientX-drag.dx)+'px';el.style.top=(e.clientY-drag.dy)+'px';el.style.right='auto';clampFloatingOne();});
  const stop=e=>{if(!drag||drag.id!==e.pointerId)return;drag=null;el.classList.remove('dragging');clampFloatingOne();if(!onePointerMoved)speakFloatingOne();else scheduleOneIdle();};
  handle.addEventListener('pointerup',stop);handle.addEventListener('pointercancel',stop);
}

const mobileScreens=[
  ['Documento','#step-document'],['Transformer','#step-transformer'],['Base vectorial','#step-db'],['Pregunta','#step-query'],['Pipeline','#step-query'],['Vectores','#step-vectors'],['Respuesta','#step-answer'],['Dentro de pgvector','#step-db-browser']
];
const journeyMachine=createMachine({
  id:'learningJourney',
  context:{step:0,scroll:false},
  on:{
    NEXT:{guard:({context})=>context.step<mobileScreens.length-1,actions:assign({step:({context})=>context.step+1,scroll:()=>true})},
    PREV:{guard:({context})=>context.step>0,actions:assign({step:({context})=>context.step-1,scroll:()=>true})},
    GOTO:{actions:assign({step:({event})=>clamp(Number(event.step)||0,0,mobileScreens.length-1),scroll:({event})=>event.scroll!==false})}
  }
});
const journeyActor=createActor(journeyMachine);
function applyMobileStep(i,scroll=true){
  state.mobileStep=clamp(i,0,mobileScreens.length-1);
  document.body.dataset.mobileStep=String(state.mobileStep);
  $('#mobileStepTitle').textContent=mobileScreens[state.mobileStep][0];
  $('#mobileStepProgress').textContent=(state.mobileStep+1)+' / '+mobileScreens.length;
  $('#mobilePrev').disabled=state.mobileStep===0;$('#mobileNext').disabled=state.mobileStep===mobileScreens.length-1;
  syncTaskAnimations();
  if(scroll){oneDragged=false;parkFloatingOne(state.mobileStep);setTimeout(()=>speakFloatingOne(state.mobileStep),520);}
  const target=document.querySelector(mobileScreens[state.mobileStep][1]);
  if(target){animate(target,{opacity:[.65,1],transform:['translateY(12px)','translateY(0px)']},{duration:.28});}
  if(scroll&&window.innerWidth<760)target?.scrollIntoView({behavior:'smooth',block:'start'});
}
journeyActor.subscribe(snapshot=>applyMobileStep(snapshot.context.step,snapshot.context.scroll));
journeyActor.start();
function setMobileStep(i,scroll=true){journeyActor.send({type:'GOTO',step:i,scroll});}
$('#mobilePrev').addEventListener('click',()=>journeyActor.send({type:'PREV'}));
$('#mobileNext').addEventListener('click',()=>journeyActor.send({type:'NEXT'}));

$$('#pipeline button').forEach((b,i)=>b.addEventListener('click',()=>{state.stage=i;renderStage();}));
$('#pipelinePrev').addEventListener('click',()=>{state.stage=Math.max(0,state.stage-1);renderStage();});
$('#pipelineNext').addEventListener('click',()=>{state.stage=Math.min(8,state.stage+1);renderStage();});
$('#play').addEventListener('click',()=>{if(state.playTimer){clearInterval(state.playTimer);state.playTimer=null;$('#play').textContent='Recorrer';return;}state.stage=0;renderStage();$('#play').textContent='Pausar';state.playTimer=setInterval(()=>{state.stage++;if(state.stage>8){clearInterval(state.playTimer);state.playTimer=null;state.stage=8;$('#play').textContent='Recorrer';}renderStage();},1100);});
$$('.tab').forEach(b=>b.addEventListener('click',()=>{$$('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.tab=b.dataset.tab;renderTechnical();}));

createIcons({icons:{FileText,Scissors,BrainCircuit,Binary,Database,Search,PackageOpen,Bot,Quote}});
initIngestionScene();
initTransformerScene();
wireRanges();updateDocStats();populateTransformerSentences();setGuide(0);startOneMascotIdle();installTaskAnimations();initFloatingOne();setMobileStep(0,false);parkFloatingOne(0);speakFloatingOne(0);health();renderAll();loadDbBrowser().catch(()=>{});
window.addEventListener('resize',()=>{syncTaskAnimations();clampFloatingOne();});
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
