# ONE Guided Lab v14 — speech / bubble / idle QA

Date: 2026-10-04
Viewport: 480×1072 mobile
Scope: ONE behavior only.

## Acceptance plan implemented

1. One continuous utterance per narration; sentence boundaries no longer cancel/restart Web Speech.
2. Bubble text grows continuously from the same utterance and scrolls inside the comment bubble instead of resetting per sentence.
3. Mouth shapes are driven from speech word boundaries when available; a timed fallback is used only when the browser does not emit boundaries.
4. Dragging ONE while speaking does not cancel speech, does not hide the bubble, and does not reset progressive text.
5. Bubble stays physically anchored to ONE, switches to the opposite side after a horizontal drag, and its tail points back to ONE.
6. ONE stays in the upper stage; the learning content begins below the complete character stage and remains scrollable.
7. Idle loop: controls retract → content watch → “Voy a estar aquí por si necesitas algo... Solo avisame.” → mirrored rear tablet reading.
8. Tap during tablet reading stores the tablet and asks the clarity question.
9. If the clarity controls receive no response, ONE repeats the standby phrase and returns to tablet reading.
10. Tablet artwork is mirrored independently from ONE's left/right facing.
11. Voice selection still prioritizes es-AR/es-419/Latin-American natural voices, including Google/Microsoft/Samsung candidates; speech rate/pitch are neutral (1.0 / 1.0).
12. PWA cache bumped to v18.

## Automated mobile invariants

The browser QA passed all of these simultaneously:

- oneUtteranceForWelcome: true
- speechContinuesWhileDragging: true
- textContinuesWhileDragging: true
- bubbleMovesWithOne: true
- bubbleDoesNotOverlapOne: true
- oneStaysTop: true
- contentBelowReservedStage: true
- tabletMirrored: true
- tapExitsTablet: true
- clarityControls: true
- returnsToTablet: true
- noExceptions: true

Observed geometry after the final reserve adjustment:

- ONE: y 64..268 px
- reserved learning stage ends at ~268 px
- active content begins at ~282 px
- bubble and ONE do not overlap
- bubble and focus target do not overlap

## Integration regression

`npm run check` passed after these changes, including:

- build
- chunk preview == ingest
- exact overlap
- pgvector metadata
- active-document retrieval scope
- embedding/LLM model checks
- ingest progress stream
- analyze progress stream
- audit cleanup

## Evidence

- `one-v14-speaking-drag.png` — ONE was dragged from right to left during one uninterrupted utterance; bubble followed and changed sides.
- `one-v14-tablet.png` — mirrored canonical rear tablet idle.
- `one-v14-idle-loop.png` — return to tablet after clarity prompt received no user action.

Actual perceived voice quality still depends on the voice inventory exposed by the user's Samsung/Chrome runtime, so that one item must be judged on-device.
