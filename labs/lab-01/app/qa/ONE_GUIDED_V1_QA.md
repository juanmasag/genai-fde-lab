# ONE Guided Lab v1 — QA evidence

Date: 2026-10-04

## Scope validated

- ONE is the visible narrative controller; legacy guide/journey and redundant narrative navigation are hidden in guided mode.
- Functional learner actions remain visible: document controls, chunk parameters, preview, transformer calculation inspector, real ingestion, query controls, real E2E analysis and database inspection.
- Speech, progressive bubble text and facial animation use the same narration string.
- The bubble starts with narration and progressively reveals the utterance.
- The mouth returns to a closed/rest expression when speech ends before the bubble is dismissed.
- ONE highlights a focus target, changes gaze toward it and uses side-aware orientation.
- Narrative navigation is exposed below ONE with Atrás / Repetir / Siguiente.
- Gates block Siguiente until their required real action completes.

## Guided flow exercised

The browser walkthrough exercised these scenes in order:

1. welcome
2. document-source
3. chunk-controls
4. chunk-document
5. chunk-tokens
6. chunk-overlap
7. transformer-intro
8. tf-tokens
9. tf-vector
10. tf-position
11. tf-qkv
12. tf-scores
13. tf-attention
14. tf-context
15. tf-pooling
16. vector-db-action
17. vector-db-result
18. query-action
19. pipeline
20. vectors
21. answer
22. db-browser
23. closing

The preview and calculation gates were validated from the real UI. The real ingestion and E2E analysis endpoints were exercised with a temporary document named `guided-v1-audit.md`; the document was deleted from PostgreSQL during QA cleanup.

## Automated checks

`npm run check` passed after the Guided Lab changes:

- chunk preview == ingest
- overlap exact at chunk boundaries
- pgvector metadata
- retrieval scoped to active document
- expected embedding and LLM models
- audit-document cleanup

Final mobile browser validation reported:

- progressive bubble text: true
- JavaScript exceptions: none
- ONE side: right
- viewport width: 412 px
- ONE bounds: 198–402 px
- control bounds: 166–402 px
- static guide display: none
- journey display: none

This confirms the ONE navigation controls remain inside the mobile viewport when ONE is docked on the right.

## Visual evidence

- `one-guided-v1-speaking-mobile.png`: ONE speaking with progressive bubble text while the document remains visible.
- `one-guided-v1-controls-mobile.png`: ONE after narration with the three narrative hooks visible and contained in the mobile viewport.

User visual review is still required before treating Guided Lab v1 as the final UX.
