const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const state={ingest:null,analysis:null,tab:'chunks',stage:0,playTimer:null};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=n=>Number(n).toFixed(3);

async function api(url,body){
  const r=await fetch(url,{method:body?'POST':'GET',headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
  const j=await r.json().catch(()=>({error:'Respuesta inválida'}));
  if(!r.ok) throw new Error(j.error||('HTTP '+r.status));
  return j;
}

function setBusy(btn,on,label){
  btn.disabled=on;
  if(on){btn.dataset.old=btn.textContent;btn.textContent=label;}
  else if(btn.dataset.old){btn.textContent=btn.dataset.old;}
}

async function health(){
  try{
    const h=await api('/api/health');
    $('#health').className='pill ok';
    $('#health').textContent='● DB '+h.chunks+' chunks · '+h.embedModel+' · '+h.llmModel;
  }catch(e){
    $('#health').className='pill bad';
    $('#health').textContent='● Sistema no disponible';
  }
}

function wireRanges(){
  const pairs=[['chunkSize','chunkSizeOut',0],['overlap','overlapOut',0],['topK','topKOut',0],['threshold','thresholdOut',2]];
  for(const [id,out,digits] of pairs){
    const el=$('#'+id),o=$('#'+out);
    const sync=()=>o.textContent=Number(el.value).toFixed(digits);
    el.addEventListener('input',sync);sync();
  }
}

$('#file').addEventListener('change',async e=>{
  const f=e.target.files?.[0]; if(!f)return;
  $('#title').value=f.name;
  $('#document').value=await f.text();
});

$('#ingest').addEventListener('click',async()=>{
  const btn=$('#ingest'),status=$('#ingestStatus');
  try{
    setBusy(btn,true,'Generando embeddings…');status.className='status-line';status.textContent='Chunking → transformer de embeddings → pgvector…';
    state.ingest=await api('/api/ingest',{title:$('#title').value,text:$('#document').value,chunkSize:+$('#chunkSize').value,overlap:+$('#overlap').value});
    status.className='status-line ok';status.textContent='✓ '+state.ingest.chunks.length+' chunks · '+state.ingest.chunks[0]?.dimensions+' dimensiones · documento #'+state.ingest.documentId;
    renderAll();
    health();
  }catch(e){status.className='status-line bad';status.textContent='Error: '+e.message;}
  finally{setBusy(btn,false);}
});

$('#analyze').addEventListener('click',async()=>{
  const btn=$('#analyze'),status=$('#analysisStatus');
  try{
    setBusy(btn,true,'Ejecutando retrieval + LLM…');status.className='status-line';status.textContent='Embedding de pregunta → similitud → contexto → LLM…';
    state.analysis=await api('/api/analyze',{question:$('#question').value,topK:+$('#topK').value,threshold:+$('#threshold').value});
    status.className='status-line ok';status.textContent='✓ '+state.analysis.retrieval.ranked.length+' candidatos · '+state.analysis.citations.length+' aceptados';
    state.stage=5;renderAll();
  }catch(e){status.className='status-line bad';status.textContent='Error: '+e.message;}
  finally{setBusy(btn,false);}
});

function chunkCards(){
  if(!state.ingest)return '<div class="empty-state">Primero ingerí un documento.</div>';
  return '<div class="cards">'+state.ingest.chunks.map(c=>'<div class="data-card"><strong>'+esc(c.chunkId)+' · '+esc(c.section)+'</strong><p>'+esc(c.content)+'</p><p>'+c.wordStart+'–'+c.wordEnd+' palabras · '+c.dimensions+'D</p></div>').join('')+'</div>';
}

function transformerStage(){
  if(!state.ingest)return '<div class="empty-state">Primero ingerí un documento.</div>';
  return '<div class="cards">'+
   '<div class="data-card"><strong>Entrada</strong><p>Texto del chunk convertido a tokens por el modelo de embeddings.</p></div>'+
   '<div class="data-card"><strong>Transformer real</strong><p><code>nomic-embed-text</code> ejecutado por Ollama. Sus capas producen una representación contextual del texto.</p></div>'+
   '<div class="data-card"><strong>Salida</strong><p>Un embedding de '+state.ingest.chunks[0].dimensions+' dimensiones por chunk.</p></div>'+
   '<div class="data-card"><strong>Lo que no fingimos</strong><p>Ollama no expone aquí las matrices internas de atención. La UI muestra el flujo, no valores inventados.</p></div>'+
   '</div>';
}

function databaseStage(){
  if(!state.ingest)return '<div class="empty-state">Sin datos almacenados.</div>';
  return '<div class="cards">'+state.ingest.chunks.map(c=>'<div class="data-card"><strong>'+esc(c.chunkId)+'</strong><p>source='+esc($('#title').value)+'<br>section='+esc(c.section)+'<br>embedding=vector('+c.dimensions+')</p></div>').join('')+'</div>';
}

function retrievalStage(){
  if(!state.analysis)return '<div class="empty-state">Ejecutá una pregunta.</div>';
  return '<div class="cards">'+state.analysis.retrieval.ranked.map(r=>'<div class="data-card"><strong>#'+r.rank+' '+esc(r.metadata?.chunk_id||r.id)+' · '+fmt(r.similarity)+(r.accepted?' ✓':' ✕')+'</strong><p>Ángulo con la pregunta: '+r.angleDeg.toFixed(1)+'°</p><p>'+esc(r.content)+'</p></div>').join('')+'</div>';
}

function contextStage(){
  if(!state.analysis)return '<div class="empty-state">Ejecutá una pregunta.</div>';
  return '<pre>'+esc(state.analysis.context||'(ningún chunk superó el threshold)')+'</pre>';
}

function llmStage(){
  if(!state.analysis)return '<div class="empty-state">Ejecutá una pregunta.</div>';
  const g=state.analysis.generation;
  return '<div class="cards"><div class="data-card"><strong>Modelo</strong><p>'+esc(state.analysis.models.llm)+'</p></div><div class="data-card"><strong>Entrada</strong><p>'+esc(state.analysis.question)+'</p></div><div class="data-card"><strong>Tokens medidos por Ollama</strong><p>prompt='+(g.prompt_eval_count??'—')+' · salida='+(g.eval_count??'—')+'</p></div><div class="data-card"><strong>Regla</strong><p>Responder sólo con la evidencia recuperada o abstenerse.</p></div></div><div class="answer" style="margin-top:12px">'+esc(g.text)+'</div>';
}

function citationsStage(){
  if(!state.analysis)return '<div class="empty-state">Ejecutá una pregunta.</div>';
  if(!state.analysis.citations.length)return '<div class="empty-state">No hubo evidencia aceptada; el sistema se abstuvo.</div>';
  return '<div class="cards">'+state.analysis.citations.map(c=>'<div class="data-card"><strong>'+esc(c.chunkId)+' · '+fmt(c.similarity)+'</strong><p>'+esc(c.source)+' → '+esc(c.section)+'</p><p>'+esc(c.content)+'</p></div>').join('')+'</div>';
}

function stageHtml(i){
  if(i===0)return '<div class="cards"><div class="data-card"><strong>Documento</strong><p>'+esc($('#title').value)+'</p><p>'+$('#document').value.length+' caracteres.</p></div><div class="data-card"><strong>Objetivo</strong><p>Convertir conocimiento humano en unidades buscables.</p></div></div>';
  if(i===1)return chunkCards();
  if(i===2)return transformerStage();
  if(i===3)return state.ingest?'<div class="cards">'+state.ingest.chunks.map(c=>'<div class="data-card"><strong>'+esc(c.chunkId)+'</strong><p>['+c.vectorSample.slice(0,6).map(x=>Number(x).toFixed(4)).join(', ')+', …]</p><p>Norma ≈ '+c.norm.toFixed(4)+'</p></div>').join('')+'</div>':'<div class="empty-state">Sin embeddings.</div>';
  if(i===4)return databaseStage();
  if(i===5)return retrievalStage();
  if(i===6)return contextStage();
  if(i===7)return llmStage();
  return citationsStage();
}

function renderStage(){
  $$('#pipeline button').forEach((b,i)=>b.classList.toggle('active',i===state.stage));
  $('#stageViewer').innerHTML=stageHtml(state.stage);
}

function renderBars(){
  const box=$('#similarityBars');
  if(!state.analysis){box.innerHTML='<div class="empty-state">Esperando una consulta.</div>';return;}
  box.innerHTML=state.analysis.retrieval.ranked.map(r=>'<div class="bar-row '+(r.accepted?'':'reject')+'"><div class="bar-label">'+esc(r.metadata?.chunk_id||r.id)+'</div><div class="bar-track"><div class="bar-fill" style="width:'+Math.max(0,Math.min(100,r.similarity*100))+'%"></div></div><div class="bar-score">'+fmt(r.similarity)+'</div></div>').join('');
}

function renderVectorPlot(){
  const box=$('#vectorPlot'),legend=$('#vectorLegend');
  if(!state.analysis){box.innerHTML='<div class="empty-state">Todavía no hay vectores comparados.</div>';legend.innerHTML='';return;}
  const rows=state.analysis.retrieval.ranked, W=620,H=360,cx=150,cy=180,len=130;
  let svg='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Comparación angular entre embedding de la pregunta y chunks">';
  svg+='<line x1="'+cx+'" y1="25" x2="'+cx+'" y2="335" stroke="#27344d"/><line x1="20" y1="'+cy+'" x2="590" y2="'+cy+'" stroke="#27344d"/>';
  svg+='<circle cx="'+cx+'" cy="'+cy+'" r="'+len+'" fill="none" stroke="#27344d" stroke-dasharray="4 5"/>';
  svg+='<defs><marker id="arrowQ" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#f8fafc"/></marker><marker id="arrowC" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#60a5fa"/></marker></defs>';
  svg+='<line x1="'+cx+'" y1="'+cy+'" x2="'+(cx+len)+'" y2="'+cy+'" stroke="#f8fafc" stroke-width="4" marker-end="url(#arrowQ)"/><text x="'+(cx+len+12)+'" y="'+(cy+5)+'" fill="#f8fafc" font-size="12">pregunta</text>';
  rows.forEach((r,i)=>{
    const sign=i%2===0?-1:1, ang=(r.angleDeg*Math.PI/180)*sign, x=cx+len*Math.cos(ang), y=cy+len*Math.sin(ang);
    svg+='<line x1="'+cx+'" y1="'+cy+'" x2="'+x.toFixed(1)+'" y2="'+y.toFixed(1)+'" stroke="'+(r.accepted?'#60a5fa':'#64748b')+'" stroke-width="'+(r.accepted?3:2)+'" opacity="'+(r.accepted?1:.65)+'" marker-end="url(#arrowC)"/>';
    svg+='<text x="'+(x+8).toFixed(1)+'" y="'+(y+4).toFixed(1)+'" fill="#b9c7dc" font-size="11">'+esc(r.metadata?.chunk_id||('chunk '+r.rank))+'</text>';
  });
  svg+='<text x="18" y="345" fill="#98a6bd" font-size="11">Menor ángulo = mayor similitud coseno</text></svg>';
  box.innerHTML=svg;
  legend.innerHTML=rows.map(r=>'<span>'+esc(r.metadata?.chunk_id||r.id)+' · '+r.angleDeg.toFixed(1)+'° · sim '+fmt(r.similarity)+'</span>').join('');
}

function renderDimensions(){
  const box=$('#dimensions');
  if(!state.analysis){box.innerHTML='<div class="empty-state">Esperando embeddings.</div>';return;}
  const rows=[{name:'Pregunta',v:state.analysis.questionVector.sample},...state.analysis.retrieval.ranked.slice(0,3).map(r=>({name:r.metadata?.chunk_id||String(r.id),v:r.vectorSample}))];
  let html='<div class="dimension-table"><div class="dim-row dim-head"><span></span>'+Array.from({length:12},(_,i)=>'<div class="dim-cell">d'+(i+1)+'</div>').join('')+'</div>';
  for(const r of rows){
    html+='<div class="dim-row"><span>'+esc(r.name)+'</span>'+r.v.slice(0,12).map(v=>{const h=Math.min(50,Math.abs(v)*240);return '<div class="dim-cell '+(v<0?'neg':'')+'" title="'+Number(v).toFixed(5)+'"><i style="height:'+h+'%"></i></div>';}).join('')+'</div>';
  }
  box.innerHTML=html+'</div>';
}

function renderAnswer(){
  if(!state.analysis){$('#answer').innerHTML='<div class="empty-state">La respuesta aparecerá después del retrieval.</div>';$('#citations').innerHTML='';return;}
  $('#answer').textContent=state.analysis.generation.text;
  $('#citations').innerHTML=state.analysis.citations.map(c=>'<div class="citation"><strong>'+esc(c.chunkId)+' · '+fmt(c.similarity)+' · '+esc(c.source)+' → '+esc(c.section)+'</strong><p>'+esc(c.content)+'</p></div>').join('');
}

function renderTechnical(){
  const box=$('#technical');
  if(state.tab==='chunks'){box.innerHTML=state.ingest?'<pre>'+esc(JSON.stringify(state.ingest.chunks,null,2))+'</pre>':'<div class="empty-state">Sin chunks.</div>';return;}
  if(state.tab==='tokens'){
    const toks=(state.analysis?.questionTokens||[]);
    box.innerHTML=toks.length?toks.map((t,i)=>'<span class="token">'+i+': '+esc(t)+'</span>').join(''):'<div class="empty-state">Ejecutá una pregunta para ver su tokenización aproximada.</div>';return;
  }
  if(state.tab==='database'){box.innerHTML=state.ingest?'<pre>'+esc(state.ingest.chunks.map(c=>({chunk_id:c.chunkId,section:c.section,dimensions:c.dimensions,vector_sample:c.vectorSample})).map(x=>JSON.stringify(x)).join('\n'))+'</pre>':'<div class="empty-state">Sin filas vectoriales.</div>';return;}
  box.innerHTML=state.analysis?'<pre>'+esc(state.analysis.prompt)+'</pre>':'<div class="empty-state">Ejecutá una pregunta para ver el prompt grounded.</div>';
}

function renderAll(){renderStage();renderBars();renderVectorPlot();renderDimensions();renderAnswer();renderTechnical();}

$$('#pipeline button').forEach((b,i)=>b.addEventListener('click',()=>{state.stage=i;renderStage();}));
$('#play').addEventListener('click',()=>{
  if(state.playTimer){clearInterval(state.playTimer);state.playTimer=null;$('#play').textContent='▶ Recorrer';return;}
  state.stage=0;renderStage();$('#play').textContent='⏸ Pausar';
  state.playTimer=setInterval(()=>{state.stage++;if(state.stage>8){clearInterval(state.playTimer);state.playTimer=null;state.stage=8;$('#play').textContent='▶ Recorrer';}renderStage();},1200);
});
$$('.tab').forEach(b=>b.addEventListener('click',()=>{$$('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.tab=b.dataset.tab;renderTechnical();}));

wireRanges();health();renderAll();
if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
