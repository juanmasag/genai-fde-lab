import crypto from 'crypto';

const SPEECH_KEY=process.env.AZURE_SPEECH_KEY||process.env.SPEECH_KEY||'';
const SPEECH_REGION=process.env.AZURE_SPEECH_REGION||process.env.SPEECH_REGION||'';
const DEFAULT_VOICE=process.env.AZURE_SPEECH_VOICE||'es-AR-TomasNeural';
const cache=new Map();
let sdkPromise=null;

const ticksToMs=value=>Number(value||0)/10000;

function escapeXml(value){
  return String(value||'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&apos;');
}

function speechSegments(payload){
  const raw=Array.isArray(payload.segments)&&payload.segments.length
    ?payload.segments
    :[{id:'main',speechText:payload.speechText||payload.text||''}];
  return raw.map((item,index)=>({
    id:String(item.id??index),
    speechText:String(item.speechText||item.text||'').replace(/\s+/g,' ').trim()
  })).filter(item=>item.speechText);
}

function buildSsml(payload,voice=DEFAULT_VOICE){
  const segments=speechSegments(payload);
  const body=segments.map((segment,index)=>{
    const bookmark='<bookmark mark="seg-'+index+'"/>';
    return bookmark+escapeXml(segment.speechText);
  }).join('<break time="110ms"/>');
  return '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="es-AR">'
    +'<voice name="'+escapeXml(voice)+'">'
    +'<prosody rate="0%" pitch="0%">'+body+'</prosody>'
    +'</voice></speak>';
}

async function loadSdk(){
  if(!sdkPromise){
    sdkPromise=import('microsoft-cognitiveservices-speech-sdk').then(module=>module.default||module);
  }
  return sdkPromise;
}

function remember(key,value){
  cache.set(key,value);
  if(cache.size>64){
    const first=cache.keys().next().value;
    cache.delete(first);
  }
}

export function oneTtsStatus(){
  return {
    provider:'azure-speech',
    configured:Boolean(SPEECH_KEY&&SPEECH_REGION),
    voice:DEFAULT_VOICE,
    region:SPEECH_REGION||null
  };
}

export async function synthesizeOneSpeech(payload={}){
  if(!SPEECH_KEY||!SPEECH_REGION){
    return {...oneTtsStatus(),available:false,reason:'azure-not-configured'};
  }

  const voice=String(payload.voice||DEFAULT_VOICE);
  const segments=speechSegments(payload);
  if(!segments.length)return {...oneTtsStatus(),available:false,reason:'empty-speech'};
  const totalChars=segments.reduce((sum,item)=>sum+item.speechText.length,0);
  if(totalChars>7000)throw new Error('La narración supera el máximo permitido para ONE TTS.');

  const ssml=buildSsml({segments},voice);
  const cacheKey=crypto.createHash('sha256').update(voice+'\n'+ssml).digest('hex');
  if(cache.has(cacheKey))return {...cache.get(cacheKey),cached:true};

  let sdk;
  try{sdk=await loadSdk();}
  catch(error){
    return {...oneTtsStatus(),available:false,reason:'azure-speech-sdk-missing',detail:error.message};
  }

  const speechConfig=sdk.SpeechConfig.fromSubscription(SPEECH_KEY,SPEECH_REGION);
  speechConfig.speechSynthesisVoiceName=voice;
  speechConfig.speechSynthesisOutputFormat=sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;
  const synthesizer=new sdk.SpeechSynthesizer(speechConfig,null);
  const words=[];
  const visemes=[];
  const bookmarks=[];

  synthesizer.wordBoundary=(_sender,event)=>{
    words.push({
      audioOffsetMs:ticksToMs(event.audioOffset),
      durationMs:ticksToMs(event.duration),
      text:String(event.text||''),
      textOffset:Number(event.textOffset||0),
      wordLength:Number(event.wordLength||0),
      boundaryType:Number(event.boundaryType||0)
    });
  };
  synthesizer.visemeReceived=(_sender,event)=>{
    visemes.push({
      audioOffsetMs:ticksToMs(event.audioOffset),
      visemeId:Number(event.visemeId||0)
    });
  };
  synthesizer.bookmarkReached=(_sender,event)=>{
    bookmarks.push({
      audioOffsetMs:ticksToMs(event.audioOffset),
      text:String(event.text||'')
    });
  };

  try{
    const result=await new Promise((resolve,reject)=>{
      synthesizer.speakSsmlAsync(ssml,resolve,reject);
    });
    if(result.reason!==sdk.ResultReason.SynthesizingAudioCompleted){
      const details=sdk.SpeechSynthesisCancellationDetails?.fromResult
        ?sdk.SpeechSynthesisCancellationDetails.fromResult(result)
        :null;
      throw new Error(details?.errorDetails||'Azure Speech no completó la síntesis.');
    }
    const audio=Buffer.from(result.audioData);
    const value={
      available:true,
      provider:'azure-speech',
      voice,
      mimeType:'audio/mpeg',
      audioBase64:audio.toString('base64'),
      words,
      visemes,
      bookmarks,
      segments
    };
    remember(cacheKey,value);
    return {...value,cached:false};
  }finally{
    synthesizer.close();
  }
}
