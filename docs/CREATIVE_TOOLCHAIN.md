# Creative Toolchain

## Objetivo

Este stack creativo se incorpora para construir y procesar assets visuales de los laboratorios de forma local, reproducible y controlable desde la máquina de desarrollo.

La regla de trabajo es:

> **La IA se utiliza para ideación y exploración conceptual. Los assets de producción se construyen, editan, vectorizan, animan, optimizan y exportan con herramientas creativas instaladas localmente.**

No se considera un asset final a una imagen generada por IA sin pasar por el pipeline de diseño correspondiente.

## Herramientas instaladas

| Herramienta | Versión | Rol principal | Control desde terminal/MCP |
|---|---:|---|---|
| Krita | 5.3.3 | pintura digital, limpieza, capas, máscaras, preparación de sprites | lanzamiento + operaciones por CLI; edición compleja asistida por GUI |
| Inkscape | 1.4.4 | vectorización, SVG, componentes del personaje, export | alto; CLI para export y transformación SVG |
| Blender | 5.2 | composición, 2D/Grease Pencil, rigging avanzado, render | muy alto; modo background + Python |
| Synfig Studio | 1.5.3 | rigging y animación 2D vectorial | medio/alto; render y proyecto automatizables |
| OpenToonz | 1.8.0 | animación 2D por escenas/fotogramas | medio; proyecto y render, GUI para authoring |
| Pencil2D | 0.7.2 | bocetos y animación frame-by-frame liviana | medio |
| GIMP | 3.2.6 | edición raster, máscaras, retoque, composición | alto; batch/no-interface |
| Kdenlive | 26.08.1 | edición y composición final de video | medio; integrado con MLT/FFmpeg |
| FFmpeg | 6.1.1 | encoding, frames, GIF/WebM/MP4, audio/video | muy alto |
| SVGO | 4.0.0 | optimización de SVG para web | muy alto |
| Pillow | 10.2.0 | automatización raster con Python | muy alto |
| CairoSVG | 2.7.1 | render/conversión SVG por script | muy alto |

Todas las aplicaciones gráficas fueron instaladas como Flatpak a nivel usuario para no depender de privilegios administrativos.

## Wrappers disponibles

Los siguientes comandos están disponibles en ~/.local/bin:

~~~
one-krita
one-inkscape
one-blender
one-synfig
one-opentoonz
one-pencil2d
one-kdenlive
one-gimp
one-creative-status
~~~

one-creative-status imprime el inventario y las versiones instaladas.

## Pipeline previsto para el personaje ONE

~~~
Idea / exploración conceptual
        │
        ▼
Referencia visual aprobada
        │
        ▼
Krita / GIMP
limpieza, separación de capas, máscaras
        │
        ▼
Inkscape
formas maestras SVG y componentes reutilizables
        │
        ├──► SVGO
        │    optimización para web
        │
        ▼
Character Kit
cabeza / ojos / boca / cuerpo / brazos / props
        │
        ├──► Motion + XState
        │    animación interactiva dentro del laboratorio
        │
        ├──► Synfig / OpenToonz / Pencil2D
        │    animación 2D específica
        │
        └──► Blender
             rigging/composición avanzada cuando aporte valor
~~~

FFmpeg/Kdenlive se usan para exportar demos, clips y material audiovisual cuando sea necesario.

## Política IA → asset

### Permitido

La IA puede utilizarse para:

- generar ideas visuales;
- explorar siluetas, personalidad o lenguaje gráfico;
- crear moodboards y referencias;
- proponer poses, expresiones y variaciones conceptuales;
- analizar iteraciones y detectar inconsistencias.

### Asset de producción

Después de elegir una dirección, la versión que entra al laboratorio debe quedar construida y procesada con las herramientas locales:

- formas redibujadas o vectorizadas;
- paleta registrada;
- componentes separados;
- expresiones reproducibles;
- SVG/PNG optimizados;
- animación definida mediante assets y estados controlables.

La continuidad del personaje no debe depender de volver a pedirle a un generador de imágenes que reproduzca el mismo diseño.

## Organización de assets

Para cada personaje o identidad se recomienda:

~~~
assets/characters/<name>/
  source/
    raster/
    vector/
    animation/
  components/
    head/
    eyes/
    mouth/
    body/
    arms/
    props/
  expressions/
  poses/
  exports/
    svg/
    png/
    webp/
  CHARACTER_SPEC.md
~~~

El archivo CHARACTER_SPEC.md será la fuente de verdad visual: proporciones, paleta, formas, expresiones, reglas de movimiento y elementos que no deben variar.

## Criterio de uso

No se incorpora una herramienta al flujo sólo porque esté instalada. Se elige la más simple que preserve control y reproducibilidad:

- SVG web interactivo → Inkscape + SVGO + Motion.
- Retoque/raster → Krita o GIMP.
- Animación vectorial 2D → Synfig.
- Frame-by-frame → OpenToonz/Pencil2D.
- Rigging/composición compleja → Blender.
- Export audiovisual → FFmpeg/Kdenlive.

Para los laboratorios web, la ruta preferida será **SVG + Motion + XState**, porque permite reutilizar el personaje como componentes interactivos y mantener bajo el peso de la PWA.
