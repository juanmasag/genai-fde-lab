# RAG Engine Lab PWA

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
docker compose up -d
npm install
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

La PWA incluye un documento corto de laboratorio (`data/guia-soporte.md`) y un guía visual llamado **Vector**. El recorrido cubre documento, tokens, chunks, transformer, base vectorial, pregunta, retrieval, LLM y respuesta.

El **Microscopio del transformer** ejecuta en el navegador un transformer mínimo de 4 dimensiones con matrices fijas para poder inspeccionar la matemática: vector inicial, codificación posicional, Q/K/V, producto punto escalado, softmax, atención, vector contextual, pooling y una proyección final. Este cálculo está rotulado como educativo y no pretende ser una extracción de los pesos internos de Ollama. Al lado se muestra el embedding real de 768 dimensiones producido por `nomic-embed-text`.

La vista **Base vectorial en vivo** reproduce eventos que provienen de operaciones reales del backend: `BEGIN`, inserción del documento, inserciones de chunks+embeddings y `COMMIT`. La búsqueda posterior se limita al documento actualmente ingerido para que cambiar el documento cambie coherentemente todo el recorrido.

## Coherencia entre módulos

La previsualización y la ingesta llaman al mismo `chunkDocument()` del backend, por lo que `chunk_size`, `overlap`, límites y tokens son los mismos antes y después de persistir. La metadata de pgvector conserva `token_start`, `token_end`, `token_count`, `overlap_from_previous` y `overlap_to_next`.

El overlap visual se muestra dentro del propio chunk: los tokens verdes al final de un chunk son los que se repiten al comienzo del chunk siguiente. Si una sección completa entra en un solo chunk, no se muestra overlap porque no existe un límite interno real.

Ejecutar la auditoría de integración con:

```bash
npm run check:integration
```

## Límites adaptativos de chunking

- El máximo de `chunk_size` se ajusta a la cantidad real de tokens del documento.
- El máximo de `overlap` se ajusta siempre a `chunk_size - 1`.
- `overlap` permanece habilitado aunque todo el documento entre en un único chunk. En ese caso el valor queda configurado, pero no tiene efecto hasta que haya al menos dos chunks.
- El chunking se calcula sobre la secuencia completa de tokens del documento y conserva las secciones atravesadas como metadata. Esto permite que `chunk_size = tokens del documento` produzca realmente un único chunk.
