# ONE segmented raster masters

These PNG assets preserve the original raster rendering while isolating animation-ready elements with transparency.

## `one-fullbody-main.png`

- Source: `references/one-character-parts-clean.png`
- Segmentation: MobileSAM (`vit_t`, CPU), from the original clean PNG.
- Prompt used for approved V2: box `[5,5,340,425]`; positive points `[145,180]`, `[230,180]`, `[291,170]`.
- Technical validation: 303x398 RGBA crop; exact bounding-box extraction; RGB values of every retained pixel are unchanged from the source.
- Visual validation: approved by the user on 2026-10-03.
- Purpose: raster master for the main full-body character. Do not replace it with the VTracer experiment.
