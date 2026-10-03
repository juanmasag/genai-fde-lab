# Visual quality status

Corrected after direct visual review.

- Removed `body-module-a.png`: it contained two body/hip figures in one asset.
- Removed `torso-module-a.png`: it contained a torso plus an arm in one asset.
- Removed `foot-module-b.png`: it was a hand, not a foot.
- Renamed the four visually confirmed foot assets to `foot-a` through `foot-d`.
- Replaced the six MobileSAM head outputs because their masks contained neighboring fragments. Current head files are conservative canonical-source crops and preserve all source pixels; they are not yet decomposed base-head rig layers.

Rule for remaining production set: one semantic asset per file. Any file found to contain unrelated neighboring artwork must be removed or re-extracted before rigging.

Second visual audit:
- Removed `arms/arm-module-a.png`: it contained two arm figures in one file.
- Removed `hands/hand-thumb-up-a.png`: it was an eye and was semantically misclassified.
- Head outputs were cleaned by retaining the principal connected foreground from each inspected MobileSAM result; residual left-edge neighbor fragments on surprised/thinking were removed after direct review. RGB content of retained character pixels is unchanged.
