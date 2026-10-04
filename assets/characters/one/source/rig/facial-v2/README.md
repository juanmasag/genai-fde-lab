# ONE Facial Rig v2 — registered-layer candidate

Status: **candidate awaiting user visual approval**. This directory is not yet an authorization to replace the current runtime character asset.

## Why v2 exists

`facial-v1` correctly rejected overlaying new facial parts on a head that already had baked eyes, brows and mouth. The later clean facial plate removed that blocker, but registration still had to be proven rather than guessed.

For v2, registration is derived from three already-versioned canonical sources:

- `references/new-source/front-head.png` — the exact full-head parent used for the clean-plate edit;
- `references/one-facial-plate-clean.png` — the same head geometry with eyes, brows and mouth removed;
- `references/one-character-parts-clean.png` — canonical expression/parts sheet.

The important consequence is that the main open eyes, eyebrows and happy mouth are recovered by deterministic image difference between the exact parent and clean plate. Their location and scale are therefore inherited from the approved source rather than manually guessed. Blink and alternate mouth drawings are copied from the canonical parts sheet and registered against the same source-space centers.

## Rig contract

All runtime facial layers are generated on a common 512×512 transparent canvas:

- `00-base-clean`
- `eyes-open`
- `eyes-closed`
- `brow-left`
- `brow-right`
- `mouth-happy`
- `mouth-rest`
- `mouth-smile`
- `mouth-o-small`
- `mouth-o`
- `mouth-open`

The build is deterministic and does not use generative AI.

## Build and QA

From this directory:

```bash
python build_facial_rig.py
python render_preview.py
```

`build_facial_rig.py` validates canonical source dimensions, extracts/normalizes the layers, creates a facial-state QA strip, and writes SHA-256 hashes to `generated/manifest.json`.

`render_preview.py` uses those independent layers to render two six-second previews at 24 fps: a transparent animated WebP for integration QA and an H.264 MP4 on a neutral background for easy review on mobile. Both include occasional blinks, mouth-state changes, eyebrow emphasis and subtle conversational head movement. It requires FFmpeg with `libwebp_anim` and `libx264`.

## Promotion gate

Do not promote the generated layers or preview until visual review confirms:

1. the recomposed open face preserves the approved identity;
2. no seams, halos or facial drift are visible;
3. blink placement reads naturally;
4. mouth swaps remain centered and plausible;
5. eyebrow emphasis does not change the character design;
6. the explaining motion feels enthusiastic without becoming noisy.

The older full-head-swap animation scripts remain prototypes only. v2 is the first candidate architecture that animates independent facial layers on the clean plate.
