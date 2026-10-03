# Plan de desarrollo de la experiencia educativa

## Objetivo

Evolucionar LAB-01 desde una interfaz técnica con paneles y controles hacia una experiencia educativa interactiva donde cada concepto del pipeline RAG pueda **verse, manipularse y verificarse**.

El objetivo inmediato es el aprendizaje del autor del laboratorio. No se priorizan todavía distribución pública, onboarding genérico ni features de producto.

La regla central de implementación es:

> La representación visual debe explicar un proceso real. Cuando una visualización sea didáctica o simplificada, debe estar identificada explícitamente como tal.

## Arquitectura de experiencia

La experiencia se construirá en dos capas complementarias:

1. **Escena educativa**: una idea por vez, interacción directa, movimiento y causalidad visible.
2. **Inspector técnico**: números, vectores, metadata, tablas, scores, prompts y operaciones reales para comprobar qué ocurrió.

La escena educativa no reemplaza al inspector. La primera ayuda a construir el modelo mental y el segundo permite validarlo.

## Stack especializado

- **Vite**: build reproducible, módulos ES, assets versionados y modo de desarrollo.
- **XState**: estados y transiciones explícitas para que navegación, escena activa y controles no se desincronicen.
- **Motion**: transiciones con significado: mover, agrupar, transformar y revelar objetos del pipeline.
- **D3**: visualizaciones cuantitativas alimentadas por datos reales, especialmente similitud, geometría vectorial y ranking.
- **Lucide**: iconografía SVG consistente y portable.

No se agregará una librería nueva salvo que resuelva una necesidad concreta que este stack no cubra razonablemente.

## Fases

### Fase 0 — Base técnica [COMPLETADA]

- Migrar frontend a Vite.
- Fijar versiones exactas de dependencias.
- Integrar Motion, D3, XState y Lucide.
- Mantener Express, Ollama, PostgreSQL y pgvector sin cambios funcionales.
- Validar build, PWA, integración y acceso por Tailscale.

### Fase 1 — Documento → Tokens → Chunks [IMPLEMENTADA V1]

Objetivo: establecer el patrón de interacción que luego reutilizarán las demás etapas.

- Máquina de estados XState con `document → tokens → chunks`.
- Documento y métricas reales.
- Secuencia global de tokens reconstruida desde `/api/chunk-preview`.
- Chunks reales y límites globales de token.
- Overlap saliente y entrante distinguido visualmente.
- Recalcular escena al cambiar `chunk_size`, `overlap` o documento.
- Motion para comunicar transición entre representaciones.
- Lucide para la semántica visual.

Criterio de aceptación: la escena y el preview técnico deben derivar del mismo resultado del backend.

### Fase 2 — Transformer / embedding

- Separar claramente el transformer didáctico del embedding real de Ollama.
- Recorrido progresivo: token → vector inicial → posición → Q/K/V → atención → vector contextual → pooling.
- Ocultar fórmulas por defecto y exponerlas bajo “Ver cálculo”.
- Animar relaciones de atención sólo para el token seleccionado.
- Mantener el vector real de `nomic-embed-text` como salida verificable separada.

### Fase 3 — Ingesta y pgvector

- Representar cada chunk viajando a almacenamiento.
- Vincular cada movimiento a un evento real de `dbEvents`.
- Permitir abrir desde la escena la fila real correspondiente en PostgreSQL.
- Visualizar texto, metadata y embedding como componentes distintos de la fila.

### Fase 4 — Pregunta y retrieval

- Convertir visualmente la pregunta en embedding.
- D3 para comparar pregunta/chunks usando similitud real.
- Mostrar el efecto independiente de `top_k` y `threshold`.
- Animar aceptación/rechazo sin ocultar los scores.
- Vincular cada elemento visual al chunk real.

### Fase 5 — Contexto → LLM → Respuesta

- Mostrar qué chunks forman el contexto final.
- Diferenciar contexto recuperado de instrucciones del prompt.
- Representar generación token a token de forma educativa sin afirmar que se exponen estados internos del modelo.
- Visualizar grounding, citas válidas y abstención.

### Fase 6 — Unificación del recorrido

- Reemplazar los recorridos paralelos antiguos por una única máquina de estados del laboratorio completo.
- Desktop: tablero con contexto alrededor de la etapa activa.
- Mobile: una escena principal por vez.
- El mismo estado lógico debe gobernar ambos layouts.

### Fase 7 — Pulido y validación pedagógica

- Revisar cada escena preguntando: “¿qué concepto debería poder explicar el alumno después de verla?”.
- Quitar animaciones decorativas sin función pedagógica.
- Añadir checkpoints de explicación en palabras propias.
- Validar accesibilidad, reducción de movimiento y legibilidad móvil.

## Reglas de implementación

1. Datos reales antes que animaciones ficticias.
2. Una escena puede simplificar una operación, pero debe decirlo.
3. Cambiar un parámetro debe producir un efecto visual derivado del nuevo cálculo.
4. El inspector técnico debe permitir comprobar la escena.
5. No duplicar lógica de negocio en el frontend si ya existe en el backend.
6. Las transiciones de aprendizaje se modelan con XState, no con cadenas de booleanos dispersos.
7. Motion comunica causalidad; no se usa sólo para decorar.
8. D3 se reserva para datos y geometría, no para layout general.
9. Los iconos son Lucide SVG, evitando emojis dependientes del sistema.
10. Toda fase debe cerrar con build, audit y tests de integración.

## Definición de terminado por fase

Una fase se considera terminada cuando:

- funciona con datos reales o está explícitamente marcada como didáctica;
- responde correctamente a los controles asociados;
- funciona en móvil y desktop;
- respeta `prefers-reduced-motion`;
- no introduce errores de consola relevantes;
- `npm run build` finaliza correctamente;
- `npm audit` no reporta vulnerabilidades conocidas;
- `npm run check:integration` sigue pasando;
- la documentación refleja lo implementado.
