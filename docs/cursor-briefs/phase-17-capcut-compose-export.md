# Brief Cursor — Phase 17 / Jalon 3 : Compose + Export

Agent Master. Sous-agents : **A**, **C**.

## Livré (socle)
- `media-engine/core/compose` (blend, mask, color grade CSS)
- Pipeline export `export/pipeline.ts` (WebCodecs detection, SRT/VTT, progress)
- Hide track + multipiste preview

## Suite
- Decode WebCodecs + cache frames
- Muxer MP4 réel (mp4-muxer) en Worker
- Transitions shader (wipe/dissolve)
