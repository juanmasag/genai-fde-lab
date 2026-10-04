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
    clearBlink();
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
      if(/natural|neural|online|premium|enhanced/.test(name))n+=35;
      if(/google|microsoft|siri/.test(name))n+=24;
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
    if(cancel&&'speechSynthesis' in window){
      try{window.speechSynthesis.cancel();}catch{}
    }
    utterance=null;
    if(activeSpeechResolve){
      const resolve=activeSpeechResolve;
      activeSpeechResolve=null;
      resolve();
    }
    guide.classList.remove('speaking');
    setMouth(processActive?'rest':'smile');
  }

  function cancelNarration(){
    speechToken++;
    stopSpeech({cancel:true});
  }

  function revealThroughChar(sentence,index){
    const safe=clamp(Number(index)||0,0,sentence.length);
    let end=safe;
    while(end<sentence.length&&!/\s/.test(sentence[end]))end++;
    const visible=sentence.slice(0,end).trim();
    if(visible)textNode.textContent=visible;
    placeBubble();
  }

  function startProgressiveFallback(sentence,token){
    const words=[...sentence.matchAll(/\S+/g)];
    let i=0;
    clearInterval(revealTimer);
    const step=()=>{
      if(token!==speechToken||i>=words.length)return;
      const m=words[i++];
      textNode.textContent=sentence.slice(0,m.index+m[0].length);
      placeBubble();
    };
    step();
    const pace=clamp(sentence.length/Math.max(1,words.length)*24,135,235);
    revealTimer=setInterval(step,pace);
  }

  function startMouth(sentence,token){
    clearInterval(mouthTimer);
    let cursor=0;
    mouthTimer=setInterval(()=>{
      if(token!==speechToken)return;
      while(cursor<sentence.length&&/\s/.test(sentence[cursor]))cursor++;
      if(cursor>=sentence.length)cursor=0;
      setMouth(visemeAt(sentence,cursor));
      cursor+=1+Math.floor(Math.random()*2);
    },92);
  }

  function speakSentence(sentence,token){
    return new Promise(resolve=>{
      if(token!==speechToken)return resolve();
      activeSpeechResolve=resolve;
      textNode.textContent='';
      bubble.classList.add('visible');
      placeBubble();
      startProgressiveFallback(sentence,token);
      startMouth(sentence,token);

      const done=()=>{
        if(activeSpeechResolve===resolve)activeSpeechResolve=null;
        clearInterval(mouthTimer);mouthTimer=null;
        clearInterval(revealTimer);revealTimer=null;
        clearTimeout(safetyTimer);safetyTimer=null;
        textNode.textContent=sentence;
        setMouth('rest');
        resolve();
      };

      const canSpeak='speechSynthesis' in window&&'SpeechSynthesisUtterance' in window;
      if(!canSpeak){
        safetyTimer=setTimeout(done,Math.max(1900,Math.min(11000,sentence.length*64)));
        return;
      }

      try{window.speechSynthesis.cancel();}catch{}
      const u=new SpeechSynthesisUtterance(sentence);
      utterance=u;
      const voice=bestVoice();
      if(voice)u.voice=voice;
      u.lang=voice?.lang||'es-AR';
      u.rate=.94;
      u.pitch=.98;
      u.volume=1;
      guide.dataset.oneVoice=voice?.name||u.lang;
      u.onboundary=event=>{
        if(token!==speechToken)return;
        const idx=Number(event.charIndex)||0;
        revealThroughChar(sentence,idx);
        setMouth(visemeAt(sentence,idx));
      };
      u.onend=done;
      u.onerror=done;
      window.speechSynthesis.speak(u);
      safetyTimer=setTimeout(done,Math.max(4500,Math.min(18000,sentence.length*105)));
    });
  }

  async function narrate(text,{kind='intro',controlsAfter=true,stateAfter='attentive',segments=null,onSegment=null}={}){
    const clean=String(text||'').trim();
    if(!clean&&!segments?.length)return;
    cancelNarration();
    clearIdle();
    clearControlsTimer();
    hideControls();
    currentNarrationKind=kind;
    if(clean)lastNarration=clean;
    const token=++speechToken;
    const parts=segments?.length
      ?segments.map(x=>typeof x==='string'?{text:x}:x)
      :splitSentences(clean).map(x=>({text:x}));

    setState('talking');
    guide.classList.add('speaking');
    bubble.classList.add('visible');

    for(let i=0;i<parts.length;i++){
      if(token!==speechToken)return;
      const part=parts[i];
      onSegment?.(part,i);
      if(part.before)await part.before();
      await speakSentence(String(part.text||''),token);
      if(token!==speechToken)return;
      await sleep(105);
    }

    if(token!==speechToken)return;
    guide.classList.remove('speaking','blink');
    setMouth('smile');
    setState(stateAfter);
    setGazeToFocus();

    bubbleTimer=setTimeout(()=>{
      if(token!==speechToken)return;
      bubble.classList.remove('visible');
      if(controlsAfter){
        showControls('normal');
        scheduleIdle();
      }else if(stateAfter==='thinking'){
        scheduleBlink();
      }
    },540);
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

  async function moveToScene(sceneDef=scene()){
    const target=resolveTarget(sceneDef);
    const current=guide.getBoundingClientRect();
    const topPad=76;
    const bottomPad=96;
    const pad=8;
    const targetRect=target?.getBoundingClientRect();
    const side=intendedSide(sceneDef,targetRect);
    const x=side==='right'?Math.max(pad,innerWidth-current.width-10):pad;
    const y=innerWidth<760
      ?Math.max(topPad,innerHeight-current.height-bottomPad)
      :clamp(targetRect?targetRect.top+Math.min(targetRect.height*.35,150)-current.height/2:(parseFloat(guide.style.top)||118),topPad,Math.max(topPad,innerHeight-current.height-bottomPad));

    applyReserveEdge(y+current.height/2<innerHeight/2?'top':'bottom',target,{scroll:true});
    if(target)await sleep(innerWidth<760?560:360);

    hideControls();
    guide.classList.add('moving');
    updateFacingFromPosition(side);

    const afterScroll=guide.getBoundingClientRect();
    const dx=x-afterScroll.left;
    const dy=y-afterScroll.top;
    const motion=guide.animate(
      [
        {transform:'translate3d(0,0,0) scale(1)'},
        {transform:'translate3d('+(dx*.08)+'px,'+(dy*.03)+'px,0) scale(.99)',offset:.13},
        {transform:'translate3d('+(dx*.90)+'px,'+(dy*.90)+'px,0) scale(.985)',offset:.80},
        {transform:'translate3d('+dx+'px,'+dy+'px,0) scale(1)'}
      ],
      {duration:690,easing:'cubic-bezier(.22,.8,.25,1)',fill:'forwards'}
    );
    await motion.finished.catch(()=>{});
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

  function rectsOverlap(a,b,pad=4){
    return a.left<b.right+pad&&a.right>b.left-pad&&a.top<b.bottom+pad&&a.bottom>b.top-pad;
  }

  function placeBubble(){
    const r=guide.getBoundingClientRect();
    const pad=8;
    const gap=8;
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
    let top=clamp(r.top+18,pad,Math.max(pad,innerHeight-height-pad));

    const target=resolveTarget();
    const tr=target?.getBoundingClientRect();
    let br={left,top,right:left+width,bottom:top+height};
    if(tr&&rectsOverlap(br,tr,8)){
      const above=tr.top-height-12;
      const below=tr.bottom+12;
      if(above>=pad)top=above;
      else if(below+height<=innerHeight-pad)top=below;
      else top=clamp(top+(top<tr.top?-36:36),pad,Math.max(pad,innerHeight-height-pad));
      br={left,top,right:left+width,bottom:top+height};
    }

    bubble.style.setProperty('left',left+'px','important');
    bubble.style.setProperty('top',top+'px','important');
    bubble.dataset.pointer=side==='right'?'right':'left';
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
    guide.classList.add('tablet-reading');
    setState('tablet-reading');
    setMouth('smile');
    setGazeToFocus();
    scheduleBlink();
  }

  function exitTablet(){
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

  async function clarityCheck(){
    if(processActive||guide.classList.contains('speaking'))return;
    exitTablet();
    guide.style.setProperty('--one-gaze-x','0px');
    guide.style.setProperty('--one-gaze-y','0px');
    await narrate('¿Quedó claro lo que estamos viendo? Si querés puedo repetir la explicación. Si ya está claro, seguimos.',{kind:'clarity',controlsAfter:false,stateAfter:'attentive'});
    showControls('clarity');
  }

  function scheduleIdle(){
    clearIdle();
    processActive=false;
    setState('attentive');
    setMouth('smile');
    setGazeToFocus();
    scheduleBlink();

    idleTimers.push(setTimeout(()=>{
      if(guide.classList.contains('speaking'))return;
      setState('waiting');
      setGazeToFocus();
      retractControls();
      scheduleBlink();
    },8500));

    idleTimers.push(setTimeout(()=>enterTablet(),16000));
    idleTimers.push(setTimeout(()=>contentWatch(),30000));
    idleTimers.push(setTimeout(()=>clarityCheck(),47000));
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
    clearIdle();
    clearTimeout(processSpeakTimer);
    cancelNarration();
    hideControls();
    setState('thinking');
    setMouth('rest');
    const message=processText(kind,payload);
    textNode.textContent=message;
    bubble.classList.add('visible');
    placeBubble();
    scheduleBlink();

    if(['embedding','llm','vector_search'].includes(payload.phase)){
      const phase=payload.phase;
      processSpeakTimer=setTimeout(()=>{
        if(processActive&&processPhase===phase){
          narrate(message,{kind:'process',controlsAfter:false,stateAfter:'thinking'});
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
      cancelNarration();
      clearIdle();
      hideControls();
      bubble.classList.remove('visible');
      setState('thinking');
      setMouth('rest');
      setGazeToFocus();
      scheduleBlink();
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
      narrate('La operación no terminó correctamente. Revisá el mensaje de error de esta sección y volvé a intentarlo.',{kind:'error'});
      return;
    }

    if(event==='DOCUMENT_OPENED'||event==='DOCUMENT_RESTORED'||event==='PARAMETER_CHANGED')activity('listening');

    const sceneDef=scene();
    if(event===sceneDef.gate){
      processActive=false;
      clearTimeout(processSpeakTimer);
      cancelNarration();
      $(sceneDef.actionTarget)?.classList.remove('one-action-required');
      updateControls();
      const result=eventResultNarration(sceneDef,event,payload);
      if(result){
        lastNarration=result;
        narrate(result,{kind:'result'});
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
      cancelNarration();
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
      const y=clamp(event.clientY-drag.dy,68,Math.max(68,innerHeight-r.height-88));
      guide.style.left=x+'px';
      guide.style.top=y+'px';
      guide.style.right='auto';
      updateFacingFromPosition();
      syncReserveFromGuide();
      setGazeToFocus();
      if(bubble.classList.contains('visible'))placeBubble();
    });

    const end=event=>{
      if(!drag||drag.id!==event.pointerId)return;
      drag=null;
      guide.classList.remove('dragging');
      updateFacingFromPosition();
      syncReserveFromGuide();
      if(!dragged){
        if(controls.classList.contains('retracted')||!controls.classList.contains('visible'))showControls('normal');
        else repeatCurrent();
      }else{
        showControls('normal');
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
    updateFacingFromPosition();
    syncReserveFromGuide();
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
