# LAB-02 — Retrieval Evaluation

**Estado:** 🟡 IN PROGRESS
**Inicio:** 2026-10-04

## Objetivo

Aprender a medir de forma objetiva la calidad del **retrieval** de un sistema RAG.

LAB-01 respondió:

> ¿Cómo funciona un RAG de punta a punta?

LAB-02 responde:

> ¿Cómo sé si el retrieval está recuperando la evidencia correcta y cómo comparo configuraciones sin depender de impresiones subjetivas?

El foco de este laboratorio termina **antes de la generación del LLM**. Queremos evaluar la calidad de los chunks recuperados, independientemente de si el modelo redacta una buena respuesta.

## Sistema bajo evaluación

LAB-02 reutiliza el RAG de LAB-01 como sistema bajo prueba:

```text
pregunta
→ embedding
→ búsqueda vectorial
→ ranking
→ top-k
→ threshold
→ chunks recuperados
```

No se crea otro RAG. Se construye una capa de evaluación alrededor del retrieval existente.

## Pregunta central

Para una consulta conocida:

```text
¿los chunks que deberían aparecer realmente aparecen?
¿en qué posición aparecen?
¿cuánto ruido llega junto con ellos?
¿qué consultas fallan y por qué?
```

## Conceptos a aprender

1. **Golden dataset**
2. **Relevance judgment**
3. **Recall@k**
4. **Precision@k**
5. **MRR — Mean Reciprocal Rank**
6. **Failure analysis**
7. Comparación de configuraciones de retrieval
8. Diferencia entre evaluación de retrieval y evaluación de generación

## Arquitectura del laboratorio

```text
Golden dataset
(query + chunks relevantes esperados)
            │
            ▼
      Evaluation runner
            │
            ├── ejecuta query
            ▼
      Retrieval LAB-01
            │
            ▼
      ranking de chunks
            │
            ▼
   comparar esperado vs real
            │
      ┌─────┼─────────┐
      ▼     ▼         ▼
 recall@k precision@k MRR
      │     │         │
      └─────┴────┬────┘
                 ▼
          failure analysis
                 │
                 ▼
       reporte automático
```

## Regla principal

Las métricas no evalúan si la respuesta final “suena bien”.

Evalúan si **retrieval encontró la evidencia que debía encontrar**.

Ejemplo:

```text
Pregunta:
¿Cuánto demora el alta de un usuario?

Golden:
chunk_001 es relevante

Resultado retrieval:
1. chunk_004
2. chunk_001
3. chunk_006
```

El LLM podría todavía contestar correctamente porque `chunk_001` llegó al contexto.

Sin embargo, desde retrieval sabemos que la evidencia correcta apareció en posición 2, no en posición 1. Esa diferencia debe poder medirse.

## Fases

### Fase A — Golden dataset

Objetivo: construir una referencia contra la cual evaluar retrieval.

Cada caso debe incluir como mínimo:

```json
{
  "id": "alta-demora",
  "query": "¿Cuánto puede demorar el alta de un usuario?",
  "relevant_chunks": ["chunk_001"]
}
```

Algunos queries pueden tener más de un chunk relevante.

Se reutilizarán como semilla los casos 5+3+1 de LAB-01, pero el juicio de relevancia debe definirse explícitamente para LAB-02.

**Criterio de aceptación:** podemos justificar manualmente por qué cada chunk marcado como relevante contiene evidencia para la consulta.

### Fase B — Recall@k

Pregunta que responde:

> De toda la evidencia relevante que existía, ¿cuánta recuperé dentro de los primeros k resultados?

```text
recall@k =
relevantes recuperados en top-k
─────────────────────────────
total de relevantes esperados
```

### Fase C — Precision@k

Pregunta que responde:

> De los k resultados recuperados, ¿cuántos eran realmente relevantes?

```text
precision@k =
resultados relevantes en top-k
──────────────────────────────
k
```

### Fase D — MRR

Pregunta que responde:

> ¿Qué tan pronto aparece el primer resultado relevante?

Para una query:

```text
RR = 1 / posición del primer resultado relevante
```

Ejemplos:

- relevante en posición 1 → RR = 1
- posición 2 → RR = 0.5
- posición 4 → RR = 0.25
- no aparece → RR = 0

`MRR` es el promedio de esos valores para todas las queries evaluadas.

### Fase E — Failure analysis

No alcanza con saber que una métrica bajó.

Cada fallo debe clasificarse.

Ejemplos:

- chunk relevante no recuperado;
- chunk relevante demasiado abajo;
- falsos positivos semánticamente parecidos;
- query ambigua;
- chunk demasiado grande;
- chunk demasiado pequeño;
- overlap inadecuado;
- threshold demasiado alto;
- threshold demasiado bajo;
- embedding poco discriminativo.

### Fase F — Comparación de configuraciones

Ejecutar el mismo golden dataset contra varias configuraciones.

Ejemplo:

| Config | chunk_size | overlap | top_k | threshold |
|---|---:|---:|---:|---:|
| A | 24 | 5 | 3 | 0.35 |
| B | 42 | 8 | 4 | 0.35 |
| C | 42 | 8 | 6 | 0.50 |

No se elige una configuración por intuición.

Se compara con métricas y casos fallidos.

## Entrega final

Un comando reproducible que genere un reporte automático con:

- métricas por query;
- Recall@k;
- Precision@k;
- Reciprocal Rank;
- promedios del dataset;
- consultas fallidas;
- chunks esperados vs recuperados;
- comparación entre configuraciones;
- resumen de failure analysis.

## Criterios de aceptación

- [ ] Existe un golden dataset revisado manualmente.
- [ ] Cada query tiene relevance judgments explícitos.
- [ ] Recall@k está implementado y explicado.
- [ ] Precision@k está implementado y explicado.
- [ ] MRR está implementado y explicado.
- [ ] Los cálculos tienen tests deterministas.
- [ ] Se ejecuta la evaluación sobre retrieval real de LAB-01.
- [ ] Se comparan al menos 3 configuraciones.
- [ ] Los casos fallidos se reportan individualmente.
- [ ] Puedo explicar por qué una configuración supera a otra.
- [ ] README reproducible.
- [ ] Learning log actualizado.
- [ ] Sin secretos.

## Qué NO cubre LAB-02

Todavía no evaluaremos:

- calidad lingüística de la respuesta;
- factualidad completa del LLM;
- LLM-as-a-judge;
- evals de prompts;
- regresión de generación;
- observabilidad de producción.

Esos problemas pertenecen a laboratorios posteriores.

## Resultado esperado

Al terminar LAB-02 deberíamos dejar de decir:

> “Me parece que retrieval funciona bien”.

Y poder decir algo como:

> “Sobre 20 queries del golden dataset, esta configuración logra Recall@4 = 0.95, Precision@4 = 0.61 y MRR = 0.89. Los dos fallos restantes corresponden a consultas ambiguas relacionadas con soporte.”

Ese cambio —de intuición a evidencia— es el objetivo de LAB-02.
