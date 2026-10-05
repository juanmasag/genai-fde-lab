# ONE Neural Speech v15 — QA

Date: 2026-10-04

## Goal

Remove Android Web Speech from ONE's primary audio path and make one real audio timeline drive voice, progressive text and mouth animation.

## Implemented provider contract

Primary provider:

- Azure Speech
- voice: `es-AR-TomasNeural`
- credentials stored server-side only
- full MP3 playback
- word timings
- visemes
- segment bookmarks

Fallback order:

1. Azure Speech SDK with timing/viseme events
2. Azure Speech REST full neural audio with duration-based client timing
3. browser Web Speech only when Azure is unavailable

## Client validation

The Azure client path was exercised with a complete mock MP3 plus Azure-shaped bookmarks, word boundaries and visemes.

Observed invariants:

- neural provider selected: true
- requested male Argentine voice: true
- browser Web Speech calls while neural audio played: 0
- progressive display text advanced while the MP3 played: true
- mouth states changed from audio timing/viseme data: true
- moving ONE during playback did not stop the audio: true
- narration ended normally and exposed narrative controls: true
- JavaScript exceptions: 0

This test validates the browser architecture independently of Azure credentials.

## Server validation

- Azure Speech SDK 1.52.0 installs and imports on the LAB-01 host.
- `POST /api/one/tts` and `GET /api/one/tts/status` are live.
- Without credentials the server reports `configured: false` and the client falls back instead of failing.
- Azure REST synthesis is available as a full-audio fallback if SDK loading or synthesis fails.
- `npm run check` passes after the provider changes.

## Display versus speech copy

`src/one-speech-text.js` converts technical display copy into conversational spoken copy and applies pronunciation aliases. The screen can keep exact terminology while ONE says a more natural equivalent.

## Drag stage

The guide and rig now use the same mobile stage dimensions and dragging no longer renders a background, border, shadow or backdrop filter. This removes the visible transparent container observed in recordings.

## External dependency still required

No Azure Speech resource credentials are currently present on the host. The real TomasNeural voice cannot be auditioned on the Samsung until `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` are configured locally. No secret is committed to Git.
