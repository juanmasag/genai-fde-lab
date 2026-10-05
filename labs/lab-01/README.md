# LAB-01 — DocuAyuda: RAG desde cero

**Estado:** ✅ **COMPLETED — 2026-10-04**

## Objetivo

Construir un RAG pequeño, entendible, funcional y verificable para aprender el flujo completo sin depender de un framework que oculte las etapas.

El objetivo didáctico del laboratorio es poder explicar y practicar:

```text
documento
→ chunking + overlap
→ embeddings
→ PostgreSQL + pgvector
→ embedding de la pregunta
→ búsqueda por similitud
→ top-k + threshold
→ chunks recuperados
→ contexto grounded
→ LLM
→ respuesta + citas / abstención
```

LAB-01 se considera cerrado porque ese flujo se ejecuta de punta a punta con datos reales, puede inspeccionarse y cuenta con validación automatizada.

## Caso de uso

DocuAyuda consulta documentación interna y responde utilizando sólo evidencia recuperada del documento activo. Si la evidencia no alcanza, debe abstenerse en lugar de inventar una respuesta.

El documento didáctico incluido es `app/data/guia-soporte.md`, aunque la aplicación permite probar otros textos Markdown/TXT.

## Qué se implementó y practicó

- tokenización visible para entender que token != palabra;
- `chunk_size` configurable;
- `overlap` configurable y verificable entre límites;
- embeddings reales con `nomic-embed-text` mediante Ollama;
- vectores de 768 dimensiones;
- PostgreSQL + extensión pgvector;
- texto + metadata + embedding persistidos por chunk;
- metadata con documento, sección, `chunk_id`, posiciones y overlap;
- embedding real de la pregunta;
- búsqueda por similitud coseno;
- ranking de candidatos;
- `top_k` y `threshold` independientes;
- recuperación limitada al documento activo;
- construcción explícita del contexto enviado al LLM;
- generación grounded con `qwen3:8b`;
- abstención cuando la evidencia no alcanza;
- citas por `chunk_id`;
- validación para impedir citas de chunks no recuperados;
- inspector de chunks, vectores, scores, contexto, prompt, respuesta y base vectorial;
- visualización didáctica del transformer separada explícitamente de los embeddings reales.

## Arquitectura final

```text
Documento
   │
   ▼
Tokenizer / Chunker
   │  chunk_size + overlap
   ▼
Chunks + metadata
   │
   ▼
nomic-embed-text
   │
   ▼
PostgreSQL + pgvector
   ▲
   │ similitud coseno
   │
Pregunta → nomic-embed-text
             │
             ▼
         ranking top-k
             │
             ▼
          threshold
             │
             ▼
      evidencia aceptada
             │
             ▼
        prompt grounded
             │
             ▼
          qwen3:8b
             │
             ▼
 respuesta + citas / abstención
```

## Stack real utilizado

El plan inicial proponía Python + Gemini. Durante el laboratorio la implementación evolucionó a una aplicación local más visual, pero mantuvo intacto el objetivo de no esconder el pipeline RAG.

Stack final:

- Node.js + Express;
- Vite para la experiencia educativa;
- Ollama;
- `nomic-embed-text` para embeddings;
- `qwen3:8b` para generación;
- PostgreSQL 16 + pgvector;
- Docker Compose para PostgreSQL;
- JavaScript de integración y validación;
- PWA como interfaz de experimentación e inspección.

### Trade-off documentado

Se priorizó una interfaz interactiva en lugar de los scripts CLI planteados originalmente porque permite modificar parámetros y observar causalmente el mismo backend real. La PWA no reemplaza la lógica técnica: preview, ingesta, retrieval, contexto y generación provienen de los endpoints reales.

La visualización del transformer de 4 dimensiones es deliberadamente didáctica. No se presenta como telemetría interna de `nomic-embed-text`.

## Etapas del plan

### Etapa A — Vector playground ✅

Practicado mediante embeddings reales, similitud coseno, ángulo entre vectores y ranking visible.

Aprendizaje central: **similitud semántica no equivale a verdad factual**.

### Etapa B — Ingesta ✅

Implementado:

- lectura de documento;
- tokenización;
- chunking;
- overlap;
- metadata;
- embeddings;
- escritura transaccional en PostgreSQL + pgvector.

Preview e ingesta utilizan la misma función de chunking y se comprueba automáticamente que produzcan los mismos chunks.

### Etapa C — Retrieval visible ✅

El inspector muestra:

- posición/ranking;
- similitud;
- documento;
- sección;
- `chunk_id`;
- texto recuperado;
- aceptación/rechazo por threshold.

Esto permite distinguir un fallo de retrieval de un fallo posterior del LLM.

### Etapa D — RAG completo ✅

El análisis E2E:

1. genera el embedding de la pregunta;
2. recupera hasta `top_k` candidatos;
3. aplica `threshold`;
4. construye contexto sólo con evidencia aceptada;
5. envía esa evidencia al LLM;
6. exige grounding;
7. se abstiene cuando la información no alcanza;
8. valida las citas contra los chunks realmente recuperados.

### Etapa E — Validación 5+3+1 ✅

Dataset reproducible en:

- `app/data/validation-cases.json`
- `app/scripts/rag-validation-check.mjs`

Contiene exactamente:

- **5 preguntas con respuesta presente**;
- **3 preguntas sin respuesta**;
- **1 pregunta semánticamente relacionada con la documentación pero sin evidencia suficiente para contestarla**.

La última prueba es importante: el sistema recupera contenido relacionado con soporte, pero debe reconocer que ese contenido no especifica un SLA y abstenerse.

## Ejecutar desde cero

Desde `labs/lab-01/app`:

```bash
npm install
docker compose up -d
ollama pull nomic-embed-text
ollama pull qwen3:8b
npm run build
npm start
```

La app queda disponible en:

```text
http://127.0.0.1:4173
```

En otra terminal se pueden ejecutar las validaciones.

### Integración técnica

```bash
npm run check
```

Valida, entre otros puntos:

- preview == ingesta;
- overlap exacto;
- metadata en pgvector;
- retrieval acotado al documento;
- modelos utilizados;
- fases reales de ingesta;
- fases reales del análisis;
- cleanup de datos de auditoría.

### Validación pedagógica/RAG 5+3+1

```bash
npm run check:rag-validation
```

### Cierre completo del laboratorio

```bash
npm run check:lab
```

Ejecuta la validación técnica y después el dataset RAG final.

## Criterios de aceptación

- [x] Puedo explicar por qué cada chunk fue recuperado.
- [x] Puedo modificar `chunk_size`, `overlap`, `top_k` y `threshold` entendiendo el efecto esperado.
- [x] El sistema muestra metadata y fuentes.
- [x] El sistema no cita chunks que no fueron recuperados.
- [x] El sistema se abstiene cuando no existe evidencia suficiente.
- [x] Tests básicos e integración pasan.
- [x] Existe un dataset final 5+3+1 reproducible.
- [x] El proyecto puede ejecutarse siguiendo el README.
- [x] No hay secretos versionados.
- [x] Se documentan decisiones, simplificaciones y trade-offs.
- [x] Existe evidencia de lo aprendido en `docs/learning-log/LAB-01-RAG.md`.

## Qué queda fuera de LAB-01

No es necesario para considerar terminado este laboratorio:

- métricas formales de retrieval como recall@k, precision@k o MRR;
- reranking;
- hybrid search;
- evaluación automática a escala;
- autenticación;
- PDF/OCR;
- cloud;
- observabilidad de producción;
- guardrails avanzados.

La evaluación cuantitativa del retrieval corresponde a **LAB-02**.

## Resultado

LAB-01 deja un RAG funcional, inspeccionable y reproducible, pero el resultado principal no es la aplicación: es la capacidad de explicar qué ocurre entre un documento y una respuesta grounded, qué parámetros modifican el comportamiento y dónde buscar cuando el sistema falla.

**LAB-01 cerrado. Próximo paso: LAB-02 — Retrieval Evaluation.**

La evidencia final del cierre está resumida en [`CLOSURE.md`](./CLOSURE.md).
