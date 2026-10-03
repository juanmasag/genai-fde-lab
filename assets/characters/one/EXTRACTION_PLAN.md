# ONE — Extraction plan

Canonical visual source: `references/one-character-parts-clean.png`.

## Extraction policy

Use the least destructive method available, in this order:

1. **Direct alpha / pixel extraction** — preferred when a component is already spatially isolated. Preserve source RGBA 1:1.
2. **Mask / MobileSAM extraction** — only when the desired component overlaps or is connected to neighboring artwork.
3. **Generative completion** — only when required pixels do not exist because the component is occluded or absent. Keep the generated region minimal and compare it visually with the canonical master.
4. **Vector reconstruction** — only for geometry that benefits from vectors and can preserve the approved appearance. Never replace the raster master merely to simplify animation.

## Current evidence

The canonical sheet is 1206×1304 RGBA. Alpha analysis found 109 connected components of at least 20 pixels at alpha > 8. Several lower-sheet parts are isolated and therefore candidates for direct extraction. The six expression heads are not six independent alpha components: their artwork participates in a large connected region, so direct connected-component extraction is not sufficient for those heads.

The approved full-body raster master already exists at `source/raster/segmented/one-fullbody-main.png` and passed pixel-preservation validation.

## Work classes

### A — direct extraction first

Prioritize clearly isolated lower-sheet components such as tablet views, individual hands/gestures, limb pieces, joint/boot pieces, and other components whose complete visible contour is separated by transparency. Each candidate still requires source inspection before extraction and post-extraction pixel equality validation.

### B — masking required

Expression heads and any components whose visible pixels touch neighboring artwork require a mask-based workflow. Antenna/cap/hood details must be treated explicitly rather than assumed to belong to a semantic head mask.

### C — generative completion only if necessary

Use only for a component that must exist independently for rigging but has hidden pixels in every canonical view. Do not regenerate complete heads, bodies, or the character merely to obtain cleaner separation.

## Promotion gate

A component can enter `source/raster/segmented/` only after: source inspection; extraction with the least-destructive method; technical validation (RGBA, alpha/bounds, retained-pixel equality where applicable); comparison against the canonical master; and user visual approval when visual judgment is required.
