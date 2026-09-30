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

## Conceptos pendientes antes del mini-proyecto

1. Chunking:
   - qué es un chunk;
   - por qué no usar documentos completos;
   - tamaño de chunk;
   - overlap.

2. Retrieval:
   - top-k;
   - diferencia entre similitud y relevancia suficiente;
   - qué pasa cuando no hay evidencia útil.

3. Grounding:
   - por qué el modelo debe responder sólo con evidencia recuperada;
   - abstención cuando no existe respuesta en los documentos.

4. Metadata y citas:
   - guardar origen, documento, sección y chunk_id;
   - usar esa información para mostrar fuentes.

## Regla para avanzar

LAB-01 pasa de teoría a mini-proyecto cuando estos conceptos puedan explicarse de forma simple y con palabras propias, sin depender de la implementación.
