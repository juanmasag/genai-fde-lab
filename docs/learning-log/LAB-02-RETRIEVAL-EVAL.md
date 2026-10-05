# LAB-02 — Learning Log: Retrieval Evaluation

Este documento registra comprensión demostrada por explicación propia y experimentos del laboratorio, no sólo definiciones dadas por el asistente o código generado.

## Estado actual

**Etapa:** Recall@k
**Laboratorio:** iniciado el 2026-10-04
**Checkpoint alcanzado:** golden dataset + relevance judgment comprendidos
**Objetivo inmediato:** comprender y calcular Recall@k manualmente antes de implementarlo.

## Regla de registro de aprendizaje

Se mantiene el mismo criterio utilizado en LAB-01:

1. Un concepto no se marca como comprendido sólo porque fue explicado.
2. Debe poder reformularse con palabras propias.
3. Si aparece una interpretación incorrecta, se registra la corrección conceptual.
4. Primero se valida el modelo mental y después se implementa o automatiza.
5. El código y las métricas sirven como evidencia práctica, pero no sustituyen la comprensión.
6. Cada nuevo concepto debe conectarse con los ya comprendidos antes de avanzar.

## Conceptos a dominar

- [x] golden dataset
- [x] relevance judgment
- [x] diferencia entre evaluación de retrieval y evaluación de generación
- [ ] recall@k
- [ ] precision@k
- [ ] reciprocal rank
- [ ] MRR
- [ ] failure analysis
- [ ] comparación objetiva de configuraciones

## Conceptos comprendidos

### 1. Golden dataset como referencia validada

Explicado correctamente con palabras propias:

- Un golden dataset es un conjunto de casos previamente revisados y aprobados que se utiliza como referencia de qué debería considerarse correcto.
- La referencia no aparece mágicamente: una persona, experto del dominio, analista o equipo de QA revisa la fuente y define qué evidencia es relevante para cada consulta.
- En LAB-02, para cada pregunta el golden dataset indica qué evidencia o chunks deberían considerarse relevantes.
- El golden dataset no actúa como un segundo filtro dentro del RAG. Está fuera del flujo normal y se utiliza para comparar el resultado obtenido por retrieval contra una referencia conocida.
- Se corrigió la idea de que necesariamente proviene del entrenamiento del modelo. Puede construirse específicamente para evaluación y conviene mantenerlo independiente del sistema que se está evaluando.
- Puede pensarse como un “solucionario” o benchmark aprobado: el retrieval ejecuta la consulta y después se compara su resultado con esa referencia.
- Una pregunta puede tener uno, varios o ningún chunk relevante.

Estado: **Comprendido con correcciones conceptuales**

### 2. Relevance judgment: qué cuenta como evidencia correcta

Explicado correctamente con palabras propias:

- Para evaluar retrieval necesitamos saber de antemano cuáles resultados cuentan como relevantes para cada consulta.
- Esos juicios de relevancia se determinan revisando la documentación fuente, no dejando que el mismo retrieval se autocorrija.
- Los chunks candidatos devueltos por retrieval se comparan contra los elementos relevantes definidos en el golden dataset.
- Si retrieval devuelve tres chunks candidatos y ninguno coincide con la evidencia marcada como relevante, ninguno de esos tres candidatos es correcto para esa consulta.
- Si sólo algunos coinciden, retrieval encontró parte de la evidencia correcta y parte de lo recuperado es ruido.
- Saber cuáles son **todos** los elementos relevantes es necesario para poder medir posteriormente cuánto de la evidencia disponible fue recuperada.

Estado: **Comprendido**

### 3. Evaluación de retrieval != evaluación de la respuesta del LLM

Comprendido con corrección conceptual:

- En LAB-02 no se está evaluando todavía si la respuesta redactada por el LLM es correcta o está bien escrita.
- El objeto de evaluación es el paso anterior: qué evidencia recuperó retrieval.
- Una respuesta final podría ser correcta aunque el chunk relevante haya aparecido muy abajo en el ranking; LAB-02 debe poder detectar y medir ese problema.
- Un golden dataset para evaluar generación podría contener respuestas esperadas, pero ése sería otro problema de evaluación.
- En este laboratorio la referencia principal es la **evidencia que debería recuperarse**.

Estado: **Comprendido con corrección conceptual**

## Modelo mental alcanzado

El flujo de evaluación ya puede representarse así:

```text
Documentación fuente
        │
        ├── revisión humana / experto
        │
        ▼
Golden dataset
pregunta → evidencia relevante esperada
        │
        │                         Retrieval real
        │                         pregunta
        │                            ↓
        │                         embedding
        │                            ↓
        │                         ranking
        │                            ↓
        │                      chunks candidatos
        │                            │
        └──────── comparación ◄─────┘
                     │
                     ▼
          aciertos / faltantes / ruido
                     │
                     ▼
              métricas de retrieval
```

El golden dataset **no modifica** los resultados de retrieval. Permite determinar posteriormente si fueron buenos o malos.

## Checkpoint: Golden dataset completado

Ya se puede explicar con palabras propias:

- qué es un golden dataset;
- quién define la referencia correcta;
- por qué no es un filtro del RAG;
- por qué no tiene que provenir del entrenamiento;
- qué es un relevance judgment;
- qué significa que un candidato de retrieval coincida o no con el golden;
- por qué LAB-02 evalúa evidencia recuperada y no todavía la respuesta final del LLM.

**Estado:** fundamentos para comenzar Recall@k completados.

## Próximo concepto — Recall@k

La próxima pregunta a poder responder con palabras propias será:

> De toda la evidencia relevante definida por el golden dataset, ¿qué proporción logró recuperar el sistema dentro de los primeros k resultados?

No se marcará Recall@k como comprendido hasta poder resolver y explicar ejemplos manualmente antes de automatizar su cálculo.
