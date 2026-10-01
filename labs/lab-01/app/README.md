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
tailscale serve --bg --https=8446 4173
```

Abrir la URL HTTPS informada por Tailscale desde un teléfono conectado al mismo tailnet. Al servirse por HTTPS, puede instalarse como PWA.
