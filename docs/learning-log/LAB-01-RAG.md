# LAB-01 — Learning Log: RAG

Este documento registra comprensión demostrada por explicación propia, no sólo código generado.

## Estado actual

**Etapa:** Fundamentos conceptuales de RAG  
**Mini-proyecto:** Todavía no iniciado  
**Objetivo para avanzar:** comprender el flujo completo de retrieval antes de implementar.

## Conceptos comprendidos

### 1. Token != palabra
Comprendido:

- Un token no necesariamente representa una palabra completa.
- Puede representar una palabra, parte de una palabra, signos u otras unidades.
- Se corrigió la idea inicial de que el token por sí mismo ya contiene todo el contexto semántico.

Estado: **Comprendido con corrección conceptual**

### 2. Embeddings como representación vectorial
Explicado correctamente con palabras propias:

- Una oración o fragmento de texto puede representarse como un vector mediante embeddings.
- Ese vector permite comparar significado semántico entre textos.

Estado: **Comprendido**

### 3. Similitud entre vectores
Explicado correctamente con palabras propias:

- Dos embeddings pueden compararse por cercanía o por el ángulo entre sus vectores.
- Un ángulo menor implica mayor similitud semántica.
- Se corrigió que esto representa similitud, no necesariamente exactitud factual.

Estado: **Comprendido**

### 4. División de documentos
Explicado correctamente con palabras propias:

- Un documento se divide en partes antes de generar embeddings.
- Cada fragmento puede tener su propio vector.
- Esto evita tratar todo el documento como una sola unidad semántica.

Estado: **Comprendido a nivel general**

### 5. Rol de los embeddings dentro de RAG
Explicado correctamente con palabras propias:

- Los vectores se utilizan para localizar los fragmentos más relacionados con una pregunta.
- Se corrigió que los vectores no producen la respuesta.
- Los vectores sirven para recuperar el texto relevante, y luego el LLM genera la respuesta usando ese texto como contexto.

Estado: **Comprendido**

### 6. Chunking y overlap
Explicado correctamente con palabras propias:

- Chunking es agrupar texto en fragmentos con sentido, como párrafos o secciones.
- A cada chunk se le genera un embedding.
- Overlap consiste en repetir parte del chunk anterior en el siguiente para conservar continuidad y contexto.
- Se corrigió que un overlap mayor no garantiza más precisión: demasiado overlap puede introducir duplicación y ruido.
- El overlap aumenta el volumen procesado y almacenado; sólo aumenta los tokens enviados al LLM si esos chunks repetidos terminan siendo recuperados y enviados como contexto.

Estado: **Comprendido**

### 7. Retrieval: top-k, threshold y nivel de exigencia
Explicado correctamente con palabras propias:

- Al buscar información en documentos, se pueden definir criterios sobre qué tan estricta será la selección de chunks recuperados.
- top_k limita cuántos candidatos se recuperan.
- threshold define qué nivel mínimo de similitud se acepta.
- Se entendió que estos parámetros no hacen al embedding más preciso; controlan la selección de resultados.
- Se entendió que una búsqueda más estricta puede descartar resultados útiles y una más permisiva puede introducir ruido.

Estado: **Comprendido**

### 8. Cierre de retrieval: top-k + threshold
Explicado correctamente con palabras propias:

- Se puede pedir un máximo de candidatos, por ejemplo top_k = 6.
- Después, un threshold alto puede hacer que sólo algunos de esos candidatos sean aceptados.
- Por ejemplo, de 6 candidatos podrían quedar sólo 2 por superar el umbral definido.
- Se entendió que el resultado con mayor similitud no necesariamente contiene la respuesta correcta; sólo es el más cercano semánticamente según la métrica usada.

Estado: **Comprendido**

### 9. Grounding y abstención
Explicado correctamente con palabras propias:

- Grounding puede implementarse como una instrucción que obliga al modelo a tratar una fuente concreta como única fuente de verdad.
- Si la información no aparece en la evidencia recuperada, el modelo debe indicarlo en vez de inventar una respuesta.
- Se relacionó correctamente con una práctica ya utilizada: pedir a un modelo que valide una solución exclusivamente contra documentación oficial y que avise cuando no encuentre respaldo.
- Se aclaró que, en sistemas más robustos, estas reglas pueden reforzarse con validaciones, citas obligatorias o lógica adicional; no dependen necesariamente sólo del prompt.

Estado: **Comprendido**

### 10. Tokens, vectores y generación del LLM
Explicado correctamente con palabras propias:

- El LLM no opera sobre palabras como unidades humanas de significado, sino sobre tokens.
- Los tokens se convierten en representaciones vectoriales internas que el transformer procesa en contexto.
- La salida se genera token a token a partir de distribuciones de probabilidad.
- Se corrigió que la generación no debe resumirse únicamente como comparación vectorial: intervienen múltiples capas y transformaciones internas antes de producir las probabilidades del próximo token.

Estado: **Comprendido**

### 11. Metadata y trazabilidad de chunks
Explicado correctamente con palabras propias:

- Se relacionó la metadata de un chunk con la metadata de una fotografía: el contenido principal es visible, pero existen datos adicionales que lo describen.
- En RAG, esa metadata puede incluir documento de origen, sección, identificador, versión u otros atributos.
- La metadata permite identificar, filtrar y rastrear el origen del chunk y construir citas verificables.
- Se entendió que la cita no debe depender de que el LLM recuerde la fuente: el sistema ya conoce el origen del chunk recuperado.

Estado: **Comprendido**

## Flujo que ya debe poder explicarse

Documento
→ chunks
→ embeddings
→ almacenamiento de texto + vector
→ pregunta
→ embedding de la pregunta
→ búsqueda de vectores similares
→ recuperación de chunks
→ contexto para el LLM
→ respuesta fundamentada

## Checkpoint: fundamentos completados

Los fundamentos conceptuales necesarios para comenzar el mini-proyecto fueron explicados con palabras propias:

- tokens y embeddings;
- similitud vectorial;
- chunking y overlap;
- retrieval;
- top-k y threshold;
- grounding y abstención;
- metadata y citas.

**Estado:** teoría base completada. Se habilita el inicio del mini-proyecto LAB-01.

El desarrollo se realizará por etapas didácticas, comenzando con un vector playground antes de construir el RAG completo.
