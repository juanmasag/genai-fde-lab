const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const EXAMPLE_DOC=$('#document').value;
const state={ingest:null,analysis:null,activeDocumentId:null,tab:'chunks',stage:0,guide:0,playTimer:null,dbTimer:null,mobileStep:0,attentionToken:0,transformerSubstep:0};
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
async function previewChunking(){
  const seq=++previewSeq;
  const box=$('#chunkPreview');
  box.innerHTML='<div class="empty-state">Calculando tokens del modelo…</div>';
  try{
    const data=await api('/api/chunk-preview',{text:$('#document').value,chunkSize:+$('#chunkSize').value,overlap:+$('#overlap').value});
    if(seq!==previewSeq)return [];
    const tokenStat=$('#tokenStat');if(tokenStat)tokenStat.textContent=data.tokenCount+' tokens WordPiece';
    const chunks=data.chunks||[];
    const tokenHtml=(c,chunkIndex)=>(c.tokens||[]).map((tok,i)=>{
      const repeatsInNext=c.overlapToNext>0 && i>=Math.max(0,c.tokens.length-c.overlapToNext);
      const repeatedFromPrevious=c.overlapFromPrevious>0 && i<c.overlapFromPrevious;
      const cls=repeatsInNext?'overlap-token overlap-to-next':(repeatedFromPrevious?'overlap-token overlap-from-previous':'');
      const title=repeatsInNext&&chunks[chunkIndex+1]?'Se repite en '+chunks[chunkIndex+1].chunkId:(repeatedFromPrevious&&chunks[chunkIndex-1]?'Repetido desde '+chunks[chunkIndex-1].chunkId:'');
      return '<span class="chunk-token '+cls+'" title="'+esc(title)+'">'+esc(tok)+'</span>';
    }).join('');
    const hasRealOverlap=chunks.some(c=>c.overlapToNext>0);
    const overlapStatus=hasRealOverlap?'':'<p class="no-overlap-note">Con esta configuración cada sección entra en un único chunk; no hay overlap real para resaltar.</p>';
    box.innerHTML=overlapStatus+chunks.map((c,idx)=>{
      const next=chunks[idx+1];
      const sameSection=next&&next.section===c.section;
      const overlapNote=c.overlapToNext>0&&sameSection?'<div class="chunk-overlap-note"><span></span>'+c.overlapToNext+' tokens en verde se repiten en '+esc(next.chunkId)+'</div>':'';
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
  [['chunkSize','chunkSizeOut',0],['overlap','overlapOut',0],['topK','topKOut',0],['threshold','thresholdOut',2]].forEach(([id,out,d])=>{const e=$('#'+id),o=$('#'+out),f=()=>{o.textContent=Number(e.value).toFixed(d);if(id==='chunkSize'||id==='overlap')previewChunking();};e.addEventListener('input',f);f();});
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
function populateTransformerSentences(){
  const sel=$('#transformerSentence'),old=sel.value;
  const options=parseSections($('#document').value).flatMap(s=>s.text.split(/(?<=[.!?])\s+/).map(x=>x.trim()).filter(Boolean)).slice(0,12);
  sel.innerHTML=options.map(x=>'<option value="'+esc(x)+'">'+esc(x.slice(0,68))+(x.length>68?'…':'')+'</option>').join('');
  if(options.includes(old))sel.value=old;
  renderTransformer();
}
function renderTransformer(){
  const text=$('#transformerSentence').value||parseSections($('#document').value)[0]?.text||'';
  const t=toyTransformer(text);if(!t.toks.length)return;
  state.attentionToken=clamp(state.attentionToken,0,t.toks.length-1);
  const f=state.attentionToken;
  const steps=[
    ['1. Tokens',t.toks.map((x,i)=>'<button class="token token-pick '+(i===f?'token-selected':'')+'" data-token="'+i+'">'+i+' · '+esc(x)+'</button>').join('')],
    ['2. Vector inicial','Token elegido: <b>'+esc(t.toks[f])+'</b><br>'+vecStr(baseVector(t.toks[f]))],
    ['3. Posición','Vector posición '+f+' = '+vecStr(positional(f))+'<br>Entrada al transformer = '+vecStr(t.x[f])],
    ['4. Q, K y V','Q = '+vecStr(t.q[f])+'<br>K = '+vecStr(t.k[f])+'<br>V = '+vecStr(t.val[f])],
    ['5. Scores','Cada Q se compara con cada K: score = (Q · K) / sqrt(d). Esos scores todavía no son probabilidades.'],
    ['6. Softmax / atención','Softmax convierte los scores en pesos que suman 1. El heatmap muestra a qué tokens atiende más <b>'+esc(t.toks[f])+'</b>.'],
    ['7. Vector contextual','Se mezclan los V usando esos pesos: Σ peso_j × V_j = '+vecStr(t.ctx[f])],
    ['8. Pooling / salida','Se resumen los vectores contextualizados. Pooling = '+vecStr(t.pooled)+'<br>Proyección didáctica = <b>'+t.scalar.toFixed(4)+'</b>']
  ];
  state.transformerSubstep=clamp(state.transformerSubstep,0,steps.length-1);
  $('#calcSteps').innerHTML='<div class="transformer-step-nav"><button id="tfPrev" class="secondary">Anterior</button><span>'+(state.transformerSubstep+1)+' / 8</span><button id="tfNext" class="primary compact">Siguiente</button></div>'+steps.map(([h,b],i)=>'<div class="calc-card transformer-card '+(i===state.transformerSubstep?'active':'')+'"><strong>'+h+'</strong><div>'+b+'</div></div>').join('');
  $$('.token-pick').forEach(b=>b.addEventListener('click',()=>{state.attentionToken=Number(b.dataset.token);renderTransformer();}));
  $('#tfPrev').disabled=state.transformerSubstep===0;$('#tfNext').disabled=state.transformerSubstep===7;
  $('#tfPrev').addEventListener('click',()=>{state.transformerSubstep=Math.max(0,state.transformerSubstep-1);renderTransformer();});
  $('#tfNext').addEventListener('click',()=>{state.transformerSubstep=Math.min(7,state.transformerSubstep+1);renderTransformer();});
  renderHeatmap(t,f);
  const real=state.ingest?.chunks?.find(c=>c.content.includes(text.slice(0,18)))||state.ingest?.chunks?.[0];
  $('#formulaBox').innerHTML='<strong>Qué es real y qué es didáctico</strong><p>Los pasos 1–8 usan un transformer mínimo de 4 dimensiones para que puedas seguir la matemática. No son los pesos internos de Ollama.</p>'+(real?'<p><b>Embedding real:</b> '+real.dimensions+' dimensiones. Primeros valores: '+real.vectorSample.slice(0,6).map(x=>Number(x).toFixed(4)).join(', ')+'…</p>':'<p>Ejecutá la ingesta para compararlo con el embedding real.</p>');
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
$('#transformerSentence').addEventListener('change',renderTransformer);
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
function renderVectorPlot(){const box=$('#vectorPlot'),legend=$('#vectorLegend');if(!state.analysis){box.innerHTML='<div class="empty-state">Esperando consulta.</div>';legend.innerHTML='';return;}const rows=state.analysis.retrieval.ranked,W=620,H=360,cx=150,cy=180,len=130;let svg='<svg viewBox="0 0 '+W+' '+H+'" role="img"><line x1="'+cx+'" y1="25" x2="'+cx+'" y2="335" stroke="#27344d"/><line x1="20" y1="'+cy+'" x2="590" y2="'+cy+'" stroke="#27344d"/><circle cx="'+cx+'" cy="'+cy+'" r="'+len+'" fill="none" stroke="#27344d" stroke-dasharray="4 5"/><defs><marker id="aq" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="#f8fafc"/></marker><marker id="ac" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="#60a5fa"/></marker></defs><line x1="'+cx+'" y1="'+cy+'" x2="'+(cx+len)+'" y2="'+cy+'" stroke="#f8fafc" stroke-width="4" marker-end="url(#aq)"/><text x="'+(cx+len+12)+'" y="'+(cy+5)+'" fill="#f8fafc" font-size="12">pregunta</text>';rows.forEach((r,i)=>{const sign=i%2===0?-1:1,a=r.angleDeg*Math.PI/180*sign,x=cx+len*Math.cos(a),y=cy+len*Math.sin(a);svg+='<line x1="'+cx+'" y1="'+cy+'" x2="'+x.toFixed(1)+'" y2="'+y.toFixed(1)+'" stroke="'+(r.accepted?'#60a5fa':'#64748b')+'" stroke-width="'+(r.accepted?3:2)+'" opacity="'+(r.accepted?1:.55)+'" marker-end="url(#ac)"/><text x="'+(x+8).toFixed(1)+'" y="'+(y+4).toFixed(1)+'" fill="#b9c7dc" font-size="11">'+esc(r.metadata?.chunk_id||r.rank)+'</text>';});svg+='<text x="18" y="345" fill="#98a6bd" font-size="11">Menor ángulo = mayor similitud coseno</text></svg>';box.innerHTML=svg;legend.innerHTML=rows.map(r=>'<span>'+esc(r.metadata?.chunk_id||r.id)+' · '+r.angleDeg.toFixed(1)+'° · '+fmt(r.similarity)+'</span>').join('');}
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

const mobileScreens=[
  ['Documento','#step-document'],['Transformer','#step-transformer'],['Base vectorial','#step-db'],['Pregunta','#step-query'],['Pipeline','#step-query'],['Vectores','#step-vectors'],['Respuesta','#step-answer'],['Dentro de pgvector','#step-db-browser']
];
function setMobileStep(i,scroll=true){
  state.mobileStep=clamp(i,0,mobileScreens.length-1);
  document.body.dataset.mobileStep=String(state.mobileStep);
  $('#mobileStepTitle').textContent=mobileScreens[state.mobileStep][0];
  $('#mobileStepProgress').textContent=(state.mobileStep+1)+' / '+mobileScreens.length;
  $('#mobilePrev').disabled=state.mobileStep===0;$('#mobileNext').disabled=state.mobileStep===mobileScreens.length-1;
  syncTaskAnimations();
  if(scroll&&window.innerWidth<760)document.querySelector(mobileScreens[state.mobileStep][1])?.scrollIntoView({behavior:'smooth',block:'start'});
}
$('#mobilePrev').addEventListener('click',()=>setMobileStep(state.mobileStep-1));
$('#mobileNext').addEventListener('click',()=>setMobileStep(state.mobileStep+1));

$$('#pipeline button').forEach((b,i)=>b.addEventListener('click',()=>{state.stage=i;renderStage();}));
$('#pipelinePrev').addEventListener('click',()=>{state.stage=Math.max(0,state.stage-1);renderStage();});
$('#pipelineNext').addEventListener('click',()=>{state.stage=Math.min(8,state.stage+1);renderStage();});
$('#play').addEventListener('click',()=>{if(state.playTimer){clearInterval(state.playTimer);state.playTimer=null;$('#play').textContent='Recorrer';return;}state.stage=0;renderStage();$('#play').textContent='Pausar';state.playTimer=setInterval(()=>{state.stage++;if(state.stage>8){clearInterval(state.playTimer);state.playTimer=null;state.stage=8;$('#play').textContent='Recorrer';}renderStage();},1100);});
$$('.tab').forEach(b=>b.addEventListener('click',()=>{$$('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.tab=b.dataset.tab;renderTechnical();}));

wireRanges();updateDocStats();setGuide(0);installTaskAnimations();setMobileStep(0,false);health();renderAll();loadDbBrowser().catch(()=>{});
window.addEventListener('resize',syncTaskAnimations);
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
