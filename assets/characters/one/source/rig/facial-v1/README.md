# ONE Facial Rig v1 — preparation gate

Canonical identity: `layers/00-canonical-head.png` (420×420 normalized approved frontal head).

Inspected sources confirm the character kit contains independent facial drawings, but the canonical frontal raster already bakes eyes, eyebrows and mouth into the face. Therefore overlaying those drawings on the canonical head is invalid and is forbidden.

## Gate to an animatable facial rig
A valid rig requires a source-faithful facial plate with the baked interchangeable features absent, plus same-canvas 420×420 layers for eyes/closed eyes, brows and mouth poses. The repository currently has no verified clean plate matching the canonical frontal head at its production resolution. Creating one by guessed painting/inpainting would violate AGENTS.md fidelity rules.

## v1 result
- canonical head frozen and versioned;
- actual extracted facial candidates inspected and representative source parts preserved here;
- invalid duplicate-overlay architecture rejected;
- application remains on the canonical solid image;
- next required production step: obtain/derive and visually validate the clean facial plate before generating same-canvas facial layers.

No asset in this directory is authorized as a runtime facial overlay until that gate passes.
