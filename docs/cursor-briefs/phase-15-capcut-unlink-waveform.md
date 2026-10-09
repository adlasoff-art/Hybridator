# Brief Cursor — Phase 15 / Jalon 1 : Unlink A/V + Waveform

Agent Master. Sous-agents : **C (Engine Core)**, **H (UI)**, **A (Rendu/médias)**.

> CapCut V1 commercial — découplage audio/vidéo + formes d’onde réelles (AudioContext).

## Tâches
1. C : `Clip.linkGroupId`, `mediaRole`, op `UNLINK_AUDIO` atomique dans `timeline-engine`.
2. C : helper pur `unlink.ts` + tests (locked, image refusée, undo).
3. A : `media-engine/core/audio/waveform.ts` (decodeAudioData → peaks) + cache OPFS web.
4. H : waveform sur clips audio / bande sur vidéo liée ; bouton « Extraire l’audio ».
5. H : preview — après unlink, vidéo muette + audio depuis piste A.
6. F : `pnpm verify` ; roadmap Phase 15 Jalon 1.

## Critères de fin
- Import vidéo → waveform visible (bande ou piste A après extract).
- Extraire audio → clip A1, V muet, déplacements indépendants.
- Aucun stub de peaks aléatoires.
