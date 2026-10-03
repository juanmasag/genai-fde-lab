# Arquitectura GUI/UX educativa

## Propósito

LAB-01 necesita explicar sistemas de IA que combinan transformaciones invisibles: tokenización, chunking, embeddings, almacenamiento vectorial, retrieval, contexto y generación.

Una interfaz de formularios y tablas puede demostrar que el sistema funciona, pero no siempre permite construir un modelo mental de **cómo una salida se convierte en la entrada de la siguiente etapa**. Por eso se incorporó un stack especializado para visualización, animación y control de estados.

La nueva arquitectura busca tres propiedades:

- **causalidad visible**: poder seguir cómo un objeto cambia o se desplaza a través del pipeline;
- **interactividad**: modificar parámetros y observar las consecuencias;
- **verificabilidad**: poder abrir los datos técnicos que respaldan la representación.

## Principio: escena + inspector

Cada módulo educativo debe tener dos niveles.

### Escena

Explica primero el concepto con objetos visuales y transiciones. Prioriza comprensión sobre densidad de información.

Ejemplo de chunking:

`documento → tokens → límites de chunk → tokens repetidos por overlap`

### Inspector

Permite comprobar el proceso con los valores que realmente produjo el sistema:

- índices de token;
- contenido del chunk;
- metadata;
- vectores;
- scores;
- filas de PostgreSQL;
- prompt y citas.

La escena nunca debe convertirse en una fuente de datos paralela al inspector.

## Responsabilidad de cada herramienta

### Vite

Responsable del pipeline de frontend. Permite importar módulos de forma explícita, hacer tree-shaking, generar assets con hash y mantener separadas las fuentes (`src/`) del artefacto de producción (`dist/`).

### XState

Responsable del estado narrativo. Una etapa educativa se modela como una máquina de estados con transiciones válidas. Esto evita estados imposibles como mostrar “Chunks” mientras el navegador de pasos afirma que sigue en “Documento”.

Primera máquina implementada:

```text
document
   ↓
tokens
   ↓
chunks
```

Permite navegación anterior/siguiente y acceso directo a etapas válidas.

### Motion

Responsable del movimiento semántico. Se utiliza cuando el movimiento ayuda a entender una transformación:

- aparición secuencial de tokens;
- entrada de chunks;
- transición entre representaciones;
- futura transferencia de overlap entre chunks;
- futuros movimientos hacia pgvector y retrieval.

Las animaciones respetan `prefers-reduced-motion`.

### D3

Responsable de visualizaciones cuantitativas. La implementación actual ya lo utiliza para la comparación angular de embeddings recuperados. Las siguientes fases ampliarán su uso a similitud, ranking y selección de retrieval.

D3 recibe datos producidos por el backend; no inventa scores.

### Lucide

Responsable de iconografía SVG. Evita depender de emojis o fuentes cuyo render cambia entre Android, Linux y navegadores.

## Flujo de datos de la primera escena

```text
Documento editable
      │
      ▼
POST /api/chunk-preview
      │
      ├── tokenCount
      ├── chunkSize efectivo
      ├── overlap efectivo
      └── chunks[]
            ├── tokenStart / tokenEnd
            ├── tokens[]
            ├── overlapFromPrevious
            └── overlapToNext
      │
      ▼
state.preview
      │
      ├── escena Documento
      ├── escena Tokens
      └── escena Chunks
```

La secuencia global de tokens se reconstruye usando los índices globales del preview. Los tokens duplicados por overlap conservan el mismo índice y se deduplican sólo para la escena “Tokens”. En “Chunks” vuelven a mostrarse en cada chunk donde realmente aparecen.

## Semántica visual de overlap

- token normal: pertenece sólo a ese límite visible;
- verde sólido: token al final de un chunk que se repetirá en el siguiente;
- verde punteado: la copia del mismo token al comienzo del chunk siguiente.

Esta convención debe mantenerse en todas las pantallas para evitar que un mismo concepto cambie de significado visual.

## Qué es real y qué es didáctico

### Real

- tokenizer de chunking del laboratorio;
- límites de chunks;
- overlap;
- embeddings de Ollama;
- PostgreSQL + pgvector;
- retrieval y scores;
- contexto enviado al LLM;
- respuesta, citas y validación.

### Didáctico / simplificado

- microscopio de transformer de 4 dimensiones;
- animaciones físicas de objetos;
- futura proyección visual de vectores cuando se reduzca dimensionalidad;
- cualquier representación del proceso interno del LLM que no esté expuesta por el modelo.

Las representaciones didácticas deben etiquetarse como tales y nunca presentarse como telemetría interna del modelo.

## Criterio de diseño

Una animación se justifica sólo si responde al menos una de estas preguntas:

- ¿qué objeto se transforma?
- ¿qué información se conserva?
- ¿qué información se repite o se descarta?
- ¿qué parámetro produjo el cambio?
- ¿qué etapa recibe el resultado?

Si no responde ninguna, probablemente es decorativa y debe eliminarse.

## Seguridad y reproducibilidad

Las dependencias del stack están fijadas a versiones exactas en `package.json` y `package-lock.json`. Se mantiene un conjunto reducido de librerías especializadas y se valida con:

```bash
npm audit
npm run build
npm run check:integration
```

La aplicación de producción es servida por Express desde `dist/`; Vite dev server no forma parte de la exposición por Tailscale.

## Fase 2: escena progresiva del transformer

El antiguo microscopio mostraba correctamente la matemática educativa, pero exponía demasiada información simultáneamente. La Fase 2 separa **comprensión visual** de **inspección matemática**.

La escena está gobernada por XState y tiene ocho estados explícitos:

```text
tokens → vector → posición → Q/K/V → scores → atención → contexto → pooling
```

Cada etapa responde una pregunta conceptual antes de mostrar fórmulas. El botón **Ver cálculo** abre los valores del modelo didáctico correspondientes al estado actual.

### Separación de verdad

La interfaz muestra permanentemente dos columnas conceptuales:

- **DIDÁCTICO**: transformer mínimo de 4 dimensiones, matrices fijas y operaciones calculadas en el navegador para poder seguir la matemática.
- **REAL**: embedding de 768 dimensiones generado por `nomic-embed-text` a través de Ollama y almacenado por la ingesta.

No se afirma que Q, K, V, atención o pooling visibles correspondan a los estados internos de `nomic-embed-text`. Esa separación es parte del diseño pedagógico y no sólo una nota técnica.

### Interacción

El alumno elige un token en la primera etapa. El mismo token se mantiene como foco al avanzar por vector, posición, Q/K/V, scores, atención y contexto. Esto permite seguir causalmente una representación en lugar de observar tablas desconectadas.

Motion anima el cambio de representación; el heatmap queda dentro del inspector para comprobar numéricamente los pesos educativos de atención.
