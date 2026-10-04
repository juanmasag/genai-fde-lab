import { animate } from 'motion';

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function plural(n,singular,pluralForm=singular+'s'){
  return Number(n)===1?singular:pluralForm;
}

function previewSummary(ctx){
  const preview=ctx.preview;
  if(!preview?.chunks?.length)return 'Todavía no tenemos una previsualización confirmada.';
  const count=preview.chunks.length;
  if(count===1){
    return 'La previsualización produjo un solo chunk con '+preview.chunkSize+' tokens de tamaño máximo. El overlap está configurado en '+preview.overlap+', pero no entra en juego hasta que exista más de un chunk.';
  }
  return 'La previsualización produjo '+count+' '+plural(count,'chunk')+'. El chunk size está en '+preview.chunkSize+' tokens y el overlap en '+preview.overlap+'. En verde vas a ver exactamente qué tokens se repiten entre chunks consecutivos.';
}

function ingestSummary(ctx){
  const ingest=ctx.ingest;
  if(!ingest)return 'La ingesta todavía no terminó.';
  const rows=Number(ingest.storedRows||0);
  const dims=Number(ingest.chunks?.[0]?.dimensions||0);
  return 'Listo. PostgreSQL confirmó '+rows+' '+plural(rows,'fila')+' en pgvector. Cada chunk quedó acompañado por su metadata y un embedding real de '+dims+' dimensiones.';
}

function analysisSummary(ctx){
  const analysis=ctx.analysis;
  if(!analysis)return 'El análisis todavía no terminó.';
  const ranked=analysis.retrieval?.ranked||[];
  const accepted=ranked.filter(row=>row.accepted);
  const citations=analysis.citations||[];
  return 'Terminó el análisis. La búsqueda comparó '+ranked.length+' '+plural(ranked.length,'candidato')+', '+accepted.length+' superaron el threshold y el resultado final quedó respaldado por '+citations.length+' '+plural(citations.length,'cita')+'.';
}

function topRetrievalSummary(ctx){
  const analysis=ctx.analysis;
  if(!analysis?.retrieval?.ranked?.length)return 'Primero necesitamos ejecutar el análisis E2E para tener vectores reales que comparar.';
  const ranked=analysis.retrieval.ranked;
  const accepted=ranked.filter(row=>row.accepted);
  const best=ranked[0];
  const id=best?.metadata?.chunk_id||best?.id||'el primer chunk';
  const sim=Number(best?.similarity||0).toFixed(3);
  const angle=Number(best?.angleDeg||0).toFixed(1);
  return 'Acá estamos viendo la geometría real del retrieval. '+id+' quedó primero con similitud '+sim+' y un ángulo de '+angle+' grados respecto de la pregunta. Con el threshold actual pasan '+accepted.length+' de '+ranked.length+' candidatos.';
}

function answerSummary(ctx){
  const analysis=ctx.analysis;
  if(!analysis)return 'Todavía no hay una respuesta generada.';
  const model=analysis.models?.llm||'el modelo local';
  const citations=analysis.citations||[];
  const valid=analysis.validation?.citationsValid;
  return 'El contexto aceptado llegó a '+model+'. La respuesta que ves acá fue generada con ese contexto y tiene '+citations.length+' '+plural(citations.length,'cita')+'. '+(valid?'La validación confirma que las referencias usadas por el modelo existen en la evidencia recuperada.':'La validación detectó que las citas necesitan revisión.');
}

function currentToken(ctx){
  const token=ctx.transformerToken;
  return token?String(token):'el token seleccionado';
}

const SCENES=[
  {
    id:'welcome',
    screen:0,
    focus:'#step-document article:first-of-type',
    side:'right',
    gaze:'user',
    narration:ctx=>'Hola. Bienvenido al RAG Engine Lab. Vamos a seguir '+(ctx.title||'un documento')+' desde que entra al sistema hasta que un modelo genera una respuesta usando recuperación aumentada. Vos vas a ejecutar las acciones reales y yo te voy a explicar qué está pasando y dónde mirar.'
  },
  {
    id:'document-source',
    screen:0,
    focus:'#step-document article:first-of-type',
    side:'right',
    narration:ctx=>'Este es el documento fuente. Ahora tiene '+ctx.sections+' '+plural(ctx.sections,'sección')+' y '+ctx.tokenCount+' tokens según el tokenizer del laboratorio. Podés trabajar con este ejemplo o abrir tu propio archivo. Durante todo el recorrido, este contenido será la fuente de verdad que vamos a transformar y consultar.'
  },
  {
    id:'chunk-controls',
    screen:0,
    focus:'#step-document article:nth-of-type(2)',
    side:'left',
    gate:'PREVIEW_READY',
    actionTarget:'#previewChunks',
    narration:ctx=>'Antes de guardar nada, definimos cómo dividir el conocimiento. Chunk size está en '+ctx.chunkSize+' tokens y overlap en '+ctx.overlap+'. Ajustá estos valores si querés experimentar y después tocá Previsualizar chunks. Esa acción consulta el tokenizer real y nos deja ver exactamente dónde quedan los cortes.',
    resultNarration:ctx=>previewSummary(ctx)
  },
  {
    id:'chunk-document',
    screen:0,
    focus:'#ingestionScene',
    ingestion:'document',
    side:'right',
    narration:ctx=>'Ahora empezamos el recorrido visual de la ingesta. En esta primera vista seguimos teniendo el documento completo. Todavía no hay separación lógica: sólo la fuente y sus '+ctx.tokenCount+' tokens.'
  },
  {
    id:'chunk-tokens',
    screen:0,
    focus:'#sceneCanvas',
    ingestion:'tokens',
    side:'right',
    narration:ctx=>'El mismo texto ahora aparece como una secuencia de tokens. Cada bloque corresponde a una unidad que realmente devuelve el tokenizer del preview. Las posiciones son globales, así que podemos seguir cada token antes de agruparlos.'
  },
  {
    id:'chunk-overlap',
    screen:0,
    focus:'#sceneCanvas',
    ingestion:'chunks',
    side:'right',
    narration:ctx=>previewSummary(ctx)+' Mirá especialmente los tokens verdes: son el contexto que pasa de un chunk al siguiente para evitar cortes demasiado bruscos.'
  },
  {
    id:'transformer-intro',
    screen:1,
    focus:'#transformerCalculation',
    side:'left',
    gate:'CALC_OPENED',
    actionTarget:'#transformerCalculation summary',
    narration:ctx=>'Entramos al transformer didáctico. Antes de recorrer sus etapas quiero que abras Ver cálculo. Ahí vas a poder contrastar la animación con los valores numéricos del modelo educativo de cuatro dimensiones. El embedding real de '+(ctx.embeddingDimensions||768)+' dimensiones se mantiene separado para no mezclar demostración con inferencia real.',
    resultNarration:()=> 'Perfecto. Dejamos el cálculo disponible como inspector y ahora vamos a recorrer la transformación paso a paso.'
  },
  {
    id:'tf-tokens',
    screen:1,
    focus:'#transformerSceneCanvas',
    transformer:'tokens',
    side:'left',
    narration:ctx=>'Primero elegimos un token para seguir. Ahora estamos observando '+currentToken(ctx)+'. A partir de este punto vamos a ver cómo deja de ser sólo texto y se convierte en una representación numérica que puede relacionarse con los demás tokens.'
  },
  {
    id:'tf-vector',
    screen:1,
    focus:'#transformerSceneCanvas',
    transformer:'vector',
    side:'left',
    narration:ctx=>currentToken(ctx)+' pasa a un vector inicial. En este laboratorio usamos cuatro dimensiones para poder verlo y calcularlo en pantalla. Es una representación educativa; no estamos mostrando pesos internos del modelo real.'
  },
  {
    id:'tf-position',
    screen:1,
    focus:'#transformerSceneCanvas',
    transformer:'position',
    side:'left',
    narration:ctx=>'Ahora sumamos posición. Eso permite distinguir el mismo token cuando aparece en lugares diferentes de una secuencia. En el gráfico podés ver el vector del token, la señal de posición y el resultado de combinarlos.'
  },
  {
    id:'tf-qkv',
    screen:1,
    focus:'#transformerSceneCanvas',
    transformer:'qkv',
    side:'left',
    narration:ctx=>'De esa representación obtenemos Q, K y V. Q expresa qué busca el token, K qué puede ofrecer cada token y V qué información aporta. Las tres barras que ves salen de transformaciones distintas del mismo estado de entrada.'
  },
  {
    id:'tf-scores',
    screen:1,
    focus:'#transformerSceneCanvas',
    transformer:'scores',
    side:'left',
    narration:ctx=>'Q se compara contra los K y obtenemos scores. Cuanto mayor es el score, mayor es la compatibilidad en este ejemplo antes de normalizar. Seguí las barras: todavía no son probabilidades y no tienen por qué sumar uno.'
  },
  {
    id:'tf-attention',
    screen:1,
    focus:'#transformerSceneCanvas',
    transformer:'attention',
    side:'left',
    narration:ctx=>'Softmax transforma esos scores en pesos de atención que sí suman uno. Los valores más altos resaltan las relaciones que más influyen sobre '+currentToken(ctx)+'. Por eso un token puede incorporar contexto de otros sin dejar de conservar su propia posición.'
  },
  {
    id:'tf-context',
    screen:1,
    focus:'#transformerSceneCanvas',
    transformer:'context',
    side:'left',
    narration:ctx=>'Ahora usamos esos pesos para mezclar los vectores V. El resultado es un vector contextual: '+currentToken(ctx)+' ya no se representa de forma aislada, sino incluyendo información de los tokens a los que prestó atención.'
  },
  {
    id:'tf-pooling',
    screen:1,
    focus:'#transformerSceneCanvas',
    transformer:'pooling',
    side:'left',
    narration:ctx=>'Para cerrar el ejemplo resumimos las representaciones contextualizadas con pooling. Esto sirve para entender la idea de obtener una representación de una secuencia. Abajo seguimos separando este cálculo educativo del embedding real producido por nomic-embed-text.'
  },
  {
    id:'vector-db-action',
    screen:2,
    focus:'#ingestHere',
    side:'right',
    gate:'INGEST_COMPLETED',
    actionTarget:'#ingestHere',
    narration:ctx=>'Ya entendimos cómo llegamos a una representación. Ahora hacelo realmente: tocá Ejecutar ingesta y ver proceso. El backend va a crear los chunks, generar embeddings con nomic-embed-text y escribir las filas dentro de PostgreSQL con pgvector.',
    resultNarration:ctx=>ingestSummary(ctx)
  },
  {
    id:'vector-db-result',
    screen:2,
    focus:'#dbEvents',
    side:'right',
    narration:ctx=>ingestSummary(ctx)+' El registro que ves reproduce los eventos reales de la transacción: inicio, inserts y commit. No es una base ficticia.'
  },
  {
    id:'query-action',
    screen:3,
    focus:'#step-query .query-card',
    side:'left',
    gate:'ANALYSIS_COMPLETED',
    actionTarget:'#analyze',
    narration:ctx=>'Ahora te toca formular la consulta. Podés escribir una pregunta o usar uno de los ejemplos. Top k está en '+ctx.topK+' y el threshold en '+ctx.threshold.toFixed(2)+'. Cuando estés listo, tocá Ejecutar análisis E2E. La pregunta se convertirá en embedding, se comparará con pgvector y sólo los chunks aceptados llegarán al modelo.',
    resultNarration:ctx=>analysisSummary(ctx)
  },
  {
    id:'pipeline',
    screen:4,
    focus:'#stageViewer',
    side:'right',
    pipelineTour:true,
    narration:ctx=>'Este tablero resume el recorrido que acabás de ejecutar. Mientras te lo explico voy a avanzar por sus etapas: documento, chunks, transformer, embeddings, base vectorial, retrieval, contexto, modelo y citas. Cada panel usa los datos reales que ya generaste.'
  },
  {
    id:'vectors',
    screen:5,
    focus:'#vectorPlot',
    side:'left',
    narration:ctx=>topRetrievalSummary(ctx)
  },
  {
    id:'answer',
    screen:6,
    focus:'#answer',
    side:'right',
    narration:ctx=>answerSummary(ctx)+' El objetivo es que puedas relacionar la respuesta final con el contexto y las citas que realmente la sostienen.'
  },
  {
    id:'db-browser',
    screen:7,
    focus:'#step-db-browser .db-table-wrap',
    side:'left',
    narration:ctx=>'Por último podés mirar dentro de pgvector. La tabla consulta PostgreSQL directamente. Cada fila contiene el chunk, su metadata y el vector almacenado. Si abrís una fila vas a poder inspeccionar todas sus dimensiones, no una representación simulada.'
  },
  {
    id:'closing',
    screen:6,
    focus:'#step-answer',
    side:'right',
    gaze:'user',
    narration:ctx=>'Completaste el recorrido guiado. El documento se transformó en chunks, embeddings y filas reales; después la pregunta pasó por retrieval y '+(ctx.llmModel||'el modelo local')+' construyó una respuesta grounded. Podés volver atrás para repetir cualquier explicación o cambiar datos y ejecutar otra experiencia.'
  }
];

export function createOneGuidedLab({
  getContext,
  navigateScreen,
  setIngestionScene,
  setTransformerStage,
  setPipelineStage,
  playPipelineTour
}){
  const guide=$('#oneFloatingGuide');
  const handle=$('#oneDragHandle');
  const bubble=$('#oneSpeechBubble');
  const textNode=$('#oneFloatingText');
  const controls=$('#oneGuideControls');
  const back=$('#oneGuideBack');
  const repeat=$('#oneGuideRepeat');
  const next=$('#oneGuideNext');

  if(!guide||!handle||!bubble||!textNode||!controls||!back||!repeat||!next){
    return {
      start(){},
      emit(){},
      activity(){},
      setState(){},
      destroy(){}
    };
  }

  let sceneIndex=0;
  let speechToken=0;
  let utterance=null;
  let mouthTimer=null;
  let revealTimer=null;
  let safetyTimer=null;
  let bubbleTimer=null;
  let blinkTimer=null;
  let idleTimers=[];
  let pipelineCleanup=null;
  let dragged=false;
  let drag=null;
  let lastNarration='';
  let currentNarrationKind='intro';
  const completed=new Set();

  const context=()=>({
    ...(getContext?.()||{}),
    title:$('#title')?.value||'el documento',
    sections:(getContext?.()?.sections)||0,
    tokenCount:Number(getContext?.()?.tokenCount||0),
    chunkSize:Number($('#chunkSize')?.value||0),
    overlap:Number($('#overlap')?.value||0),
    topK:Number($('#topK')?.value||0),
    threshold:Number($('#threshold')?.value||0),
    preview:getContext?.()?.preview||null,
    ingest:getContext?.()?.ingest||null,
    analysis:getContext?.()?.analysis||null,
    transformerToken:getContext?.()?.transformerToken||'',
    embeddingDimensions:Number(getContext?.()?.embeddingDimensions||768),
    llmModel:getContext?.()?.llmModel||getContext?.()?.analysis?.models?.llm||''
  });

  function scene(){
    return SCENES[sceneIndex]||SCENES[0];
  }

  function setMouth(name='smile'){
    guide.dataset.oneMouth=['happy','rest','smile','o-small','o','open'].includes(name)?name:'smile';
  }

  function setState(name='attentive'){
    guide.dataset.oneState=name;
    if(name==='talking')return;
    setMouth(name==='thinking'||name==='resting'?'rest':'smile');
  }

  function clearIdle(){
    idleTimers.forEach(clearTimeout);
    idleTimers=[];
    clearTimeout(blinkTimer);
    blinkTimer=null;
  }

  function blink(duration=145){
    if(guide.classList.contains('dragging')||guide.classList.contains('speaking'))return;
    guide.classList.add('blink');
    setTimeout(()=>guide.classList.remove('blink'),duration);
  }

  function scheduleBlink(){
    clearTimeout(blinkTimer);
    if(guide.classList.contains('speaking'))return;
    const delayByState={attentive:4800,waiting:6500,curious:3900,resting:8200,listening:4300,thinking:3200};
    const delay=delayByState[guide.dataset.oneState]||5400;
    blinkTimer=setTimeout(()=>{
      blink(guide.dataset.oneState==='resting'?190:140);
      scheduleBlink();
    },delay);
  }

  function scheduleIdle(){
    clearIdle();
    setState('attentive');
    setGazeToFocus();
    scheduleBlink();
    const later=(delay,name)=>idleTimers.push(setTimeout(()=>{
      if(guide.classList.contains('speaking')||guide.classList.contains('dragging'))return;
      setState(name);
      setGazeToFocus();
      scheduleBlink();
    },delay));
    later(12000,'waiting');
    later(28000,'curious');
    later(48000,'resting');
    later(70000,'attentive');
  }

  function preferredVoice(){
    if(!('speechSynthesis' in window))return null;
    const voices=window.speechSynthesis.getVoices?.()||[];
    return voices.find(v=>/^es-AR$/i.test(v.lang))
      ||voices.find(v=>/^es-/i.test(v.lang))
      ||voices.find(v=>/spanish|español/i.test(v.name))
      ||null;
  }

  function visemeAt(phrase,index=0){
    const tail=String(phrase).slice(Math.max(0,index));
    const ch=(tail.match(/[a-záéíóúüñ]/i)||[''])[0].toLowerCase();
    if(/[mbp]/.test(ch))return'rest';
    if(/[oóuú]/.test(ch))return'o';
    if(/[eéií]/.test(ch))return'smile';
    if(/[aá]/.test(ch))return'open';
    return'o-small';
  }

  function stopSpeech({cancel=true}={}){
    clearInterval(mouthTimer);mouthTimer=null;
    clearInterval(revealTimer);revealTimer=null;
    clearTimeout(safetyTimer);safetyTimer=null;
    clearTimeout(bubbleTimer);bubbleTimer=null;
    if(cancel&&'speechSynthesis' in window){
      speechToken++;
      try{window.speechSynthesis.cancel();}catch{}
    }
    utterance=null;
    guide.classList.remove('speaking');
    setMouth('smile');
  }

  function revealThroughChar(phrase,index){
    const safe=Math.max(0,Math.min(Number(index)||0,phrase.length));
    let end=safe;
    while(end<phrase.length&&!/\s/.test(phrase[end]))end++;
    const visible=phrase.slice(0,end).trim();
    if(visible.length>=textNode.textContent.length)textNode.textContent=visible;
  }

  function startProgressiveText(phrase){
    textNode.textContent='';
    const wordMatches=[...phrase.matchAll(/\S+/g)];
    let wordIndex=0;
    const revealWord=()=>{
      if(wordIndex>=wordMatches.length)return;
      const match=wordMatches[wordIndex++];
      const end=match.index+match[0].length;
      textNode.textContent=phrase.slice(0,end);
      placeBubble();
    };
    revealWord();
    const pace=clamp(phrase.length/Math.max(1,wordMatches.length)*28,155,285);
    revealTimer=setInterval(revealWord,pace);
  }

  function finishSpeech(token){
    if(token!==speechToken)return;
    clearInterval(mouthTimer);mouthTimer=null;
    clearInterval(revealTimer);revealTimer=null;
    clearTimeout(safetyTimer);safetyTimer=null;
    utterance=null;

    textNode.textContent=lastNarration;
    guide.classList.remove('speaking','blink');
    setMouth('smile');
    setState('attentive');
    setGazeToFocus();

    bubbleTimer=setTimeout(()=>{
      if(token!==speechToken)return;
      bubble.classList.remove('visible');
      showControls();
      scheduleIdle();
    },620);
  }

  function narrate(phrase,{kind='intro'}={}){
    const clean=String(phrase||'').trim();
    if(!clean)return;
    stopSpeech();
    clearIdle();
    hideControls();
    currentNarrationKind=kind;
    lastNarration=clean;
    const token=++speechToken;

    setState('talking');
    guide.classList.add('speaking');
    bubble.classList.add('visible');
    startProgressiveText(clean);
    placeBubble();

    let cursor=0;
    const mouthFallback=['smile','open','o-small','happy','o','smile','open','rest'];
    mouthTimer=setInterval(()=>{
      if(token!==speechToken)return;
      cursor=(cursor+2)%Math.max(2,clean.length);
      setMouth(cursor%5===0?visemeAt(clean,cursor):mouthFallback[cursor%mouthFallback.length]);
    },112);

    const canSpeak='speechSynthesis' in window&&'SpeechSynthesisUtterance' in window;
    if(canSpeak){
      try{window.speechSynthesis.cancel();}catch{}
      const u=new SpeechSynthesisUtterance(clean);
      utterance=u;
      const voice=preferredVoice();
      if(voice)u.voice=voice;
      u.lang=voice?.lang||'es-AR';
      u.rate=.98;
      u.pitch=1.03;
      u.volume=1;
      u.onboundary=event=>{
        if(token!==speechToken)return;
        const idx=Number(event.charIndex)||0;
        revealThroughChar(clean,idx);
        setMouth(visemeAt(clean,idx));
      };
      u.onend=()=>finishSpeech(token);
      u.onerror=()=>finishSpeech(token);
      window.speechSynthesis.speak(u);
      safetyTimer=setTimeout(()=>finishSpeech(token),Math.max(4500,Math.min(30000,clean.length*95)));
    }else{
      safetyTimer=setTimeout(()=>finishSpeech(token),Math.max(2800,Math.min(22000,clean.length*72)));
    }
  }

  function resolveTarget(sceneDef=scene()){
    const selector=typeof sceneDef.focus==='function'?sceneDef.focus(context()):sceneDef.focus;
    return selector?$(selector):null;
  }

  function clearFocus(){
    $$('.one-focus-target').forEach(el=>el.classList.remove('one-focus-target'));
    $$('.one-action-required').forEach(el=>el.classList.remove('one-action-required'));
  }

  function markFocus(sceneDef=scene()){
    clearFocus();
    const target=resolveTarget(sceneDef);
    target?.classList.add('one-focus-target');
    if(sceneDef.gate&&!gateSatisfied(sceneDef)){
      $(sceneDef.actionTarget)?.classList.add('one-action-required');
    }
  }

  function updateFacingFromPosition(forceSide=null){
    const r=guide.getBoundingClientRect();
    const center=r.left+r.width/2;
    const old=guide.dataset.oneSide||'left';
    let side=forceSide||old;
    if(!forceSide){
      if(old==='left'&&center>innerWidth*.58)side='right';
      else if(old==='right'&&center<innerWidth*.42)side='left';
    }
    guide.dataset.oneSide=side;
    guide.dataset.oneFacing=side==='right'?'left':'right';
    setGazeToFocus();
  }

  function setGazeToFocus(){
    const sceneDef=scene();
    if(sceneDef.gaze==='user'){
      guide.style.setProperty('--one-gaze-x','0px');
      guide.style.setProperty('--one-gaze-y','0px');
      return;
    }
    const target=resolveTarget(sceneDef);
    if(!target){
      guide.style.setProperty('--one-gaze-x','0px');
      guide.style.setProperty('--one-gaze-y','0px');
      return;
    }
    const tr=target.getBoundingClientRect();
    const gr=guide.getBoundingClientRect();
    const screenDx=(tr.left+tr.width/2)-(gr.left+gr.width/2);
    const screenDy=(tr.top+tr.height/2)-(gr.top+gr.height*.47);
    const faceScale=guide.dataset.oneSide==='right'?-1:1;
    const localX=clamp(screenDx/180,-1,1)*2.4*faceScale;
    const localY=clamp(screenDy/220,-1,1)*1.8;
    guide.style.setProperty('--one-gaze-x',localX.toFixed(2)+'px');
    guide.style.setProperty('--one-gaze-y',localY.toFixed(2)+'px');
  }

  async function moveToScene(sceneDef=scene()){
    const target=resolveTarget(sceneDef);
    if(target){
      target.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});
      await sleep(innerWidth<760?430:250);
    }

    const current=guide.getBoundingClientRect();
    const topPad=82;
    const bottomPad=96;
    const pad=8;
    const targetRect=target?.getBoundingClientRect();
    let side=sceneDef.side;
    if(!side&&targetRect){
      side=(targetRect.left+targetRect.width/2)<innerWidth/2?'right':'left';
    }
    side=side||guide.dataset.oneSide||'right';

    const x=side==='right'
      ?Math.max(pad,innerWidth-current.width-10)
      :pad;

    let y=clamp(parseFloat(guide.style.top)||118,topPad,Math.max(topPad,innerHeight-current.height-bottomPad));
    if(targetRect){
      const centered=targetRect.top+Math.min(targetRect.height*.35,150)-current.height/2;
      y=clamp(centered,topPad,Math.max(topPad,innerHeight-current.height-bottomPad));
    }

    const fromX=current.left;
    const fromY=current.top;
    const dx=x-fromX;
    const dy=y-fromY;

    hideControls();
    guide.classList.add('moving');
    const facingTimer=setInterval(()=>updateFacingFromPosition(),50);
    const motion=guide.animate(
      [
        {transform:'translate3d(0,0,0) scale(1)'},
        {transform:'translate3d('+(dx*.88)+'px,'+(dy*.88)+'px,0) scale(.985)',offset:.78},
        {transform:'translate3d('+dx+'px,'+dy+'px,0) scale(1)'}
      ],
      {duration:620,easing:'cubic-bezier(.22,.8,.25,1)',fill:'forwards'}
    );
    await motion.finished.catch(()=>{});
    clearInterval(facingTimer);
    guide.style.left=x+'px';
    guide.style.top=y+'px';
    guide.style.right='auto';
    guide.style.bottom='auto';
    guide.style.transform='none';
    motion.cancel();
    guide.classList.remove('moving');
    updateFacingFromPosition(side);
    setGazeToFocus();
    placeBubble();
  }

  function placeBubble(){
    const r=guide.getBoundingClientRect();
    const pad=12;
    const gap=8;
    const desired=innerWidth<760?210:310;
    const width=Math.min(desired,innerWidth-pad*2);
    bubble.style.width=width+'px';
    bubble.style.maxWidth=width+'px';
    bubble.style.position='fixed';
    bubble.style.right='auto';
    bubble.style.bottom='auto';

    const height=Math.min(Math.max(bubble.scrollHeight||80,76),innerHeight-pad*2);
    let top=r.top-height-gap;
    let arrow='above';
    if(top<pad){
      top=r.bottom+gap;
      arrow='below';
    }
    top=clamp(top,pad,Math.max(pad,innerHeight-height-pad));
    const left=clamp(r.left+r.width/2-width/2,pad,Math.max(pad,innerWidth-width-pad));
    bubble.style.left=left+'px';
    bubble.style.top=top+'px';
    bubble.dataset.side=arrow;
  }

  function gateSatisfied(sceneDef=scene()){
    if(!sceneDef.gate)return true;
    if(sceneDef.gate==='CALC_OPENED'&&$('#transformerCalculation')?.open)return true;
    return completed.has(sceneDef.gate);
  }

  function updateControls(){
    const sceneDef=scene();
    back.disabled=sceneIndex===0;
    repeat.disabled=!lastNarration;
    next.disabled=!gateSatisfied(sceneDef);
    next.textContent=sceneIndex===SCENES.length-1?'Finalizado':'Siguiente';
    if(sceneIndex===SCENES.length-1)next.disabled=true;
  }

  function hideControls(){
    controls.classList.remove('visible');
    controls.setAttribute('aria-hidden','true');
  }

  function showControls(){
    updateControls();
    controls.classList.add('visible');
    controls.setAttribute('aria-hidden','false');
  }

  function stopPipelineTour(){
    if(typeof pipelineCleanup==='function')pipelineCleanup();
    pipelineCleanup=null;
  }

  async function applyScene(index,{speak=true}={}){
    stopPipelineTour();
    stopSpeech();
    clearIdle();
    sceneIndex=clamp(index,0,SCENES.length-1);
    const sceneDef=scene();
    document.body.dataset.oneScene=sceneDef.id;

    navigateScreen?.(sceneDef.screen,false);
    if(sceneDef.ingestion)setIngestionScene?.(sceneDef.ingestion);
    if(sceneDef.transformer)setTransformerStage?.(sceneDef.transformer);
    if(sceneDef.pipelineTour)setPipelineStage?.(0);

    await sleep(50);
    markFocus(sceneDef);
    await moveToScene(sceneDef);

    if(sceneDef.pipelineTour){
      pipelineCleanup=playPipelineTour?.()||null;
    }

    const phrase=typeof sceneDef.narration==='function'?sceneDef.narration(context()):sceneDef.narration;
    if(speak)narrate(phrase,{kind:'intro'});
    else{
      lastNarration=String(phrase||'');
      showControls();
      scheduleIdle();
    }
  }

  function eventResultNarration(sceneDef,event,payload){
    if(!sceneDef.resultNarration)return null;
    const phrase=typeof sceneDef.resultNarration==='function'
      ?sceneDef.resultNarration(context(),event,payload)
      :sceneDef.resultNarration;
    return String(phrase||'').trim();
  }

  function emit(event,payload={}){
    if(['PREVIEW_READY','CALC_OPENED','INGEST_COMPLETED','ANALYSIS_COMPLETED'].includes(event)){
      completed.add(event);
    }

    if(event==='INGEST_STARTED'||event==='ANALYSIS_STARTED'){
      stopSpeech();
      clearIdle();
      hideControls();
      bubble.classList.remove('visible');
      setState('thinking');
      setGazeToFocus();
      scheduleBlink();
      return;
    }

    if(event==='INGEST_FAILED'||event==='ANALYSIS_FAILED'){
      setState('curious');
      narrate('La operación no terminó correctamente. Revisá el mensaje de error de la sección y volvé a intentarlo.',{kind:'error'});
      return;
    }

    if(event==='DOCUMENT_OPENED'||event==='DOCUMENT_RESTORED'||event==='PARAMETER_CHANGED'){
      activity('listening');
    }

    const sceneDef=scene();
    if(event===sceneDef.gate){
      $(sceneDef.actionTarget)?.classList.remove('one-action-required');
      updateControls();
      const result=eventResultNarration(sceneDef,event,payload);
      if(result){
        narrate(result,{kind:'result'});
      }else{
        showControls();
        scheduleIdle();
      }
    }
  }

  function activity(name='attentive'){
    if(guide.classList.contains('speaking'))return;
    clearIdle();
    setState(name);
    setGazeToFocus();
    scheduleBlink();
    idleTimers.push(setTimeout(scheduleIdle,4200));
  }

  function repeatCurrent(){
    if(guide.classList.contains('speaking'))return;
    const sceneDef=scene();
    let phrase=lastNarration;
    if(!phrase){
      phrase=typeof sceneDef.narration==='function'?sceneDef.narration(context()):sceneDef.narration;
    }
    narrate(phrase,{kind:currentNarrationKind});
  }

  function nextScene(){
    if(guide.classList.contains('speaking')||!gateSatisfied(scene())||sceneIndex>=SCENES.length-1)return;
    applyScene(sceneIndex+1);
  }

  function previousScene(){
    if(guide.classList.contains('speaking')||sceneIndex<=0)return;
    applyScene(sceneIndex-1);
  }

  function installDrag(){
    handle.addEventListener('pointerdown',event=>{
      stopSpeech();
      clearIdle();
      bubble.classList.remove('visible');
      hideControls();
      const r=guide.getBoundingClientRect();
      drag={id:event.pointerId,dx:event.clientX-r.left,dy:event.clientY-r.top,sx:event.clientX,sy:event.clientY};
      dragged=false;
      guide.classList.add('dragging');
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    handle.addEventListener('pointermove',event=>{
      if(!drag||drag.id!==event.pointerId)return;
      if(Math.hypot(event.clientX-drag.sx,event.clientY-drag.sy)>7)dragged=true;
      const r=guide.getBoundingClientRect();
      const x=clamp(event.clientX-drag.dx,8,Math.max(8,innerWidth-r.width-8));
      const y=clamp(event.clientY-drag.dy,70,Math.max(70,innerHeight-r.height-92));
      guide.style.left=x+'px';
      guide.style.top=y+'px';
      guide.style.right='auto';
      updateFacingFromPosition();
      setGazeToFocus();
    });
    const end=event=>{
      if(!drag||drag.id!==event.pointerId)return;
      drag=null;
      guide.classList.remove('dragging');
      updateFacingFromPosition();
      if(!dragged)repeatCurrent();
      else{
        showControls();
        scheduleIdle();
      }
    };
    handle.addEventListener('pointerup',end);
    handle.addEventListener('pointercancel',end);
  }

  function start(){
    document.body.classList.add('one-guided-active');
    installDrag();
    back.addEventListener('click',previousScene);
    repeat.addEventListener('click',repeatCurrent);
    next.addEventListener('click',nextScene);
    if('speechSynthesis' in window&&window.speechSynthesis.addEventListener){
      window.speechSynthesis.addEventListener('voiceschanged',preferredVoice);
    }
    applyScene(0);
  }

  function destroy(){
    stopPipelineTour();
    stopSpeech();
    clearIdle();
    clearFocus();
  }

  window.addEventListener('resize',()=>{
    updateFacingFromPosition();
    setGazeToFocus();
    if(bubble.classList.contains('visible'))placeBubble();
  });

  return {
    start,
    emit,
    activity,
    setState,
    repeat:repeatCurrent,
    next:nextScene,
    back:previousScene,
    destroy,
    getScene:()=>scene().id
  };
}
