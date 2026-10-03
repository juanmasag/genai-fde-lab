# ONE — Character Specification

Estado: SVG maestro V1 creado a partir de la dirección visual Concepto B aprobada.

## Identidad

ONE debe transmitir cercanía, empatía, curiosidad, claridad y disposición genuina a ayudar. Su función en los laboratorios es acompañar, explicar, orientar y celebrar el progreso sin reemplazar la comprensión del alumno.

## Política de producción

- IA: únicamente ideación y exploración conceptual.
- Producción: Krita/GIMP, Inkscape, SVG/SVGO y, cuando corresponda, Synfig/OpenToonz/Pencil2D/Blender.
- Integración web: preferentemente SVG + Motion + XState.
- Ningún recurso visual se considera incorporado hasta estar versionado en este repositorio.

## Fuente visual

Dirección seleccionada: Concepto B — guía amable de formas redondeadas, ojos grandes, capas azul/menta, nodo guía ámbar y tablet.

La especificación de proporciones, paleta exacta, pivotes, piezas y expresiones se completará durante la reconstrucción vectorial del personaje.


## SVG maestro V1

Fuente canónica: `source/vector/one-master.svg`.

### Paleta base

- Navy `#153E75`
- Blue `#2F80ED`
- Sky `#5AB6F0`
- Mint `#65D6C0`
- Face `#F8FCFF`
- Eye `#1F5F9E`
- Amber `#F6B84A`
- Ink `#16324F`

### Componentes e IDs

`antenna`, `hood`, `head`, `faceplate`, `eyebrows`, `eyes`, `eye-left`, `eye-right`, `mouth`, `body`, `cape`, `torso`, `arms`, `arm-left`, `arm-right`, `hands`, `hand-left`, `hand-right`, `legs`, `prop-tablet`.

Estos IDs forman el contrato del futuro rig Motion/XState.

### Pivotes

- cabeza: centro inferior;
- antena: base del tallo;
- brazos: hombros;
- manos: unión con antebrazo;
- ojos: centro de cada ojo;
- boca: centro;
- tablet: centro del prop.

### Reglas de movimiento

1. Movimientos suaves, redondeados y breves.
2. Idle: suspensión mínima y parpadeo.
3. Explicar: mirada al contenido y gesto de señalar.
4. Ayudar: inclinación leve hacia contenido/alumno.
5. Celebrar: ojos felices y elevación breve de brazos/nodo.
6. Pensar: mirada lateral/arriba y pausa.
7. El nodo ámbar puede pulsar para llamar atención sin parpadeo molesto.

### Expresiones objetivo

Alegre, atento, tranquilizador, pensando, explicando, celebrando, esperando y alerta suave. Se construirán mediante swaps de ojos, cejas y boca más cambios de pose; no mediante nuevas imágenes completas.

### Derivados

- SVG web: `exports/svg/one-master.min.svg`
- preview: `exports/png/one-master-preview.png`
