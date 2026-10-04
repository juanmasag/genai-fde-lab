# ONE Guided Lab v2 — QA evidence

Date: 2026-10-04

## Validation summary

Guided Lab v2 was exercised against the real LAB-01 backend and a 412×915 mobile viewport. The temporary audit document used by browser QA was `guided-v2-audit.md` and was deleted during cleanup.

### Build and integration

`npm run check` passed after the v2 changes.

Validated:
- preview chunks equal ingest chunks;
- overlap is exact at boundaries;
- pgvector metadata matches generated chunks;
- retrieval remains scoped to the active document;
- expected embedding and LLM models are available;
- streamed ingestion includes the expected real phases;
- streamed E2E analysis includes the expected real phases;
- integration audit data is deleted.

Observed stream phases:

`chunking → embedding → embedding_done → db_begin → db_replace → db_document → db_insert… → db_commit`

`question_embedding → question_embedding_done → vector_search → retrieval → context → abstention/LLM → validation`

A separate real streamed run that exercised the LLM completed:

`question_embedding → question_embedding_done → vector_search → retrieval → context → llm → llm_done → validation`

### Full guided walkthrough

The browser QA completed the full narrative journey through:
- document;
- chunk controls and preview;
- document/tokens/chunks visual ingestion;
- transformer calculation gate and every transformer stage;
- real pgvector ingestion;
- real E2E analysis;
- synchronized pipeline recap;
- vector geometry;
- grounded answer;
- pgvector browser;
- closing scene.

The final browser run reported zero JavaScript exceptions.

Progressive disclosure was confirmed:
- chunk scene exposes preview while calculation/ingest/analyze are concealed;
- transformer intro exposes calculation only;
- vector database scene exposes real ingest only;
- query scene exposes E2E analysis only.

Every gated action kept **Siguiente** disabled until the real action completed.

### Real-process narration

During real ingestion, ONE surfaced messages derived from backend progress, including:
- embedding generation;
- embedding dimensions;
- PostgreSQL transaction start;
- document insert;
- individual chunk inserts;
- COMMIT.

During real E2E analysis, ONE surfaced:
- question embedding;
- pgvector nearest-neighbor search;
- retrieval/filtering;
- context construction;
- LLM generation;
- citation validation.

### Bubble placement and blank reserve

Mobile geometry QA with ONE on the right reported:

- guide: `198..402` px;
- bubble: `8..192` px;
- focus target: did not intersect the guide or bubble;
- reserve: immediately after the target;
- bubble/guide overlap: false;
- bubble/target overlap: false;
- guide/target overlap: false.

The bubble pointer was `right`, meaning the bubble was physically on ONE's left and pointed toward the character.

Full walkthrough QA also confirmed the opposite state: ONE on the left used pointer `left`, so the bubble was placed on ONE's right.

A synthetic pointer drag moved ONE from the lower area to the top:
- guide top before: 615 px;
- guide top after: 68 px;
- reserve edge before: `bottom`;
- reserve edge after: `top`.

This validates that moving ONE vertically also moves the blank reserve and scrolls the relevant content to preserve the empty character area.

### Tablet / idle / clarity

The tablet and hands come from the already-versioned canonical ONE component assets; no image generation was used.

The idle controller was timed with a fast speech harness:
- tablet-reading starts about 16 seconds after the explanation becomes idle;
- gaze moves downward toward the tablet;
- tablet is then stored and state becomes `content-watch`;
- the clarity check appears later with **Repetir** and **Seguir**, with **Atrás** hidden.

The tablet composition was separately inspected at full opacity to verify that the rear tablet sits below the face and both hands grip it without covering ONE's identity.

### Voice

The browser runtime ranks installed Spanish voices rather than hardcoding a voice that may not exist on the user's phone. It prioritizes es-AR, es-419 and other Latin-American Spanish variants, boosts natural/neural/online platform voices, and penalizes legacy robotic engines.

Headless Chromium selected `Google español de Estados Unidos` from its own available inventory. The real Android voice inventory is different, so final voice quality remains a user-device validation item.

### Visual evidence

- `one-guided-v2-reserve.png`: ONE on the right with the bubble on the left and a blank reserved stage area.
- `one-guided-v2-tablet-full.png`: canonical rear tablet and both hands composed under ONE's face.
- `one-guided-v2-clarity-actual.png`: clarity prompt with Repetir/Seguir.
- `one-guided-v2-drag-top.png`: ONE moved to the top with the content pushed below the top reserve.
- `one-guided-v2-closing.png`: final guided scene with Inicio instead of a disabled Finalizado button.

User visual/audio review on the actual phone is still required before treating v2 as the final UX.
