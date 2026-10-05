# LAB-02 — Learning Log: Retrieval Evaluation

Este documento registra comprensión demostrada con palabras propias y experimentos del laboratorio.

## Estado actual

**Etapa:** Golden dataset
**Laboratorio:** iniciado el 2026-10-04
**Objetivo inmediato:** entender qué es una referencia de relevancia antes de calcular métricas.

## Conceptos a dominar

- [ ] golden dataset
- [ ] relevance judgment
- [ ] recall@k
- [ ] precision@k
- [ ] reciprocal rank
- [ ] MRR
- [ ] failure analysis
- [ ] comparación objetiva de configuraciones

## Punto de partida

LAB-01 ya permite observar un ranking real de chunks para una pregunta.

LAB-02 agrega una segunda pieza:

> saber de antemano qué chunks deberían considerarse relevantes para poder comparar el resultado observado contra una referencia.

## Primer concepto — Golden dataset

Un golden dataset no es simplemente una lista de preguntas con respuestas.

Para evaluar retrieval necesitamos, para cada consulta, un **juicio de relevancia** que indique qué documentos o chunks cuentan como evidencia correcta.

Ejemplo:

```text
query:
¿Cuánto demora el alta de un usuario?

relevantes esperados:
chunk_001
```

Si retrieval devuelve:

```text
1. chunk_004
2. chunk_001
3. chunk_006
```

podemos medir objetivamente que encontró la evidencia correcta, pero no la puso primera.

Sin golden dataset sólo podemos mirar el ranking y opinar.

Con golden dataset podemos calcular métricas.

## Pregunta de comprensión

Antes de implementar la siguiente etapa, debería poder explicar:

> ¿Por qué no puedo calcular recall@k correctamente si no sé previamente cuáles son todos los chunks relevantes para cada query?
