# LAB-01 — DocuAyuda: RAG desde cero

## Objetivo

Construir un RAG pequeño, entendible y funcional para consultar documentación propia o pública sin depender de un framework que oculte el flujo.

El objetivo principal es aprender y poder explicar cada etapa:

documento -> chunking -> embeddings -> almacenamiento vectorial -> retrieval -> grounding -> respuesta con citas.

## Necesidad real

Muchas personas y equipos tienen procedimientos, manuales, FAQs y documentación dispersa. Buscar una respuesta implica abrir varios archivos, conocer dónde está la información o preguntarle siempre a la misma persona.

**DocuAyuda** permitirá colocar documentos Markdown/TXT en una carpeta y hacer preguntas sobre ellos, mostrando la fuente utilizada y absteniéndose cuando no exista evidencia suficiente.

## Alcance del MVP

Incluye:

- lectura de .md y .txt;
- chunking configurable;
- overlap configurable;
- embeddings;
- PostgreSQL + pgvector;
- metadata por chunk;
- retrieval con top_k y threshold;
- modo de inspección del retrieval;
- respuesta grounded;
- abstención si falta evidencia;
- citas con documento/sección/chunk.

No incluye:

- frontend web;
- autenticación;
- agentes;
- LangChain/LangGraph;
- PDF/OCR;
- cloud;
- reranking;
- hybrid search.

## Arquitectura

```text
documents/
   |
   v
Loader
   |
   v
Chunker
   |
   v
Embedding model
   |
   v
PostgreSQL + pgvector
   ^
   |
Question -> embedding -> similarity search
                         |
                         v
                    top-k + threshold
                         |
                         v
                 retrieved chunks
                         |
                         v
                    grounded LLM
                         |
                         v
              answer + citations
```

## Implementación por etapas

### Etapa A — Vector playground

Antes de tocar la base de datos:

- generar embeddings para pocas frases;
- comparar similitud;
- observar qué textos quedan más cerca;
- comprobar que similitud no equivale a respuesta correcta.

**Salida:** script pequeño ejecutable y explicación propia.

### Etapa B — Ingesta

- leer documentos;
- dividirlos en chunks;
- aplicar overlap;
- generar metadata;
- generar embeddings;
- guardar texto + metadata + vector en pgvector.

**Salida:** comando de ingesta reproducible.

### Etapa C — Retrieval visible

Crear un comando similar a:

```bash
python inspect_retrieval.py "¿cómo solicito acceso?"
```

Debe mostrar:

- posición;
- score;
- documento;
- sección;
- chunk_id;
- texto recuperado.

**Salida:** poder distinguir un problema de retrieval de un problema del LLM.

### Etapa D — RAG completo

Crear un comando similar a:

```bash
python ask.py "¿cuánto demora el alta?"
```

Debe:

1. generar embedding de la pregunta;
2. recuperar hasta top_k chunks;
3. aplicar threshold;
4. enviar sólo la evidencia aceptada al LLM;
5. responder únicamente con esa evidencia;
6. abstenerse si no alcanza;
7. mostrar citas reales.

### Etapa E — Validación

Dataset mínimo:

- 5 preguntas con respuesta presente;
- 3 preguntas sin respuesta;
- al menos 1 pregunta semánticamente relacionada pero sin evidencia suficiente.

Comprobar manualmente y con tests:

- retrieval correcto;
- citas existentes;
- no inventar fuentes;
- abstención cuando corresponde.

## Stack inicial

- Python
- Gemini embeddings / Gemini LLM
- PostgreSQL
- pgvector
- psycopg
- pytest
- Docker sólo para levantar PostgreSQL de forma reproducible

## Criterios de aceptación

- [ ] Puedo explicar por qué cada chunk fue recuperado.
- [ ] Puedo modificar chunk_size, overlap, top_k y threshold entendiendo el efecto esperado.
- [ ] El sistema muestra metadata y fuentes.
- [ ] El sistema no cita chunks que no fueron recuperados.
- [ ] El sistema se abstiene cuando no existe evidencia.
- [ ] Tests básicos pasan.
- [ ] El proyecto se ejecuta siguiendo sólo el README.
- [ ] No hay secretos versionados.

## Regla didáctica

Los agentes pueden ayudar a implementar, depurar y explicar, pero una etapa no se considera aprendida hasta poder explicar con palabras propias:

- qué hace;
- por qué existe;
- qué parámetro afecta su comportamiento;
- cómo detectar que está fallando.

## Resultado esperado

Un RAG simple que pueda reutilizar cualquier persona colocando su propia documentación en documents/, y una comprensión práctica de cada componente antes de pasar a LAB-02.
