import { naturalSpeechText } from './one-speech-text.js';
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
    return 'La previsualización produjo un solo chunk. Un chunk es un fragmento de texto que tratamos como unidad de recuperación. Con un solo chunk, el overlap todavía no tiene un límite donde repetirse.';
  }
  return 'La previsualización produjo '+count+' '+plural(count,'chunk')+'. Cada chunk tiene como máximo '+preview.chunkSize+' tokens y comparte '+preview.overlap+' tokens de overlap con el siguiente cuando corresponde. Los tokens verdes muestran esa repetición.';
}

function ingestSummary(ctx){
  const ingest=ctx.ingest;
  if(!ingest)return 'La ingesta todavía no terminó.';
  const rows=Number(ingest.storedRows||0);
  const dims=Number(ingest.chunks?.[0]?.dimensions||0);
  return 'La ingesta terminó correctamente. PostgreSQL confirmó '+rows+' '+plural(rows,'fila')+' en pgvector. Cada fila contiene un chunk, su metadata y un embedding real de '+dims+' dimensiones.';
}

function analysisSummary(ctx){
  const analysis=ctx.analysis;
  if(!analysis)return 'El análisis todavía no terminó.';
  const ranked=analysis.retrieval?.ranked||[];
  const accepted=ranked.filter(row=>row.accepted);
  const citations=analysis.citations||[];
  return 'Terminó el análisis E2E. Retrieval comparó '+ranked.length+' '+plural(ranked.length,'candidato')+'. El threshold dejó pasar '+accepted.length+' y la respuesta quedó respaldada por '+citations.length+' '+plural(citations.length,'cita')+'.';
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
  return 'La similitud coseno compara la dirección de dos vectores, no sus palabras literalmente. Cuanto menor es el ángulo, más parecida es su dirección semántica. En este caso '+id+' quedó primero con similitud '+sim+' y '+angle+' grados. Con el threshold actual pasan '+accepted.length+' de '+ranked.length+' candidatos.';
}

function answerSummary(ctx){
  const analysis=ctx.analysis;
  if(!analysis)return 'Todavía no hay una respuesta generada.';
  const model=analysis.models?.llm||'el modelo local';
  const citations=analysis.citations||[];
  const valid=analysis.validation?.citationsValid;
  return 'Grounding significa obligar al modelo a responder apoyándose en evidencia recuperada, en vez de contestar sólo desde su conocimiento interno. El contexto aceptado llegó a '+model+' y la respuesta usa '+citations.length+' '+plural(citations.length,'cita')+'. '+(valid?'La validación confirma que las referencias citadas existen en la evidencia recuperada.':'La validación detectó citas que necesitan revisión.');
}

function currentToken(ctx){
  const token=ctx.transformerToken;
  return token?String(token):'el token seleccionado';
}

const PIPELINE_TOUR=[
  {stage:0,text:'Documento es la fuente de conocimiento que queremos consultar. En RAG, esa fuente puede ser documentación interna, manuales, contratos o cualquier contenido que el modelo no debería inventar.'},
  {stage:1,text:'Chunks son fragmentos manejables del documento. Los cortamos para recuperar sólo la parte relevante en vez de enviar todo el documento al modelo.'},
  {stage:2,text:'El transformer aporta contexto a los tokens. En el ejemplo didáctico podés ver atención, Q, K, V y cómo cambia la representación de un token según los demás.'},
  {stage:3,text:'Un embedding es un vector numérico que representa significado. Textos semánticamente parecidos tienden a quedar cerca en ese espacio vectorial.'},
  {stage:4,text:'La base vectorial guarda esos embeddings junto con el texto y la metadata. Acá usamos PostgreSQL con pgvector para almacenarlos y compararlos de verdad.'},
  {stage:5,text:'Retrieval significa recuperación. La pregunta también se convierte en vector y buscamos los chunks más similares según top k y el threshold.'},
  {stage:6,text:'Contexto es el conjunto de chunks que superó el filtro. Sólo esa evidencia se incorpora al prompt que recibe el modelo.'},
  {stage:7,text:'El LLM genera la respuesta usando el contexto recuperado. Esa separación es la clave de RAG: recuperar primero y generar después.'},
  {stage:8,text:'Las citas cierran el circuito. Nos permiten comprobar qué chunk respalda cada afirmación y detectar cuando el modelo intenta citar evidencia que no fue recuperada.'}
];

const SCENES=[
  {
    id:'welcome',
    screen:0,
    focus:'#step-document article:first-of-type',
    side:'right',
    gaze:'user',
    narration:()=> 'Hola. Bienvenido al RAG Engine Lab. RAG significa Retrieval-Augmented Generation, o Generación Aumentada por Recuperación. Es una arquitectura que permite que una IA busque información externa antes de responder. En el trabajo con IA sirve para usar documentación privada o actual, reducir respuestas inventadas y exigir evidencia verificable. En este laboratorio vas a seguir un documento desde la fuente hasta una respuesta grounded. Vos vas a ejecutar las acciones reales. Yo voy a explicarte qué significa cada concepto, qué está pasando y dónde mirar.'
  },
  {
    id:'document-source',
    screen:0,
    focus:'#step-document article:first-of-type',
    side:'right',
    narration:ctx=>'Empezamos por el documento fuente. Es la información que queremos que la IA pueda consultar. Ahora tiene '+ctx.sections+' '+(ctx.sections===1?'sección':'secciones')+' y '+ctx.tokenCount+' tokens según el tokenizer del laboratorio. Podés usar este ejemplo o abrir tu propio archivo. Durante todo el recorrido, este contenido será la fuente de verdad.'
  },
  {
    id:'chunk-controls',
    screen:0,
    focus:'#step-document article:nth-of-type(2)',
    side:'left',
    gate:'PREVIEW_READY',
    actionTarget:'#previewChunks',
    narration:ctx=>'Antes de guardar nada necesitamos dividir el documento. Un chunk es un fragmento de texto que después podremos buscar de forma independiente. Chunk size define cuántos tokens puede contener cada fragmento y ahora está en '+ctx.chunkSize+'. Overlap significa repetir parte del final de un chunk al principio del siguiente para no perder contexto en el corte. Ahora está en '+ctx.overlap+' tokens. Ajustá los valores si querés experimentar y después tocá Previsualizar chunks.',
    resultNarration:ctx=>previewSummary(ctx)
  },
  {
    id:'chunk-document',
    screen:0,
    focus:'#ingestionScene',
    ingestion:'document',
    side:'right',
    narration:ctx=>'Ahora empezamos el recorrido visual de la ingesta. Ingesta significa incorporar una fuente al sistema para que después pueda recuperarse. En esta primera vista seguimos teniendo el documento completo con '+ctx.tokenCount+' tokens. Todavía no existe ningún corte.'
  },
  {
    id:'chunk-tokens',
    screen:0,
    focus:'#sceneCanvas',
    ingestion:'tokens',
    side:'right',
    narration:ctx=>'Un token es una unidad de texto que procesa el modelo. No siempre coincide con una palabra completa: una palabra puede convertirse en uno o varios tokens. Cada bloque que ves es un token real del preview y el número indica su posición global antes de formar los chunks.'
  },
  {
    id:'chunk-overlap',
    screen:0,
    focus:'#sceneCanvas',
    ingestion:'chunks',
    side:'right',
    narration:ctx=>previewSummary(ctx)+' El objetivo no es cortar por cortar, sino conservar suficiente contexto para que cada fragmento siga teniendo sentido cuando lo recuperemos por separado.'
  },
  {
    id:'transformer-intro',
    screen:1,
    focus:'#transformerCalculation',
    side:'left',
    gate:'CALC_OPENED',
    actionTarget:'#transformerCalculation summary',
    narration:ctx=>'Un transformer es la arquitectura que permite relacionar tokens entre sí y construir representaciones dependientes del contexto. Antes de recorrerlo, abrí Ver cálculo. Ahí vas a contrastar la animación con un modelo educativo de cuatro dimensiones. El embedding real de '+(ctx.embeddingDimensions||768)+' dimensiones se mantiene separado para no confundir la explicación visual con la inferencia real.',
    resultNarration:()=> 'Perfecto. Dejamos el cálculo abierto como inspector. Ahora vamos a seguir un token y ver cómo atención transforma su representación paso a paso.'
  },
  {
    id:'tf-tokens',
    screen:1,
    focus:'#transformerSceneCanvas',
    transformer:'tokens',
    side:'left',
    narration:ctx=>'Primero elegimos un token para seguir. Ahora observamos '+currentToken(ctx)+'. Tokenizar es convertir el texto en las unidades que puede procesar el modelo. Desde acá vamos a ver cómo ese token incorpora contexto de los demás.'
  },
  {
    id:'tf-vector',
    screen:1,
    focus:'#transformerSceneCanvas',
    transformer:'vector',
    side:'left',
    narration:ctx=>'Cada token empieza con una representación numérica. '+currentToken(ctx)+' pasa a un vector inicial. Un vector es simplemente una lista ordenada de números. En este laboratorio usamos cuatro dimensiones para poder verlo y calcularlo en pantalla.'
  },
  {
    id:'tf-position',
    screen:1,
    focus:'#transformerSceneCanvas',
    transformer:'position',
    side:'left',
    narration:ctx=>'El transformer también necesita saber dónde aparece cada token. Por eso sumamos información de posición. Así puede distinguir el mismo token cuando aparece en lugares diferentes de una secuencia.'
  },
  {
    id:'tf-qkv',
    screen:1,
    focus:'#transformerSceneCanvas',
    transformer:'qkv',
    side:'left',
    narration:ctx=>'Ahora aparecen Query, Key y Value, normalmente abreviados Q, K y V. Query representa qué busca el token. Key representa qué puede ofrecer cada token. Value contiene la información que finalmente se mezcla. Las tres transformaciones parten del mismo estado de entrada.'
  },
  {
    id:'tf-scores',
    screen:1,
    focus:'#transformerSceneCanvas',
    transformer:'scores',
    side:'left',
    narration:ctx=>'Q se compara contra los K y produce scores de compatibilidad. Un score alto significa que, para este ejemplo, esa relación merece más atención. Todavía no son probabilidades y no tienen por qué sumar uno.'
  },
  {
    id:'tf-attention',
    screen:1,
    focus:'#transformerSceneCanvas',
    transformer:'attention',
    side:'left',
    narration:ctx=>'Softmax convierte los scores en pesos de atención que sí suman uno. Los pesos más altos indican qué tokens influyen más sobre '+currentToken(ctx)+'. Esto es lo que permite que una palabra cambie su representación según el contexto que la rodea.'
  },
  {
    id:'tf-context',
    screen:1,
    focus:'#transformerSceneCanvas',
    transformer:'context',
    side:'left',
    narration:ctx=>'Con esos pesos mezclamos los vectores Value. El resultado es un vector contextual. '+currentToken(ctx)+' ya no se representa de forma aislada: ahora incluye información de los tokens a los que prestó atención.'
  },
  {
    id:'tf-pooling',
    screen:1,
    focus:'#transformerSceneCanvas',
    transformer:'pooling',
    side:'left',
    narration:ctx=>'Pooling significa resumir varias representaciones en una sola. Acá lo usamos para entender la idea de representar una secuencia completa. Abajo seguimos separando este cálculo educativo del embedding real producido por nomic-embed-text.'
  },
  {
    id:'vector-db-action',
    screen:2,
    focus:'#ingestHere',
    side:'right',
    gate:'INGEST_COMPLETED',
    actionTarget:'#ingestHere',
    narration:ctx=>'Ahora pasamos de la explicación a una operación real. pgvector es una extensión de PostgreSQL que permite guardar vectores y compararlos por distancia o similitud. Tocá Ejecutar ingesta y ver proceso. El backend va a crear los chunks, generar sus embeddings y escribir texto, metadata y vectores dentro de PostgreSQL. Mientras ocurre te voy a mostrar en qué fase real estamos.',
    resultNarration:ctx=>ingestSummary(ctx)
  },
  {
    id:'vector-db-result',
    screen:2,
    focus:'#dbEvents',
    side:'right',
    narration:ctx=>ingestSummary(ctx)+' El registro que ves corresponde a la transacción real: BEGIN inicia la transacción, cada INSERT escribe datos y COMMIT confirma que todo quedó persistido.'
  },
  {
    id:'query-action',
    screen:3,
    focus:'#step-query .query-card',
    side:'left',
    gate:'ANALYSIS_COMPLETED',
    actionTarget:'#analyze',
    narration:ctx=>'Ahora formulamos la pregunta. Top k indica cuántos vecinos candidatos queremos recuperar y está en '+ctx.topK+'. Threshold es el mínimo de similitud que exigimos para aceptar un candidato y está en '+ctx.threshold.toFixed(2)+'. Cuando toques Ejecutar análisis E2E, la pregunta se convertirá en embedding, pgvector buscará vecinos, filtraremos evidencia y recién entonces el LLM generará la respuesta. Mientras espera, ONE te va a mostrar la fase real que está ejecutándose.',
    resultNarration:ctx=>analysisSummary(ctx)
  },
  {
    id:'pipeline',
    screen:4,
    focus:'#stageViewer',
    side:'right',
    pipelineTour:true,
    narration:()=> 'Este tablero reúne todo el recorrido. Ahora lo voy a repasar etapa por etapa y la visualización va a cambiar exactamente con la parte que estoy explicando.'
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
    narration:ctx=>answerSummary(ctx)+' La idea es que puedas ir desde cada afirmación de la respuesta hasta la evidencia que la sostiene.'
  },
  {
    id:'db-browser',
    screen:7,
    focus:'#step-db-browser .db-table-wrap',
    side:'left',
    narration:ctx=>'Metadata son datos que describen al chunk además de su texto, por ejemplo fuente, sección, posiciones y cantidad de tokens. En esta vista podés mirar dentro de pgvector. La tabla consulta PostgreSQL directamente y cada fila contiene texto, metadata y el vector almacenado. Si abrís una fila podés inspeccionar todas sus dimensiones.'
  },
  {
    id:'closing',
    screen:6,
    focus:'#step-answer',
    side:'right',
    gaze:'user',
    narration:ctx=>'Completaste el recorrido guiado. Viste cómo RAG conecta recuperación y generación: primero transformamos el documento en evidencia buscable, después recuperamos sólo lo relevante y finalmente '+(ctx.llmModel||'el modelo local')+' respondió usando ese contexto. Podés volver atrás, repetir una explicación o reiniciar el recorrido con otros parámetros.'
  }
];

export function createOneGuidedLab({
  getContext,
  navigateScreen,
  setIngestionScene,
  setTransformerStage,
  setPipelineStage
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
    return {start(){},emit(){},activity(){},setState(){},destroy(){}};
  }

  let sceneIndex=0;
  let speechToken=0;
  let utterance=null;
  let activeSpeechResolve=null;
  let mouthTimer=null;
  let revealTimer=null;
  let safetyTimer=null;
  let bubbleTimer=null;
  let blinkTimer=null;
  let controlsTimer=null;
  let focusTimer=null;
  let processSpeakTimer=null;
  let idleTimers=[];
  let dragged=false;
  let drag=null;
  let lastNarration='';
  let sceneNarration='';
  let currentNarrationKind='intro';
  let reserve=null;
  let reserveSection=null;
  let reserveEdge='bottom';
  let controlsMode='normal';
  let processPhase='';
  let processActive=false;
  let scrollTick=false;
  let narrationBusy=false;
  let currentNarrationPromise=Promise.resolve();
  let idleCycleActive=false;
  let awaitingTabletTap=false;
  let clarityReturnTimer=null;
  let oneAudio=null;
  let oneAudioUrl=null;
  let oneAudioRaf=0;
  const completed=new Set();

  const context=()=>{
    const base=getContext?.()||{};
    return {
      ...base,
      title:$('#title')?.value||'el documento',
      sections:Number(base.sections||0),
      tokenCount:Number(base.tokenCount||0),
      chunkSize:Number($('#chunkSize')?.value||0),
      overlap:Number($('#overlap')?.value||0),
      topK:Number($('#topK')?.value||0),
      threshold:Number($('#threshold')?.value||0),
      preview:base.preview||null,
      ingest:base.ingest||null,
      analysis:base.analysis||null,
      transformerToken:base.transformerToken||'',
      embeddingDimensions:Number(base.embeddingDimensions||768),
      llmModel:base.llmModel||base.analysis?.models?.llm||''
    };
  };

  const scene=()=>SCENES[sceneIndex]||SCENES[0];

  function setMouth(name='smile'){
    guide.dataset.oneMouth=['happy','rest','smile','o-small','o','open'].includes(name)?name:'smile';
  }

  function setState(name='attentive'){
    guide.dataset.oneState=name;
    if(name==='talking')return;
    if(name==='thinking')setMouth('rest');
    else setMouth('smile');
  }

  function clearBlink(){
    clearTimeout(blinkTimer);
    blinkTimer=null;
  }

  function blink(duration=145){
    if(guide.classList.contains('dragging')||guide.classList.contains('speaking'))return;
    guide.classList.add('blink');
    setTimeout(()=>guide.classList.remove('blink'),duration);
  }

  function scheduleBlink(){
    clearBlink();
    if(guide.classList.contains('speaking'))return;
    const delayByState={attentive:4900,waiting:6800,'content-watch':6100,'tablet-reading':5200,listening:4300,thinking:3000};
    const base=delayByState[guide.dataset.oneState]||5600;
    const jitter=Math.round(Math.random()*1800-900);
    blinkTimer=setTimeout(()=>{
      blink(guide.dataset.oneState==='content-watch'?175:140);
      if(Math.random()<.14)setTimeout(()=>blink(110),210);
      scheduleBlink();
    },Math.max(2500,base+jitter));
  }

  function clearIdle({keepTablet=false}={}){
    idleTimers.forEach(clearTimeout);
    idleTimers=[];
    clearTimeout(clarityReturnTimer);clarityReturnTimer=null;
    clearBlink();
    idleCycleActive=false;
    if(!keepTablet)exitTablet();
  }

  function clearControlsTimer(){
    clearTimeout(controlsTimer);
    controlsTimer=null;
  }

  function bestVoice(){
    if(!('speechSynthesis' in window))return null;
    const voices=window.speechSynthesis.getVoices?.()||[];
    const spanish=voices.filter(v=>/^es(?:-|_)/i.test(v.lang)||/spanish|español|castellano/i.test(v.name));
    const score=v=>{
      const lang=String(v.lang||'').toLowerCase().replace('_','-');
      const name=String(v.name||'').toLowerCase();
      let n=0;
      if(lang==='es-ar')n+=140;
      else if(lang==='es-419')n+=125;
      else if(['es-uy','es-mx','es-cl','es-us'].includes(lang))n+=110;
      else if(lang.startsWith('es-'))n+=85;
      if(/argentin|latino|latin american|latinoam/.test(name))n+=38;
      if(/male|masculino|hombre|tomas|tomás|jorge|diego|alvaro|álvaro|pablo|carlos|miguel|juan|gonzalo|lorenzo|marcelo|manuel|emilio|luis/.test(name))n+=52;
      if(/female|femenino|mujer|elena|sofia|sofía|catalina|salome|salomé|maria|maría|andrea/.test(name))n-=45;
      if(/natural|neural|online|premium|enhanced/.test(name))n+=35;
      if(/google|microsoft|siri|samsung/.test(name))n+=24;
      if(v.localService===false)n+=12;
      if(/espeak|pico|festival|compact|classic/.test(name))n-=70;
      return n;
    };
    return spanish.sort((a,b)=>score(b)-score(a))[0]||null;
  }

  function splitSentences(text){
    const clean=String(text||'').replace(/\s+/g,' ').trim();
    if(!clean)return[];
    const raw=[];
    let start=0;
    for(let i=0;i<clean.length;i++){
      const ch=clean[i];
      if(!'.!?'.includes(ch))continue;
      const prev=clean[i-1]||'';
      const next=clean[i+1]||'';
      if(ch==='.'&&/\d/.test(prev)&&/\d/.test(next))continue;
      if(next&&!/\s/.test(next))continue;
      const sentence=clean.slice(start,i+1).trim();
      if(sentence)raw.push(sentence);
      while(i+1<clean.length&&/\s/.test(clean[i+1]))i++;
      start=i+1;
    }
    if(start<clean.length)raw.push(clean.slice(start).trim());
    const out=[];
    for(const sentence of raw.filter(Boolean)){
      if(sentence.length<=175){out.push(sentence);continue;}
      const pieces=sentence.split(/(?<=;|:)\s+/).map(s=>s.trim()).filter(Boolean);
      if(pieces.length>1)out.push(...pieces);
      else out.push(sentence);
    }
    return out;
  }

  function visemeAt(text,index=0){
    const tail=String(text||'').slice(Math.max(0,index));
    const ch=(tail.match(/[a-záéíóúüñ]/i)||[''])[0].toLowerCase();
    if(/[mbp]/.test(ch))return'rest';
    if(/[aá]/.test(ch))return'open';
    if(/[oóuú]/.test(ch))return'o';
    if(/[eéií]/.test(ch))return'smile';
    if(/[fv]/.test(ch))return'o-small';
    if(/[.,;:!?]/.test(tail[0]||''))return'rest';
    return'happy';
  }

  function stopSpeech({cancel=true}={}){
    clearInterval(mouthTimer);mouthTimer=null;
    clearInterval(revealTimer);revealTimer=null;
    clearTimeout(safetyTimer);safetyTimer=null;
    clearTimeout(bubbleTimer);bubbleTimer=null;
    if(oneAudioRaf){cancelAnimationFrame(oneAudioRaf);oneAudioRaf=0;}
    if(oneAudio){try{oneAudio.pause();oneAudio.currentTime=0;}catch{}oneAudio=null;}
    if(oneAudioUrl){try{URL.revokeObjectURL(oneAudioUrl);}catch{}oneAudioUrl=null;}
    if(cancel&&'speechSynthesis' in window){
      try{window.speechSynthesis.cancel();}catch{}
    }
    utterance=null;
    if(activeSpeechResolve){
      const resolve=activeSpeechResolve;
      activeSpeechResolve=null;
      resolve();
    }
    narrationBusy=false;
    guide.classList.remove('speaking');
    setMouth(processActive?'rest':'smile');
  }

  function cancelNarration(){
    speechToken++;
    stopSpeech({cancel:true});
    currentNarrationPromise=Promise.resolve();
  }

  function speechUnits(text,segments=null){
    const source=segments?.length
      ?segments.map(item=>typeof item==='string'?{text:item}:item)
      :[{text:String(text||'')}];
    const units=[];
    for(const sourcePart of source){
      const sentences=splitSentences(sourcePart.text);
      if(!sentences.length&&String(sourcePart.text||'').trim())sentences.push(String(sourcePart.text).trim());
      sentences.forEach((sentence,index)=>{
        units.push({
          text:sentence,
          before:index===0?sourcePart.before:null,
          source:sourcePart
        });
      });
    }
    let cursor=0;
    for(const unit of units){
      unit.start=cursor;
      unit.end=cursor+unit.text.length;
      cursor=unit.end+1;
    }
    return {units,fullText:units.map(unit=>unit.text).join(' ')};
  }

  function unitForIndex(units,index){
    let current=units[0]||null;
    for(const unit of units){
      if(index>=unit.start)current=unit;
      if(index<=unit.end)break;
    }
    return current;
  }

  function visibleSpeechPrefix(fullText,wordMatches,absoluteIndex){
    if(!wordMatches.length)return'';
    const index=clamp(Number(absoluteIndex)||0,0,fullText.length);
    let current=0;
    for(let i=0;i<wordMatches.length;i++){
      if(wordMatches[i].index<=index)current=i;
      else break;
    }
    const end=wordMatches[current].index+wordMatches[current][0].length;
    return fullText.slice(0,end).trim();
  }

  function animateWordMouth(word,token){
    clearInterval(mouthTimer);
    const clean=String(word||'').replace(/[^a-záéíóúüñ]/gi,'');
    if(!clean){setMouth('rest');return;}
    let cursor=0;
    setMouth(visemeAt(clean,0));
    mouthTimer=setInterval(()=>{
      if(token!==speechToken)return;
      cursor=(cursor+1)%clean.length;
      setMouth(visemeAt(clean,cursor));
    },72);
  }

  function runWebSpeechNarration(text,{kind='intro',controlsAfter=true,stateAfter='attentive',segments=null,onSegment=null}={}){
    const clean=String(text||'').trim();
    const plan=speechUnits(clean,segments);
    if(!plan.fullText)return Promise.resolve();

    const token=++speechToken;
    currentNarrationKind=kind;
    if(clean)lastNarration=clean;
    narrationBusy=true;
    setState('talking');
    guide.classList.add('speaking');
    bubble.classList.add('visible');
    placeBubble();

    return new Promise(async resolveOuter=>{
      let finished=false;
      let started=false;
      let boundarySeen=false;
      let lastBoundaryAt=0;
      let currentUnitIndex=-1;
      let fallbackWordIndex=0;
      let fallbackStart=performance.now();
      let speechProbe=null;
      const words=[...plan.fullText.matchAll(/\S+/g)];

      const activateUnit=async(index)=>{
        if(index<0||index>=plan.units.length||index===currentUnitIndex)return;
        currentUnitIndex=index;
        const unit=plan.units[index];
        if(unit.before)await unit.before();
        onSegment?.(unit,index);
      };

      const renderAt=async(charIndex)=>{
        if(token!==speechToken)return;
        const unit=unitForIndex(plan.units,charIndex);
        const idx=unit?plan.units.indexOf(unit):0;
        await activateUnit(idx);
        textNode.textContent=visibleSpeechPrefix(plan.fullText,words,charIndex);
        textNode.scrollTop=textNode.scrollHeight;
        const tail=plan.fullText.slice(charIndex);
        const word=(tail.match(/^\S+/)||tail.match(/\S+/)||[''])[0];
        animateWordMouth(word,token);
        placeBubble();
      };

      const finish=()=>{
        if(finished)return;
        finished=true;
        clearTimeout(speechProbe);speechProbe=null;
        clearInterval(revealTimer);revealTimer=null;
        clearInterval(mouthTimer);mouthTimer=null;
        clearTimeout(safetyTimer);safetyTimer=null;
        if(activeSpeechResolve===finish)activeSpeechResolve=null;
        narrationBusy=false;
        utterance=null;
        const last=plan.units.at(-1);
        if(last)textNode.textContent=last.text;
        setMouth(processActive?'rest':'smile');
        guide.classList.remove('speaking','blink');
        setState(processActive?'thinking':stateAfter);
        setGazeToFocus();

        bubbleTimer=setTimeout(()=>{
          if(token!==speechToken)return;
          bubble.classList.remove('visible');
          if(processActive){
            setState('thinking');
            scheduleBlink();
            return;
          }
          if(controlsAfter){
            showControls('normal');
            scheduleIdle();
          }else if(stateAfter==='thinking'){
            scheduleBlink();
          }
        },520);
        resolveOuter();
      };

      activeSpeechResolve=finish;
      await activateUnit(0);
      textNode.textContent=plan.units[0]?.text.split(/\s+/)[0]||'';
      placeBubble();

      const estimatedWordMs=300;
      revealTimer=setInterval(()=>{
        if(finished||token!==speechToken)return;
        const now=performance.now();
        if(boundarySeen&&now-lastBoundaryAt<520)return;
        const expected=Math.min(words.length-1,Math.floor((now-fallbackStart)/estimatedWordMs));
        if(expected<=fallbackWordIndex)return;
        fallbackWordIndex=expected;
        const match=words[fallbackWordIndex];
        if(match)renderAt(match.index);
      },90);

      const canSpeak='speechSynthesis' in window&&'SpeechSynthesisUtterance' in window;
      if(!canSpeak){
        const total=clamp(words.length*estimatedWordMs,900,24000);
        safetyTimer=setTimeout(finish,total);
        return;
      }

      const u=new SpeechSynthesisUtterance(plan.fullText);
      utterance=u;
      const voice=bestVoice();
      let assignedVoice=null;
      if(voice){
        try{u.voice=voice;assignedVoice=voice;}catch{}
      }
      u.lang=assignedVoice?.lang||voice?.lang||'es-AR';
      u.rate=1;
      u.pitch=1;
      u.volume=1;
      guide.dataset.oneVoice=assignedVoice?.name||voice?.name||u.lang;
      guide.dataset.oneVoiceProvider='web-speech';
      u.onstart=()=>{started=true;fallbackStart=performance.now();};
      u.onboundary=event=>{
        if(token!==speechToken)return;
        boundarySeen=true;
        lastBoundaryAt=performance.now();
        fallbackWordIndex=Math.max(fallbackWordIndex,words.findIndex(m=>m.index>=Number(event.charIndex||0)));
        renderAt(Number(event.charIndex)||0);
      };
      u.onend=finish;
      u.onerror=finish;

      try{window.speechSynthesis.speak(u);}
      catch{
        const total=clamp(words.length*estimatedWordMs,900,24000);
        safetyTimer=setTimeout(finish,total);
        return;
      }

      speechProbe=setTimeout(()=>{
        if(finished||token!==speechToken||started)return;
        let active=false;
        try{active=Boolean(window.speechSynthesis.speaking||window.speechSynthesis.pending);}catch{}
        if(!active){
          try{window.speechSynthesis.cancel();}catch{}
          const remaining=clamp(words.length*estimatedWordMs,900,24000);
          safetyTimer=setTimeout(finish,remaining);
        }
      },700);

      safetyTimer=setTimeout(finish,Math.max(12000,Math.min(90000,words.length*900+10000)));
    });
  }

  function azureVisemeToMouth(id){
    const value=Number(id)||0;
    if(value===0||value===21)return'rest';
    if([1,2].includes(value))return'open';
    if([3,7,8,9,10,11].includes(value))return'o';
    if([4,5,6].includes(value))return'smile';
    if([15,16,17,18].includes(value))return'o-small';
    return'happy';
  }

  function base64AudioUrl(base64,mimeType='audio/mpeg'){
    const binary=atob(String(base64||''));
    const bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    const blob=new Blob([bytes],{type:mimeType});
    return URL.createObjectURL(blob);
  }

  async function fetchNeuralSpeech(displayText,plan,speechText=null){
    const segments=plan.units.map((unit,index)=>({id:index,speechText:naturalSpeechText(unit.text)}));
    try{
      const response=await fetch('/api/one/tts',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          displayText,
          speechText:speechText||naturalSpeechText(displayText),
          segments
        })
      });
      const payload=await response.json().catch(()=>null);
      if(!response.ok||!payload?.available||!payload?.audioBase64)return null;
      return payload;
    }catch{return null;}
  }

  function displayPrefixForAudio(plan,tts,timeMs,totalDurationMs=0){
    const bookmarks=(tts.bookmarks||[]).map(item=>({
      ...item,
      index:Number(String(item.text||'').replace('seg-',''))
    })).filter(item=>Number.isFinite(item.index)).sort((a,b)=>a.audioOffsetMs-b.audioOffsetMs);

    let unitIndex=0,start=0,next=totalDurationMs||Infinity;
    if(bookmarks.length){
      for(const item of bookmarks){if(timeMs+4>=item.audioOffsetMs)unitIndex=item.index;else break;}
      unitIndex=clamp(unitIndex,0,Math.max(0,plan.units.length-1));
      start=bookmarks.find(item=>item.index===unitIndex)?.audioOffsetMs||0;
      next=bookmarks.find(item=>item.index===unitIndex+1)?.audioOffsetMs??(totalDurationMs||Infinity);
    }else{
      const weights=plan.units.map((unit,index)=>{
        const spoken=tts.segments?.[index]?.speechText||naturalSpeechText(unit.text);
        return Math.max(1,(spoken.match(/\S+/g)||[]).length);
      });
      const totalWeight=weights.reduce((sum,value)=>sum+value,0)||1;
      let cursor=0;
      for(let i=0;i<weights.length;i++){
        const duration=(totalDurationMs||weights.length*1800)*(weights[i]/totalWeight);
        if(timeMs>=cursor)unitIndex=i;
        if(timeMs<cursor+duration){start=cursor;next=cursor+duration;break;}
        cursor+=duration;
      }
    }

    unitIndex=clamp(unitIndex,0,Math.max(0,plan.units.length-1));
    const unit=plan.units[unitIndex];
    const spoken=(tts.words||[]).filter(word=>word.audioOffsetMs>=start&&word.audioOffsetMs<next);
    const passed=spoken.filter(word=>word.audioOffsetMs<=timeMs+8).length;
    const displayWords=[...String(unit?.text||'').matchAll(/\S+/g)];
    const ratio=spoken.length
      ?clamp(passed/spoken.length,0,1)
      :clamp((timeMs-start)/Math.max(350,next-start),0,1);
    const count=displayWords.length?clamp(Math.max(1,Math.ceil(displayWords.length*ratio)),1,displayWords.length):0;
    const partial=count?unit.text.slice(0,displayWords[count-1].index+displayWords[count-1][0].length):'';
    const completed=plan.units.slice(0,unitIndex).map(item=>item.text).join(' ');
    const spokenText=tts.segments?.[unitIndex]?.speechText||naturalSpeechText(unit?.text||'');
    const spokenWords=spokenText.match(/\S+/g)||[];
    const speechWord=spokenWords.length?spokenWords[clamp(Math.floor(ratio*spokenWords.length),0,spokenWords.length-1)]:'';
    return {unitIndex,text:(completed+(completed&&partial?' ':'')+partial).trim(),speechWord};
  }

  async function runAzureNarration(text,options,plan,tts){
    const clean=String(text||'').trim();
    const token=++speechToken;
    const {kind='intro',controlsAfter=true,stateAfter='attentive',onSegment=null}=options||{};
    let currentUnitIndex=-1;
    let visemeIndex=-1;
    let finished=false;
    const url=base64AudioUrl(tts.audioBase64,tts.mimeType||'audio/mpeg');
    const audio=new Audio(url);
    audio.preload='auto';

    const activateUnit=async index=>{
      if(index<0||index>=plan.units.length||index===currentUnitIndex)return;
      currentUnitIndex=index;
      const unit=plan.units[index];
      if(unit.before)await unit.before();
      onSegment?.(unit,index);
    };

    await activateUnit(0);
    try{await audio.play();}
    catch{
      URL.revokeObjectURL(url);
      return false;
    }

    oneAudio=audio;
    oneAudioUrl=url;
    currentNarrationKind=kind;
    if(clean)lastNarration=clean;
    narrationBusy=true;
    setState('talking');
    guide.classList.add('speaking');
    bubble.classList.add('visible');
    textNode.textContent=plan.units[0]?.text.split(/\\s+/)[0]||'';
    placeBubble();
    guide.dataset.oneVoice=tts.voice||'es-AR-TomasNeural';
    guide.dataset.oneVoiceProvider='azure-speech';

    return await new Promise(resolveOuter=>{
      const finish=()=>{
        if(finished)return;
        finished=true;
        if(oneAudioRaf){cancelAnimationFrame(oneAudioRaf);oneAudioRaf=0;}
        if(oneAudio===audio)oneAudio=null;
        if(oneAudioUrl===url)oneAudioUrl=null;
        try{URL.revokeObjectURL(url);}catch{}
        if(activeSpeechResolve===finish)activeSpeechResolve=null;
        narrationBusy=false;
        const last=plan.units.at(-1);
        if(last)textNode.textContent=last.text;
        setMouth(processActive?'rest':'smile');
        guide.classList.remove('speaking','blink');
        setState(processActive?'thinking':stateAfter);
        setGazeToFocus();
        bubbleTimer=setTimeout(()=>{
          if(token!==speechToken)return;
          bubble.classList.remove('visible');
          if(processActive){setState('thinking');scheduleBlink();return;}
          if(controlsAfter){showControls('normal');scheduleIdle();}
          else if(stateAfter==='thinking')scheduleBlink();
        },520);
        resolveOuter(true);
      };
      activeSpeechResolve=finish;
      audio.onended=finish;
      audio.onerror=finish;

      const sync=()=>{
        if(finished||token!==speechToken)return;
        const timeMs=audio.currentTime*1000;
        const progress=displayPrefixForAudio(plan,tts,timeMs,(audio.duration||0)*1000);
        if(progress.unitIndex!==currentUnitIndex)activateUnit(progress.unitIndex);
        if(progress.text){textNode.textContent=progress.text;textNode.scrollTop=textNode.scrollHeight;}
        const visemes=tts.visemes||[];
        while(visemeIndex+1<visemes.length&&visemes[visemeIndex+1].audioOffsetMs<=timeMs+18)visemeIndex++;
        if(visemeIndex>=0)setMouth(azureVisemeToMouth(visemes[visemeIndex].visemeId));
        else if(progress.speechWord)setMouth(visemeAt(progress.speechWord,0));
        placeBubble();
        oneAudioRaf=requestAnimationFrame(sync);
      };
      oneAudioRaf=requestAnimationFrame(sync);
    });
  }

  async function runNarration(text,{speechText=null,...options}={}){
    const clean=String(text||'').trim();
    const plan=speechUnits(clean,options.segments||null);
    if(!plan.fullText)return;
    const tts=await fetchNeuralSpeech(clean,plan,speechText);
    if(tts){
      const played=await runAzureNarration(clean,options,plan,tts);
      if(played!==false)return played;
    }
    return runWebSpeechNarration(clean,options);
  }

  function narrate(text,{interrupt=true,...options}={}){
    const clean=String(text||'').trim();
    if(!clean&&!options.segments?.length)return Promise.resolve();
    clearIdle();
    clearControlsTimer();
    hideControls();

    if(interrupt){
      cancelNarration();
      currentNarrationPromise=runNarration(clean,options);
    }else{
      currentNarrationPromise=currentNarrationPromise
        .catch(()=>{})
        .then(()=>runNarration(clean,options));
    }
    return currentNarrationPromise;
  }

  function resolveTarget(sceneDef=scene()){
    const selector=typeof sceneDef.focus==='function'?sceneDef.focus(context()):sceneDef.focus;
    return selector?$(selector):null;
  }

  function clearFocus(){
    clearTimeout(focusTimer);
    focusTimer=null;
    $$('.one-focus-target').forEach(el=>el.classList.remove('one-focus-target','one-focus-soft'));
    $$('.one-action-required').forEach(el=>el.classList.remove('one-action-required'));
  }

  function markFocus(sceneDef=scene()){
    clearFocus();
    const target=resolveTarget(sceneDef);
    target?.classList.add('one-focus-target');
    focusTimer=setTimeout(()=>target?.classList.add('one-focus-soft'),1900);
    if(sceneDef.gate&&!gateSatisfied(sceneDef))$(sceneDef.actionTarget)?.classList.add('one-action-required');
  }

  function syncGuidedActions(sceneDef=scene()){
    ['#previewChunks','#ingestHere','#analyze','#transformerCalculation summary'].forEach(sel=>$(sel)?.classList.add('one-action-concealed'));
    $('#ingest')?.classList.add('one-action-concealed');
    if(sceneDef.actionTarget)$(sceneDef.actionTarget)?.classList.remove('one-action-concealed');
  }

  function ensureReserve(target){
    if(!target?.parentElement)return null;
    if(!reserve){
      reserve=document.createElement('div');
      reserve.className='one-stage-reserve';
      reserve.setAttribute('aria-hidden','true');
    }
    reserveSection=target.parentElement;
    return reserve;
  }

  function applyReserveEdge(edge,target=resolveTarget(),{scroll=false}={}){
    const node=ensureReserve(target);
    if(!node||!target?.parentElement)return;
    reserveEdge=edge;
    node.dataset.edge=edge;
    if(edge==='top')target.insertAdjacentElement('beforebegin',node);
    else target.insertAdjacentElement('afterend',node);
    if(scroll){
      requestAnimationFrame(()=>node.scrollIntoView({behavior:'smooth',block:edge==='top'?'start':'end',inline:'nearest'}));
    }
  }

  function syncReserveFromGuide(){
    const r=guide.getBoundingClientRect();
    const center=r.top+r.height/2;
    let edge=reserveEdge;
    if(edge==='top'&&center>innerHeight*.58)edge='bottom';
    else if(edge==='bottom'&&center<innerHeight*.42)edge='top';
    if(edge!==reserveEdge)applyReserveEdge(edge,resolveTarget(),{scroll:true});
  }

  function updateFacingFromPosition(forceSide=null){
    const r=guide.getBoundingClientRect();
    const center=r.left+r.width/2;
    const old=guide.dataset.oneSide||'left';
    let side=forceSide||old;
    if(!forceSide){
      if(old==='left'&&center>innerWidth*.60)side='right';
      else if(old==='right'&&center<innerWidth*.40)side='left';
    }
    guide.dataset.oneSide=side;
    guide.dataset.oneFacing=side==='right'?'left':'right';
    setGazeToFocus();
  }

  function setGazeToFocus(){
    if(guide.classList.contains('tablet-reading')){
      guide.style.setProperty('--one-gaze-x','0px');
      guide.style.setProperty('--one-gaze-y','5.2px');
      return;
    }
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
    const dx=(tr.left+tr.width/2)-(gr.left+gr.width/2);
    const dy=(tr.top+tr.height/2)-(gr.top+gr.height*.47);
    const flip=guide.dataset.oneSide==='right'?-1:1;
    const localX=clamp(dx/170,-1,1)*5.2*flip;
    const localY=clamp(dy/210,-1,1)*3.8;
    guide.style.setProperty('--one-gaze-x',localX.toFixed(2)+'px');
    guide.style.setProperty('--one-gaze-y',localY.toFixed(2)+'px');
  }

  function intendedSide(sceneDef,targetRect){
    if(sceneDef.side)return sceneDef.side;
    if(targetRect)return(targetRect.left+targetRect.width/2)<innerWidth/2?'right':'left';
    return guide.dataset.oneSide||'right';
  }

  function guideEdgeInset(){
    const raw=getComputedStyle(guide).getPropertyValue('--one-guide-edge-inset');
    const value=Number.parseFloat(raw);
    return Number.isFinite(value)?value:0;
  }

  function guideHorizontalBounds(rect=guide.getBoundingClientRect()){
    const inset=guideEdgeInset();
    const pad=5;
    return {min:pad-inset,max:innerWidth-rect.width-pad+inset};
  }

  function visibleGuideRect(){
    const rect=guide.getBoundingClientRect();
    const inset=guideEdgeInset();
    return {
      left:rect.left+inset,
      right:rect.right-inset,
      top:rect.top+inset,
      bottom:rect.bottom-inset,
      width:Math.max(1,rect.width-inset*2),
      height:Math.max(1,rect.height-inset*2)
    };
  }

  async function moveToScene(sceneDef=scene()){
    const target=resolveTarget(sceneDef);
    const current=guide.getBoundingClientRect();
    const pad=8;
    const top=innerWidth<760?64:76;
    const targetRect=target?.getBoundingClientRect();
    const side=intendedSide(sceneDef,targetRect);
    const bounds=guideHorizontalBounds(current);
    const x=side==='right'?bounds.max:bounds.min;

    applyReserveEdge('top',target,{scroll:true});
    if(target)await sleep(innerWidth<760?520:330);

    hideControls();
    guide.classList.add('moving');
    updateFacingFromPosition(side);

    const afterScroll=guide.getBoundingClientRect();
    const dx=x-afterScroll.left;
    const dy=top-afterScroll.top;
    const motion=guide.animate(
      [
        {transform:'translate3d(0,0,0) scale(1)'},
        {transform:'translate3d('+(dx*.90)+'px,'+(dy*.90)+'px,0) scale(.985)',offset:.82},
        {transform:'translate3d('+dx+'px,'+dy+'px,0) scale(1)'}
      ],
      {duration:560,easing:'cubic-bezier(.22,.8,.25,1)',fill:'forwards'}
    );
    await motion.finished.catch(()=>{});
    guide.style.left=x+'px';
    guide.style.top=top+'px';
    guide.style.right='auto';
    guide.style.bottom='auto';
    guide.style.transform='none';
    motion.cancel();
    guide.classList.remove('moving');
    updateFacingFromPosition(side);
    setGazeToFocus();
    placeBubble();
  }

  function rectsOverlap(a,b,pad=4){
    return a.left<b.right+pad&&a.right>b.left-pad&&a.top<b.bottom+pad&&a.bottom>b.top-pad;
  }

  function placeBubble(){
    const r=visibleGuideRect();
    const pad=5;
    const gap=5;
    const width=innerWidth<760?184:260;
    bubble.style.setProperty('width',width+'px','important');
    bubble.style.setProperty('max-width',width+'px','important');
    bubble.style.setProperty('position','fixed','important');
    bubble.style.setProperty('right','auto','important');
    bubble.style.setProperty('bottom','auto','important');

    const height=Math.min(Math.max(bubble.scrollHeight||76,72),Math.max(90,innerHeight-pad*2));
    const side=guide.dataset.oneSide||'right';
    let left=side==='right'?r.left-width-gap:r.right+gap;
    left=clamp(left,pad,Math.max(pad,innerWidth-width-pad));
    const anchorY=clamp(r.top+r.height*.30-height*.50,pad,Math.max(pad,innerHeight-height-pad));

    bubble.style.setProperty('left',left+'px','important');
    bubble.style.setProperty('top',anchorY+'px','important');
    bubble.dataset.pointer=side==='right'?'right':'left';
    bubble.style.setProperty('--one-bubble-tail-y',clamp(r.top+r.height*.35-anchorY,18,height-18)+'px');
  }

  function gateSatisfied(sceneDef=scene()){
    if(!sceneDef.gate)return true;
    if(sceneDef.gate==='CALC_OPENED'&&$('#transformerCalculation')?.open)return true;
    return completed.has(sceneDef.gate);
  }

  function updateControls(mode=controlsMode){
    controlsMode=mode;
    controls.dataset.mode=mode;
    controls.classList.remove('retracted');
    if(mode==='clarity'){
      back.disabled=true;
      repeat.disabled=false;
      repeat.textContent='Repetir';
      next.disabled=false;
      next.textContent=gateSatisfied(scene())?'Seguir':'Entendido';
      return;
    }
    repeat.textContent='Repetir';
    back.disabled=sceneIndex===0;
    repeat.disabled=!lastNarration;
    if(sceneIndex===SCENES.length-1){
      next.disabled=false;
      next.textContent='Inicio';
    }else{
      next.disabled=!gateSatisfied(scene());
      next.textContent='Siguiente';
    }
  }

  function hideControls(){
    clearControlsTimer();
    controls.classList.remove('visible','retracted');
    controls.setAttribute('aria-hidden','true');
  }

  function retractControls(){
    controls.classList.add('retracted');
    controls.setAttribute('aria-hidden','true');
  }

  function showControls(mode='normal'){
    clearControlsTimer();
    updateControls(mode);
    controls.classList.add('visible');
    controls.setAttribute('aria-hidden','false');
    const delay=sceneIndex===SCENES.length-1?7000:11500;
    controlsTimer=setTimeout(()=>{
      retractControls();
      if(controlsMode==='clarity'){
        controlsMode='normal';
        setState('content-watch');
        setGazeToFocus();
      }
    },delay);
  }

  function enterTablet(){
    if(processActive||guide.classList.contains('speaking')||guide.classList.contains('dragging'))return;
    hideControls();
    awaitingTabletTap=true;
    guide.classList.add('tablet-reading');
    setState('tablet-reading');
    setMouth('smile');
    setGazeToFocus();
    scheduleBlink();
  }

  function exitTablet(){
    awaitingTabletTap=false;
    guide.classList.remove('tablet-reading');
  }

  function contentWatch(){
    if(processActive||guide.classList.contains('speaking'))return;
    exitTablet();
    setState('content-watch');
    setMouth('smile');
    setGazeToFocus();
    scheduleBlink();
  }

  async function standbyWithTablet(){
    if(processActive||guide.classList.contains('speaking')||guide.classList.contains('dragging'))return;
    contentWatch();
    const promise=narrate('Voy a estar aquí por si necesitas algo... Solo avisame.',{
      kind:'standby',
      controlsAfter:false,
      stateAfter:'attentive'
    });
    idleCycleActive=true;
    await promise;
    if(!idleCycleActive||processActive)return;
    await sleep(620);
    if(!idleCycleActive||processActive)return;
    enterTablet();
  }

  async function clarityCheck(){
    if(processActive||guide.classList.contains('speaking'))return;
    clearIdle({keepTablet:true});
    exitTablet();
    guide.style.setProperty('--one-gaze-x','0px');
    guide.style.setProperty('--one-gaze-y','0px');
    await narrate('¿Quedó claro lo que estamos viendo? Si querés puedo repetir la explicación. Si ya está claro, seguimos.',{
      kind:'clarity',
      controlsAfter:false,
      stateAfter:'attentive'
    });
    showControls('clarity');
    clarityReturnTimer=setTimeout(()=>{
      if(processActive||guide.classList.contains('speaking'))return;
      retractControls();
      standbyWithTablet();
    },15000);
  }

  function scheduleIdle(){
    clearIdle();
    processActive=false;
    setState('attentive');
    setMouth('smile');
    setGazeToFocus();
    scheduleBlink();

    idleTimers.push(setTimeout(()=>{
      if(guide.classList.contains('speaking')||processActive)return;
      retractControls();
      contentWatch();
    },7000));

    idleTimers.push(setTimeout(()=>{
      if(guide.classList.contains('speaking')||processActive)return;
      standbyWithTablet();
    },13000));
  }

  function processText(kind,p){
    if(kind==='INGEST_PROGRESS'){
      const map={
        chunking:'Estoy calculando los límites reales de los chunks antes de generar vectores.',
        embedding:'Ahora convierto cada chunk en un embedding con '+(p.model||'el modelo de embeddings')+'.',
        embedding_done:'Los embeddings ya están listos: '+(p.vectors||0)+' vectores de '+(p.dimensions||0)+' dimensiones.',
        db_begin:'Abro una transacción en PostgreSQL. Nada queda confirmado hasta llegar a COMMIT.',
        db_replace:'Encontré una versión anterior del mismo documento y la reemplazo dentro de la transacción.',
        db_document:'El registro del documento ya fue insertado. Ahora empiezan las filas de chunks.',
        db_insert:'Guardando '+(p.current||0)+' de '+(p.total||0)+' chunks con texto, metadata y vector.',
        db_commit:'COMMIT confirmado. PostgreSQL ya dejó persistida la ingesta.',
        db_rollback:'La transacción hizo ROLLBACK. Ningún cambio parcial debería quedar persistido.'
      };
      return map[p.phase]||'La ingesta real sigue avanzando.';
    }
    const map={
      question_embedding:'Primero convierto la pregunta en un embedding para poder compararla con los chunks.',
      question_embedding_done:'El vector de la pregunta está listo con '+(p.dimensions||0)+' dimensiones.',
      vector_search:'Ahora pgvector busca los '+(p.topK||0)+' vecinos más cercanos dentro del documento activo.',
      retrieval:'Retrieval devolvió '+(p.candidates||0)+' candidatos. '+(p.accepted||0)+' superan el threshold '+Number(p.threshold||0).toFixed(2)+'.',
      context:'Con los candidatos aceptados construyo el contexto que sí podrá ver el modelo.',
      llm:'El contexto ya llegó a '+(p.model||'el LLM')+'. Ahora genera usando sólo esa evidencia.',
      llm_done:'La generación terminó. Falta validar que las citas realmente correspondan a chunks recuperados.',
      abstention:'Ningún chunk superó el threshold. En vez de inventar una respuesta, el sistema prepara una abstención.',
      validation:'Estoy validando las citas. '+(p.invalid?String(p.invalid)+' referencias no son válidas.':'Todas las referencias usadas pertenecen a la evidencia recuperada.')
    };
    return map[p.phase]||'El análisis E2E sigue avanzando.';
  }

  function showProcessProgress(kind,payload){
    processActive=true;
    processPhase=payload.phase||'';
    clearIdle({keepTablet:false});
    clearTimeout(processSpeakTimer);
    hideControls();

    const message=processText(kind,payload);
    if(!narrationBusy){
      setState('thinking');
      setMouth('rest');
      textNode.textContent=message;
      bubble.classList.add('visible');
      placeBubble();
      scheduleBlink();
    }

    if(['embedding','llm','vector_search'].includes(payload.phase)){
      const phase=payload.phase;
      processSpeakTimer=setTimeout(()=>{
        if(processActive&&processPhase===phase&&!narrationBusy){
          narrate(message,{kind:'process',controlsAfter:false,stateAfter:'thinking',interrupt:false});
        }
      },1400);
    }
  }

  async function applyScene(index,{speak=true}={}){
    cancelNarration();
    clearIdle();
    clearControlsTimer();
    hideControls();
    processActive=false;
    clearTimeout(processSpeakTimer);
    sceneIndex=clamp(index,0,SCENES.length-1);
    const sceneDef=scene();
    document.body.dataset.oneScene=sceneDef.id;

    navigateScreen?.(sceneDef.screen,false);
    if(sceneDef.ingestion)setIngestionScene?.(sceneDef.ingestion);
    if(sceneDef.transformer)setTransformerStage?.(sceneDef.transformer);
    if(sceneDef.pipelineTour)setPipelineStage?.(0);

    syncGuidedActions(sceneDef);
    markFocus(sceneDef);
    await moveToScene(sceneDef);

    const phrase=typeof sceneDef.narration==='function'?sceneDef.narration(context()):sceneDef.narration;
    sceneNarration=String(phrase||'');
    lastNarration=sceneNarration;

    if(!speak){
      showControls('normal');
      scheduleIdle();
      return;
    }

    if(sceneDef.pipelineTour){
      const intro=splitSentences(sceneNarration).map(text=>({text}));
      const tour=PIPELINE_TOUR.map(item=>({
        text:item.text,
        before:async()=>{
          setPipelineStage?.(item.stage);
          await sleep(160);
          setGazeToFocus();
        }
      }));
      await narrate(sceneNarration,{kind:'intro',segments:[...intro,...tour],controlsAfter:true});
      return;
    }

    narrate(sceneNarration,{kind:'intro'});
  }

  function eventResultNarration(sceneDef,event,payload){
    if(!sceneDef.resultNarration)return null;
    const phrase=typeof sceneDef.resultNarration==='function'?sceneDef.resultNarration(context(),event,payload):sceneDef.resultNarration;
    return String(phrase||'').trim();
  }

  function emit(event,payload={}){
    if(['PREVIEW_READY','CALC_OPENED','INGEST_COMPLETED','ANALYSIS_COMPLETED'].includes(event))completed.add(event);

    if(event==='PREVIEW_REQUESTED'||event==='INGEST_STARTED'||event==='ANALYSIS_STARTED'){
      processActive=true;
      clearIdle({keepTablet:false});
      hideControls();
      if(!narrationBusy){
        bubble.classList.remove('visible');
        setState('thinking');
        setMouth('rest');
        setGazeToFocus();
        scheduleBlink();
      }
      return;
    }

    if(event==='INGEST_PROGRESS'||event==='ANALYSIS_PROGRESS'){
      showProcessProgress(event,payload);
      return;
    }

    if(event==='INGEST_FAILED'||event==='ANALYSIS_FAILED'){
      processActive=false;
      clearTimeout(processSpeakTimer);
      setState('attentive');
      narrate('La operación no terminó correctamente. Revisá el mensaje de error de esta sección y volvé a intentarlo.',{kind:'error',interrupt:false});
      return;
    }

    if(event==='DOCUMENT_OPENED'||event==='DOCUMENT_RESTORED'||event==='PARAMETER_CHANGED')activity('listening');

    const sceneDef=scene();
    if(event===sceneDef.gate){
      processActive=false;
      clearTimeout(processSpeakTimer);
      $(sceneDef.actionTarget)?.classList.remove('one-action-required');
      updateControls();
      const result=eventResultNarration(sceneDef,event,payload);
      if(result){
        lastNarration=result;
        narrate(result,{kind:'result',interrupt:false});
      }else if(narrationBusy){
        currentNarrationPromise.finally(()=>{
          showControls('normal');
          scheduleIdle();
        });
      }else{
        showControls('normal');
        scheduleIdle();
      }
    }
  }

  function activity(name='attentive'){
    if(guide.classList.contains('speaking')||processActive)return;
    clearIdle();
    setState(name);
    setGazeToFocus();
    scheduleBlink();
    idleTimers.push(setTimeout(scheduleIdle,4200));
  }

  function repeatCurrent(){
    if(guide.classList.contains('speaking')||processActive)return;
    controlsMode='normal';
    const phrase=lastNarration||sceneNarration||(typeof scene().narration==='function'?scene().narration(context()):scene().narration);
    narrate(phrase,{kind:currentNarrationKind});
  }

  function nextScene(){
    if(guide.classList.contains('speaking')||processActive)return;
    if(controlsMode==='clarity'){
      controlsMode='normal';
      if(!gateSatisfied(scene())){
        hideControls();
        markFocus(scene());
        $(scene().actionTarget)?.classList.add('one-action-required');
        contentWatch();
        return;
      }
    }
    if(sceneIndex===SCENES.length-1){
      applyScene(0);
      return;
    }
    if(!gateSatisfied(scene()))return;
    applyScene(sceneIndex+1);
  }

  function previousScene(){
    if(guide.classList.contains('speaking')||processActive||sceneIndex<=0)return;
    controlsMode='normal';
    applyScene(sceneIndex-1);
  }

  function installDrag(){
    handle.addEventListener('pointerdown',event=>{
      clearIdle({keepTablet:true});
      hideControls();
      const r=guide.getBoundingClientRect();
      drag={id:event.pointerId,dx:event.clientX-r.left,sx:event.clientX,sy:event.clientY,wasTablet:awaitingTabletTap};
      dragged=false;
      guide.classList.add('dragging');
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    handle.addEventListener('pointermove',event=>{
      if(!drag||drag.id!==event.pointerId)return;
      if(Math.hypot(event.clientX-drag.sx,event.clientY-drag.sy)>7)dragged=true;
      const r=guide.getBoundingClientRect();
      const bounds=guideHorizontalBounds(r);
      const x=clamp(event.clientX-drag.dx,bounds.min,bounds.max);
      guide.style.left=x+'px';
      guide.style.top=(innerWidth<760?64:76)+'px';
      guide.style.right='auto';
      guide.style.bottom='auto';
      updateFacingFromPosition();
      setGazeToFocus();
      if(bubble.classList.contains('visible'))placeBubble();
    });

    const end=event=>{
      if(!drag||drag.id!==event.pointerId)return;
      const wasTablet=drag.wasTablet;
      drag=null;
      guide.classList.remove('dragging');
      updateFacingFromPosition();
      if(bubble.classList.contains('visible'))placeBubble();

      if(!dragged){
        if(wasTablet||awaitingTabletTap){
          clarityCheck();
          return;
        }
        if(guide.classList.contains('speaking')||narrationBusy||processActive)return;
        if(controls.classList.contains('retracted')||!controls.classList.contains('visible'))showControls('normal');
        else repeatCurrent();
        return;
      }

      if(guide.classList.contains('speaking')||narrationBusy||processActive)return;
      if(awaitingTabletTap)return;
      showControls('normal');
      scheduleIdle();
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
      window.speechSynthesis.getVoices?.();
      window.speechSynthesis.addEventListener('voiceschanged',bestVoice);
    }
    applyScene(0);
  }

  function destroy(){
    cancelNarration();
    clearIdle();
    clearControlsTimer();
    clearTimeout(focusTimer);
    clearTimeout(processSpeakTimer);
    clearFocus();
    reserve?.remove();
  }

  window.addEventListener('resize',()=>{
    guide.style.top=(innerWidth<760?64:76)+'px';
    applyReserveEdge('top',resolveTarget());
    updateFacingFromPosition();
    setGazeToFocus();
    if(bubble.classList.contains('visible'))placeBubble();
  });

  window.addEventListener('scroll',()=>{
    if(scrollTick)return;
    scrollTick=true;
    requestAnimationFrame(()=>{
      scrollTick=false;
      setGazeToFocus();
      if(bubble.classList.contains('visible'))placeBubble();
    });
  },{passive:true});

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
