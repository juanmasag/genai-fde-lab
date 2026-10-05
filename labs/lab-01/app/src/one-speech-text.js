const rules=[
  [/Retrieval[- ]Augmented Generation/gi,'Retrieval Augmented Generation'],
  [/Generación Aumentada por Recuperación/gi,'generación aumentada por recuperación'],
  [/\bRAG\b/g,'rag'],
  [/\bpgvector\b/gi,'pe ge vector'],
  [/\bPostgreSQL\b/gi,'Postgres'],
  [/\bE2E\b/g,'de punta a punta'],
  [/\bLLM\b/g,'ele ele eme'],
  [/\btop[ -]?k\b/gi,'top ká'],
  [/\bthreshold\b/gi,'umbral'],
  [/\bQ,\s*K\s*y\s*V\b/g,'query, key y value'],
  [/\bQ\b/g,'query'],
  [/\bK\b/g,'key'],
  [/\bV\b/g,'value'],
  [/\bSoftmax\b/gi,'soft max'],
  [/\bWordPiece\b/gi,'Word Piece'],
  [/\bnomic-embed-text\b/gi,'Nomic Embed Text'],
  [/\b(\d+)D\b/g,'$1 dimensiones'],
  [/\bchunk_id\b/gi,'identificador del chunk'],
  [/\bchunk\b/gi,'chunk'],
  [/\bchunks\b/gi,'chunks']
];

function conversationalize(text){
  return String(text||'')
    .replace(/RAG significa Retrieval[- ]Augmented Generation, o Generación Aumentada por Recuperación\.?/i,'Rag quiere decir Retrieval Augmented Generation. En español, generación aumentada por recuperación.')
    .replace(/Un chunk es un fragmento/gi,'Un chunk es, en pocas palabras, un fragmento')
    .replace(/Ingesta significa incorporar/gi,'Cuando hablamos de ingesta, nos referimos a incorporar')
    .replace(/Un token es una unidad de texto/gi,'Un token es una pequeña unidad de texto')
    .replace(/Un transformer es la arquitectura/gi,'Un transformer es una arquitectura')
    .replace(/Un embedding es un vector numérico/gi,'Un embedding es, básicamente, un vector numérico')
    .replace(/Retrieval significa recuperación/gi,'Retrieval quiere decir recuperación')
    .replace(/Grounding significa obligar al modelo/gi,'Grounding quiere decir hacer que el modelo');
}

function punctuationForSpeech(text){
  return String(text||'')
    .replace(/\s*→\s*/g,', después ')
    .replace(/\.\.\.+/g,'. ')
    .replace(/\s*·\s*/g,', ')
    .replace(/\s+/g,' ')
    .trim();
}

export function naturalSpeechText(displayText){
  let speech=punctuationForSpeech(conversationalize(displayText));
  for(const [pattern,replacement] of rules)speech=speech.replace(pattern,replacement);
  return speech
    .replace(/\b0\.(\d+)\b/g,'cero coma $1')
    .replace(/\s+/g,' ')
    .trim();
}

export function narrationPayload(displayText,explicitSpeechText=null){
  const display=String(displayText||'').trim();
  return {
    displayText:display,
    speechText:String(explicitSpeechText||naturalSpeechText(display)).trim()
  };
}
