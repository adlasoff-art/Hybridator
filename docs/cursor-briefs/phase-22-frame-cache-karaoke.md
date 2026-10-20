# Brief Cursor — Phase 22 : Frame cache + karaoke animé

Agent Master. Sous-agents : **A**, **H**, **C**.

> Suite CapCut : cache de frames pour scrub fluide ; légendes karaoke mot-à-mot riches.

## Tâches
1. A : `ScrubFrameCache` (LRU ImageBitmap) + helpers seek/capture vidéo.
2. H : PreviewCanvas utilise le cache au scrub ; badge cache hits optionnel.
3. C/H : captions karaoke en lignes + timings mots ; rendu highlight animé.
4. F : tests cache/captions + `pnpm verify` ; roadmap Phase 22.

## Critères de fin
- Scrubbing réutilise des bitmaps en cache (moins de seeks redondants).
- Karaoke affiche la ligne complète avec mot actif mis en avant.
