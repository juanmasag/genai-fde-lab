# LAB-02 — Learning Log: Retrieval Evaluation

Este documento registra comprensión demostrada por explicación propia y experimentos del laboratorio, no sólo definiciones dadas por el asistente o código generado.

## Estado actual

**Etapa:** Reciprocal Rank
**Laboratorio:** iniciado el 2026-10-04
**Checkpoint alcanzado:** golden dataset + relevance judgment + Recall@k + Precision@k comprendidos
**Objetivo inmediato:** comprender y calcular Reciprocal Rank manualmente antes de pasar a MRR.

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
- [x] recall@k
- [x] precision@k
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

### 4. Recall@k: cuánto de lo relevante logró recuperarse

Explicado y calculado correctamente con palabras propias:

- Recall@k compara los elementos relevantes definidos por el golden dataset contra los resultados recuperados dentro de los primeros `k` lugares.
- La pregunta que responde es: **de toda la evidencia relevante que existía, cuánto logró encontrar retrieval dentro del top-k**.
- Se calcula como `relevantes recuperados en top-k / total de relevantes esperados`.
- En el ejemplo validado, el golden contenía `chunk_A`, `chunk_B`, `chunk_C` y `chunk_D`; retrieval top-5 devolvió `chunk_X`, `chunk_B`, `chunk_Y`, `chunk_D`, `chunk_Z`.
- Se identificó correctamente que sólo `chunk_B` y `chunk_D` eran relevantes: `2 / 4 = 0,5 = 50%`.
- Se corrigió una confusión inicial en la que se tomó un chunk irrelevante como si fuera el valor de recall. Después de la corrección, el cálculo fue resuelto correctamente de forma independiente.
- Se entendió que Recall se concentra en **cuánta evidencia relevante faltó o se logró recuperar**, no en cuántos resultados irrelevantes aparecieron. Ese segundo problema se estudia con Precision.

Estado: **Comprendido con corrección conceptual y cálculo manual validado**

### 5. Precision@k: cuánto de lo recuperado era realmente relevante

Explicado y calculado correctamente con palabras propias:

- Precision@k mira los resultados desde el lado de lo recuperado: de todos los chunks traídos dentro del top-k, qué proporción era realmente relevante según el golden dataset.
- Se calcula como `relevantes recuperados en top-k / cantidad de resultados considerados en top-k`.
- En el ejemplo validado, el golden contenía `A`, `B`, `C`, `D`, `E` y retrieval top-4 devolvió `A`, `X`, `C`, `Y`.
- Se identificó correctamente que `A` y `C` eran relevantes: `2 / 4 = 0,5 = 50%`.
- La interpretación dada fue correcta: **50% de precisión sobre todos los valores que trajo retrieval**.
- Se distinguió correctamente de Recall: Recall pregunta cuánto de todo lo relevante fue encontrado; Precision pregunta cuánto de todo lo recuperado era relevante.

Estado: **Comprendido y cálculo manual validado**

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

## Checkpoint: Recall@k completado

Ya se puede explicar y calcular manualmente:

- qué mide Recall@k;
- cuál es su denominador;
- cómo usar el golden dataset como referencia;
- cómo identificar los relevantes recuperados dentro del top-k;
- cómo interpretar `0`, `0,5` o `1` como proporción de evidencia relevante recuperada.

**Estado:** Recall@k comprendido. Se habilita el siguiente concepto.

## Checkpoint: Precision@k completado

Ya se puede explicar y calcular manualmente:

- qué mide Precision@k;
- cuál es su denominador;
- cómo usar el golden dataset para distinguir relevante de ruido;
- cómo interpretar una precision de `0,5` como que la mitad de los resultados recuperados era relevante;
- cómo diferenciar Precision de Recall usando el mismo conjunto de resultados.

**Estado:** Precision@k comprendido. Se habilita el siguiente concepto.

## Próximo concepto — Reciprocal Rank

La próxima pregunta a poder responder con palabras propias será:

> ¿En qué posición aparece el primer resultado relevante y cómo convertir esa posición en una métrica?

No se marcará Reciprocal Rank como comprendido hasta poder resolver y explicar ejemplos manualmente.
