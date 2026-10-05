# RAG Engine Lab PWA

**Estado del LAB-01 RAG:** ✅ completado el 2026-10-04. La definición de cierre, criterios de aceptación y resultado final están en [`../README.md`](../README.md). Las secciones de UX/personaje de este documento conservan historial de implementación y no forman parte de los criterios de cierre del mini-proyecto RAG.

Aplicación funcional y educativa para inspeccionar un pipeline RAG de punta a punta.

## Qué ejecuta de verdad

- chunking configurable y overlap;
- embeddings reales con `nomic-embed-text` mediante Ollama;
- embeddings de 768 dimensiones;
- PostgreSQL + pgvector;
- búsqueda por similitud coseno;
- `top_k` y `threshold` configurables;
- grounding y abstención;
- generación local con `qwen3:8b`;
- citas por `chunk_id` y validación de referencias;
- PWA responsive para escritorio y teléfono.

La visualización interna del transformer es didáctica. El transformer real se ejecuta en Ollama, pero sus matrices internas de atención no se exponen como si fueran datos observados.

## Visualizaciones

- ángulo entre el vector de la pregunta y cada chunk a partir de la similitud coseno;
- ranking de similitud;
- muestra de dimensiones reales del embedding;
- chunks y metadata;
- contenido almacenado en la base vectorial;
- prompt grounded enviado al LLM;
- respuesta y fuentes.

## Ejecutar localmente

```bash
npm install
docker compose up -d
npm run build
npm start
```

La app queda en `http://127.0.0.1:4173`.

También requiere Ollama con:

```bash
ollama pull nomic-embed-text
ollama pull qwen3:8b
```

## Supabase

Supabase usa PostgreSQL y soporta pgvector. El esquema compatible está en `sql/supabase.sql`.

1. Ejecutar `sql/supabase.sql` en el proyecto Supabase.
2. Copiar `.env.example` a `.env`.
3. Configurar `DATABASE_URL` con la conexión PostgreSQL de Supabase.
4. Configurar `PGSSL=true`.

No se versionan credenciales.

## Acceso móvil con Tailscale

La aplicación puede publicarse dentro del tailnet sin abrirla a Internet:

```bash
tailscale serve --bg --https=8447 4173
```

Abrir la URL HTTPS informada por Tailscale desde un teléfono conectado al mismo tailnet. Al servirse por HTTPS, puede instalarse como PWA.

## Recorrido didáctico actual

La PWA incluye un documento corto de laboratorio (`data/guia-soporte.md`) y un recorrido visual que cubre documento, tokens, chunks, transformer, base vectorial, pregunta, retrieval, LLM y respuesta.

El **Microscopio del transformer** ejecuta en el navegador un transformer mínimo de 4 dimensiones con matrices fijas para poder inspeccionar la matemática: vector inicial, codificación posicional, Q/K/V, producto punto escalado, softmax, atención, vector contextual, pooling y una proyección final. Este cálculo está rotulado como educativo y no pretende ser una extracción de los pesos internos de Ollama. Al lado se muestra el embedding real de 768 dimensiones producido por `nomic-embed-text`.

La vista **Base vectorial en vivo** reproduce eventos que provienen de operaciones reales del backend: `BEGIN`, inserción del documento, inserciones de chunks+embeddings y `COMMIT`. La búsqueda posterior se limita al documento actualmente ingerido para que cambiar el documento cambie coherentemente todo el recorrido.

## Coherencia entre módulos

La previsualización y la ingesta llaman al mismo `chunkDocument()` del backend, por lo que `chunk_size`, `overlap`, límites y tokens son los mismos antes y después de persistir. La metadata de pgvector conserva `token_start`, `token_end`, `token_count`, `overlap_from_previous` y `overlap_to_next`.

El overlap visual se muestra dentro del propio chunk: los tokens verdes al final de un chunk son los que se repiten al comienzo del chunk siguiente. Si una sección completa entra en un solo chunk, no se muestra overlap porque no existe un límite interno real.

Ejecutar la auditoría de integración con:

```bash
npm run check:integration
```

La validación final del comportamiento RAG usa el dataset 5+3+1 documentado en `data/validation-cases.json`:

```bash
npm run check:rag-validation
```

Para ejecutar ambos grupos de validación y reproducir el cierre completo de LAB-01:

```bash
npm run check:lab
```

## Límites adaptativos de chunking

- El máximo de `chunk_size` se ajusta a la cantidad real de tokens del documento.
- El máximo de `overlap` se ajusta siempre a `chunk_size - 1`.
- `overlap` permanece habilitado aunque todo el documento entre en un único chunk. En ese caso el valor queda configurado, pero no tiene efecto hasta que haya al menos dos chunks.
- El chunking se calcula sobre la secuencia completa de tokens del documento y conserva las secciones atravesadas como metadata. Esto permite que `chunk_size = tokens del documento` produzca realmente un único chunk.

## Stack visual educativo

La interfaz se construye con Vite y cuatro librerías de propósito específico:

- **Motion 14.0.0 (MIT):** transiciones y movimiento entre etapas.
- **D3 7.9.0 (ISC):** visualizaciones basadas en los datos reales del retrieval, especialmente geometría vectorial.
- **XState 5.33.2 (MIT):** máquina de estados del recorrido educativo para evitar desincronización entre Anterior/Siguiente, pantalla activa y animaciones.
- **Lucide 1.51.0 (ISC):** iconos SVG estables, sin depender de emojis o glifos del dispositivo.
- **Vite 8.3.2 (MIT):** build, tree-shaking, assets versionados y modo de desarrollo.

Las versiones están fijadas en `package.json`/`package-lock.json`. El build de producción se genera en `dist/` y Express sirve ese resultado.

### Validación del stack

```bash
npm audit
npm run build
npm run check:integration
```

La migración inicial fue validada con `npm audit` sin vulnerabilidades conocidas, render móvil en Chromium, pruebas E2E de preview/ingesta/pgvector/retrieval y acceso HTTPS por Tailscale.

## Desarrollo de la experiencia educativa

La evolución de GUI/UX está documentada separadamente para mantener claro qué problema resuelve cada herramienta y cómo se verifica cada representación:

- [`DEVELOPMENT_PLAN.md`](./DEVELOPMENT_PLAN.md): fases, criterios de aceptación y definición de terminado.
- [`GUI_UX_ARCHITECTURE.md`](./GUI_UX_ARCHITECTURE.md): arquitectura escena + inspector, responsabilidades de Vite/XState/Motion/D3/Lucide y distinción entre cálculos reales y modelos didácticos.

La primera escena implementada recorre **Documento → Tokens → Chunks + overlap** usando exclusivamente el resultado real de `/api/chunk-preview`.


## ONE · comportamiento interactivo

LAB-01 usa el rig facial aprobado de ONE desde `assets/characters/one/source/rig/facial-v2/generated`. El build sincroniza esas capas al runtime mediante `npm run sync:one`; no mantiene una copia visual paralela creada a mano.

El guía flotante aplica estas reglas:

- el contenido audible se toma del mismo nodo de texto que muestra el globo; la frase enviada a `SpeechSynthesisUtterance` es exactamente el texto visible del globo;
- durante operaciones reales de ingesta/retrieval usa el estado `thinking`, y durante entrada del usuario usa `listening`;
- sin interacción progresa por `attentive → waiting → curious → resting → attentive`, con parpadeos y micro-movimiento propios de cada estado;
- el rig se orienta siempre hacia el contenido: si ONE está en la mitad derecha de la pantalla se refleja horizontalmente y la antena apunta a la izquierda; si está en la mitad izquierda conserva la orientación canónica y la antena apunta a la derecha;
- ojos, cejas y bocas son capas independientes del rig facial v2; no se regeneran cabezas completas para cada estado.

La voz depende del motor Web Speech disponible en el navegador/dispositivo y prioriza una voz `es-AR`, luego cualquier voz `es-*`. Si el dispositivo no expone síntesis de voz, la actuación facial sigue ejecutándose como fallback visual.

Evidencia visual de la validación móvil se conserva en `qa/one-behavior-v11-mobile.png` y `qa/one-behavior-v11-left-speaking.png`.


## ONE Guided Lab v1

ONE now owns the narrative flow of LAB-01 while the learner keeps control of real operations.

### Narrative controls

The persistent ONE component exposes only three narrative hooks after each explanation:

- **Atrás**: reconstructs the previous guided scene.
- **Repetir**: repeats the current explanation.
- **Siguiente**: advances only when the current scene has no pending real action.

Legacy guide/journey navigation, per-scene previous/next controls and the generic pipeline play button are hidden while guided mode is active. They remain in the DOM as compatibility primitives, but ONE is the visible narrative controller.

### Real-action gates

The following learner actions remain visible and functional because they are part of the experiment rather than navigation:

- open or restore a document;
- edit chunk size and overlap;
- run **Previsualizar chunks**;
- open **Ver cálculo** before the transformer walkthrough;
- run **Ejecutar ingesta real / Ejecutar ingesta y ver proceso**;
- edit the question, top-k and threshold;
- run **Ejecutar análisis E2E**;
- inspect real PostgreSQL/pgvector rows and results.

ONE listens to those actions through explicit hooks. Preview, ingest and analysis place ONE in a thinking state while the operation is running; the result narration is generated only after the real UI/state has updated.

### Guided scenes

The v1 script covers:

1. welcome and source document;
2. chunk parameters and real preview;
3. document → tokens → chunks/overlap;
4. transformer calculation gate;
5. tokens, vector, position, Q/K/V, scores, attention, context and pooling;
6. real pgvector ingestion and transaction result;
7. question/retrieval configuration and real E2E analysis;
8. pipeline replay, vector geometry, grounded answer and pgvector browser;
9. closing summary.

Narration uses current runtime values such as token count, chunk configuration, stored rows, embedding dimensions, top-k, threshold, retrieval scores, accepted candidates, citations and model name.

### Speech contract

For every utterance a single narration string is the source of truth for:

- speech synthesis;
- progressive bubble text;
- mouth/viseme animation.

The bubble becomes visible when narration starts. Words are progressively revealed while ONE speaks. On speech end the mouth immediately returns to a closed/resting expression; the completed bubble remains briefly for reading and then disappears before the narrative controls appear.

### Visual guidance

Each guided scene defines a focus target. ONE highlights the current target, looks toward it with a small eye-layer offset, chooses a side of the viewport, and keeps a left/right dead zone to avoid rapid flipping near screen center. On mobile ONE stays low in the viewport so the focused laboratory content remains readable above it.

The tablet/hand idle sequence, advanced clarity check and richer prop choreography remain the next increment after user validation of Guided Lab v1.


## ONE Guided Lab v2

Guided Lab v2 extends the v1 contract from a narrated walkthrough into a context-aware tutor.

### Teaching from first principles

ONE no longer assumes that the learner already knows the vocabulary. The welcome explains that **RAG** means **Retrieval-Augmented Generation / Generación Aumentada por Recuperación**, why retrieval is useful for private/current knowledge, and how grounding reduces unsupported answers. The guided scenes also define the concepts as they first appear: source document, chunk, chunk size, overlap, token, transformer, vector, Q/K/V, attention, pooling, embedding, pgvector, top-k, threshold, retrieval, context, LLM, grounding, citations and metadata.

The narration still uses live values from the laboratory where appropriate.

### Opposite-side speech and dynamic stage reserve

ONE and the speech bubble never intentionally occupy the same side:

- ONE on the right -> bubble on the left.
- ONE on the left -> bubble on the right.

The bubble also checks the current focus target and moves vertically if needed to avoid covering it.

A real blank reserve is inserted adjacent to the current focus target. On mobile it is large enough to contain ONE, its speech and navigation footprint. The reserve follows the vertical location of ONE:

- ONE dragged toward the top -> reserve moves before the target and the content shifts down.
- ONE dragged toward the bottom -> reserve moves after the target and the content shifts up.

The page remains normally scrollable.

### Real process narration

The backend now exposes additive NDJSON progress endpoints without removing the existing JSON endpoints:

- `POST /api/ingest-stream`
- `POST /api/analyze-stream`

Ingestion reports real phases including chunking, embedding generation, transaction start, document/chunk inserts and commit/rollback. E2E analysis reports question embedding, vector search, retrieval/filtering, context construction, LLM generation or abstention, and citation validation.

ONE enters a visibly distinct thinking state and explains those real phases while they happen. Longer phases such as embedding, vector search and LLM generation can also be spoken if they last long enough.

### Progressive disclosure and synchronized pipeline

Only the real action relevant to the current guided scene is exposed: preview, calculation inspector, real ingestion or E2E analysis. Future actions remain concealed until the walkthrough reaches them.

The pipeline recap is no longer a generic narration over an independent autoplay timer. ONE advances the pipeline stage immediately before explaining that exact stage.

### Idle acting

After an explanation and a period without interaction, ONE progresses through:

1. attentive / waiting;
2. tablet-reading using the canonical rear-tablet and hand assets;
3. content-watch with a closed smile and gaze toward the active content;
4. a one-time clarity check: “¿Quedó claro…?”, with **Repetir** and **Seguir**.

Narrative controls retract during longer observation periods and can be brought back by interacting with ONE.

### Voice selection

Speech still uses the browser Web Speech engine because voice availability is device-specific. v2 ranks the installed Spanish voices and prefers, in order, a high-quality Argentine/Latin-American voice and then the best natural Spanish voice available. Neural/natural/online voices from the platform receive preference, while legacy robotic engines receive a strong penalty. The selected voice uses a slightly slower, lower-pitch delivery than v1.

The exact voice heard on a phone must still be validated on that phone because Android/browser voice inventories differ.


## ONE Neural Speech v15

ONE no longer treats browser Web Speech as the primary voice engine. The preferred path is a server-side Azure Speech synthesis request using the Argentine male voice `es-AR-TomasNeural`.

### Provider architecture

The browser sends only narration text to `POST /api/one/tts`. Azure credentials stay on the Express server and are never exposed to JavaScript delivered to the phone.

When Azure is configured, one synthesis result contains:

- a complete MP3 for uninterrupted playback;
- word-boundary audio offsets;
- viseme offsets for the facial rig;
- bookmarks that identify narration segments.

The browser uses the audio player's own `currentTime` as the common clock for progressive bubble text and mouth changes. Moving ONE changes only layout; it does not restart or replace the audio object.

If the Speech SDK cannot produce timing metadata, the server makes a second attempt through Azure Speech REST to preserve a continuous neural MP3 and the client estimates text/mouth timing from the real audio duration. Browser Web Speech is now the last fallback only.

### Display text versus spoken text

The text shown in the educational bubble is no longer required to be the exact string synthesized by the voice. `src/one-speech-text.js` converts technical display copy into a more conversational spoken form and provides pronunciation aliases for terms such as RAG, pgvector, E2E, LLM, top-k, threshold, Q/K/V, WordPiece and model names.

This lets ONE teach with precise written terminology while speaking it naturally.

### Configuration

Copy the Azure Speech settings into a local untracked `.env`:

```bash
AZURE_SPEECH_KEY=<secret>
AZURE_SPEECH_REGION=<resource-region>
AZURE_SPEECH_VOICE=es-AR-TomasNeural
```

Do not commit the key.

Runtime status can be checked through:

```text
GET /api/one/tts/status
GET /api/health
```

When Azure is not configured, these endpoints report that state and ONE continues through the Web Speech fallback rather than breaking the laboratory.

### Drag geometry

The draggable box now matches the visible rig instead of using the former padded transparent stage. While dragging, the guide has no background, border, shadow or backdrop filter. This allows the visible character to approach viewport edges without the old invisible margin controlling its position.
