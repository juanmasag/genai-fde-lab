# Roadmap

## Fase 0 - Base profesional

### LAB-00 — Baseline
Objetivo: entorno reproducible, convenciones, CI mínima y plantilla estándar para labs.

**Criterios de aceptación**
- Python fijado y entorno reproducible.
- Lint + tests en GitHub Actions.
- .env.example y manejo seguro de secretos.
- Plantilla común de README y ADR.

---

## Fase 1 - Retrieval

### LAB-01 — RAG + pgvector [COMPLETED]
Construir un RAG mínimo sobre documentación sintética de negocio.

**Cierre:** 2026-10-04. Pipeline RAG E2E, pgvector, grounding, citas y dataset de validación 5+3+1 verificados. La evaluación cuantitativa del retrieval queda deliberadamente para LAB-02.

Aprender:
- chunking
- embeddings
- metadata
- semantic search
- top-k
- grounding
- citations

**Entrega realizada:** backend RAG que recibe una pregunta y responde con fuentes, más una PWA educativa para inspeccionar cada etapa del pipeline.

### LAB-02 — Retrieval Evaluation
Medir la calidad del retrieval.

Aprender:
- golden dataset
- recall@k
- precision@k
- MRR
- failure analysis

**Entrega:** reporte automático de métricas y casos fallidos.

---

## Fase 2 - Agentes

### LAB-03 — LangGraph
Reimplementar un flujo pequeño Architect -> Developer -> QA con estado y retries.

Aprender:
- state
- nodes
- edges
- routing
- checkpointing
- human-in-the-loop

### LAB-04 — MCP
Crear un servidor MCP que exponga recursos y tools de un dominio simple.

Aprender:
- tools
- resources
- prompts
- contratos de entrada/salida
- permisos

---

## Fase 3 - Calidad GenAI

### LAB-05 — LLM Evals
Suite de evaluación para outputs estructurados.

Aprender:
- deterministic checks
- schema validation
- golden cases
- LLM-as-judge
- regression testing

### LAB-06 — Observabilidad
Instrumentar una app GenAI.

Medir:
- latency
- tokens
- errores
- retries
- provider/model
- tool calls
- trazas

---

## Fase 4 - Producción

### LAB-07 — FastAPI + Docker + CI
Empaquetar una API GenAI con healthcheck, tests y pipeline.

### LAB-08 — Google Cloud
Desplegar en Cloud Run con Vertex AI y Secret Manager.

Aprender:
- IAM
- service accounts
- logs
- secrets
- deployment
- rollback

### LAB-09 — Security & Guardrails
Probar:
- prompt injection
- PII
- input validation
- output validation
- SSRF
- secret leakage
- rate limiting

---

## Fase 5 - Capstone

### LAB-10 — Forward Deployed Case
Simular un engagement real:

1. Discovery
2. Definición del problema
3. Métricas de éxito
4. Prototipo
5. Arquitectura
6. Evaluación
7. Producción
8. Demo
9. Retro

El objetivo no es agregar tecnología por agregarla, sino demostrar capacidad para transformar un problema operativo en una solución GenAI medible.
