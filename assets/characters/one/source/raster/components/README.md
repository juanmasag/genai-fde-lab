# ONE raster components

Production-oriented raster component set derived from `references/one-character-parts-clean.png`, using `references/one-character-kit-approved.png` as the semantic design reference.

- Direct-alpha components preserve canonical source RGB pixels exactly; only unrelated transparent/background pixels are excluded.
- Expression heads use MobileSAM masks after source inspection because the six heads are connected in the source alpha topology. The retained RGB pixels are copied from the canonical master, not regenerated.
- Head files include the hood, face, antenna and expression as a complete expression-head asset. Facial subcomponents remain available separately for the later rig.
- Generic `module-*` names intentionally avoid inventing left/right or rig relationships not yet proven by assembly testing.

This set is ready for the next assembly/rig-validation stage, but pivot positions and interchangeability still require assembly testing.
