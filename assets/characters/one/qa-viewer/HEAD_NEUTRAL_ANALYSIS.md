# Head neutral — estado de análisis

## Evidencia inspeccionada

- `source/raster/components/head/head-neutral.png`: 186×184 RGBA. Es el objetivo visual de la prueba.
- `references/one-character-parts-clean.png`: 1206×1304 RGBA. Es la fuente canónica de píxeles/partes.
- 22 candidatos actuales: 6 hood, 5 antenna, 5 eyes y 6 mouths.

## Estado

Los candidatos actuales son material de trabajo, no una descomposición demostrada de `head-neutral`. Las dimensiones, alpha y estadísticas de color confirman archivos técnicamente utilizables, pero no prueban por sí solas qué variante pertenece al master neutral ni permiten inferir geometría oculta.

No se reconstruirá el head-neutral por aproximación. Primero debe resolverse visualmente la correspondencia de piezas contra el master y, cuando una capa esté parcialmente oculta, recuperar geometría existente del master/parts-clean antes de completar información.

## Próxima compuerta

1. Identificar visualmente la variante correcta de hood, antenna, eyes y mouth.
2. Separar rostro/placa y cejas, que aún no están representados como candidatos modulares independientes.
3. Construir una reconstrucción de prueba sin alterar los masters.
4. Comparar reconstrucción y master lado a lado/diferencia.
5. Sólo entonces habilitar aprobación visual del resultado.
