# ONE rig v8

V8 abandons whole-head swapping and CSS deformation. The approved frontal source remains the identity layer.

Runtime layers:
1. canonical front head (immutable identity)
2. mouth overlay (independent pose layer)
3. blink overlay (independent short event)
4. whole-rig micro-motion (translation/rotation only)
5. speech bubble (HTML UI, viewport-clamped, not part of the rig)

State machine: talking -> attentive -> playful -> neutral -> bored. Blink is orthogonal and can occur during talking/idle. Interaction interrupts idle progression and returns to talking/attentive.

Mouth timing is event-driven with irregular hold durations rather than a fixed metronome. No scaleY/shape deformation is allowed. All visible character motion preserves the canonical frontal silhouette.
