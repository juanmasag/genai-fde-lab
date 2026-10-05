# LAB-01 — Cierre

**Estado:** ✅ COMPLETED  
**Fecha:** 2026-10-04

## Objetivo cerrado

Comprender y practicar un pipeline RAG de punta a punta:

```text
documento
→ chunks
→ embeddings
→ pgvector
→ pregunta
→ embedding de pregunta
→ retrieval
→ top-k + threshold
→ contexto
→ LLM grounded
→ respuesta con citas / abstención
```

## Evidencia reproducible

Comando de cierre:

```bash
cd labs/lab-01/app
npm run check:lab
```

Resultado verificado el 2026-10-04:

### Integración técnica

- PASS preview == ingest: 11 chunks
- PASS overlap exacto entre límites
- PASS metadata pgvector: 11 filas
- PASS retrieval acotado al documento activo
- PASS modelos: `nomic-embed-text + qwen3:8b`
- PASS fases reales de ingesta
- PASS fases reales de análisis
- PASS cleanup de documento de auditoría

### Validación RAG 5+3+1

Casos con respuesta presente:

- PASS alta — demora
- PASS alta — aprobación
- PASS vacaciones — anticipación
- PASS contraseña — recuperación
- PASS mesa de ayuda — horario

Casos sin respuesta en la fuente:

- PASS trabajo remoto — abstención
- PASS reintegro de gastos — abstención
- PASS estacionamiento — abstención

Caso semánticamente relacionado pero insuficiente:

- PASS SLA de soporte — se recuperó evidencia relacionada con soporte, pero el sistema se abstuvo porque la documentación no indica cuánto demora la resolución.

Validaciones transversales:

- PASS ninguna cita inválida
- PASS cleanup de datos de validación

## Criterios de Definition of Done del repositorio

- [x] Ejecutable siguiendo README.
- [x] Validación automatizada y criterio medible.
- [x] Sin secretos versionados.
- [x] Decisiones y trade-offs documentados.
- [x] Demo/experiencia reproducible.
- [x] Learning log con comprensión practicada directamente.
- [x] Limitaciones y siguiente etapa documentadas.

## Decisión de cierre

No se agregan más features a LAB-01 para mejorar el producto. El objetivo de este laboratorio era entender y practicar RAG, no llevar la aplicación a producción.

Las mejoras que requieren evaluación formal de retrieval pasan a:

**LAB-02 — Retrieval Evaluation**

Temas reservados para LAB-02:

- golden dataset ampliado;
- recall@k;
- precision@k;
- MRR;
- failure analysis;
- comparación sistemática de configuraciones.

**LAB-01 cerrado.**
