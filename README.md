# GenAI FDE Lab

Laboratorio práctico para consolidar las competencias necesarias para desempeñarme como **Forward Deployed Engineer / Applied GenAI Engineer**.

Este repositorio no busca simular experiencia que todavía no tengo. Cada laboratorio convierte un gap técnico en un mini-proyecto funcional, reproducible y verificable.

## Objetivo

Construir evidencia práctica en las áreas que más se repiten en roles FDE GenAI:

- RAG y búsqueda semántica
- Vector databases
- Agentes y orquestación
- LangGraph
- MCP
- LLM evals
- Observabilidad
- APIs y producción
- Docker y CI/CD
- Cloud / Vertex AI / Cloud Run
- Seguridad, secretos y guardrails

## Principio de trabajo

Cada laboratorio debe incluir:

1. Problema real o caso de uso.
2. Arquitectura mínima.
3. Implementación funcional.
4. Tests o criterios verificables.
5. Métricas cuando apliquen.
6. README ejecutable.
7. Qué aprendí.
8. Qué limitaciones siguen abiertas.

## Roadmap

| Lab | Tema | Estado |
|---|---|---|
| LAB-00 | Baseline y entorno reproducible | Planned |
| LAB-01 | RAG + embeddings + pgvector | Planned |
| LAB-02 | Retrieval evaluation | Planned |
| LAB-03 | LangGraph multi-agent workflow | Planned |
| LAB-04 | MCP server + tools | Planned |
| LAB-05 | LLM evals + regression suite | Planned |
| LAB-06 | Observabilidad y tracing | Planned |
| LAB-07 | FastAPI + Docker + CI | Planned |
| LAB-08 | Cloud Run + Vertex AI | Planned |
| LAB-09 | Security, guardrails y secrets | Planned |
| LAB-10 | Capstone FDE: discovery -> prototype -> production | Planned |

Ver [ROADMAP.md](ROADMAP.md) para el detalle.

## Evidencia previa relacionada

Este laboratorio complementa proyectos ya desarrollados:

- **ONE**: orquestación multiagente, handoffs, QA y monitoreo.
- **AMS Qlik Assistant**: Gemini multimodal, extracción estructurada e integraciones empresariales.
- **Asistente Cognitivo**: React + Supabase + realtime + workflow operativo.
- **Family Bot**: automatización serverless e integración de APIs.

La diferencia de este repositorio es que cada tecnología se estudia y valida de forma aislada antes de reutilizarla en proyectos mayores.

## Definition of Done

Un lab sólo se considera terminado cuando:

- se puede ejecutar desde cero siguiendo el README;
- tiene al menos una validación automatizada o criterio medible;
- no contiene secretos;
- documenta decisiones y trade-offs;
- incluye una demo o evidencia reproducible;
- explica qué parte fue comprendida y practicada directamente.

## Stack objetivo

Python, FastAPI, PostgreSQL/pgvector, LangGraph, MCP, pytest, Docker, GitHub Actions, Google Cloud, Vertex AI y herramientas de observabilidad/evaluación de LLMs.

## Licencia

MIT.
