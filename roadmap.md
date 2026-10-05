# Roadmap

- [x] V0 : éditeur web, transcript interactif, projets locaux .hyb, tarifs, appareils, export simulé, administration (aperçu), bannière d'installation
- [x] Configuration produit centrale (aucune donnée commerciale ou de marque en dur)
- [x] Organisation de l'équipe Master + sous-agents (docs/team-agents.md)
- [x] Briefs Cursor phases 0 à 5 (docs/cursor-briefs/)
- [x] Refonte ciblée de l’éditeur : console graphite-lime, aperçu dominant, timeline préservée
- [x] Synchronisation GitHub active (repo public adlasoff-art/Hybridator) — Cursor peut cloner et suivre les briefs
- [x] Phase 0 : monorepo pnpm (`apps/*`, `packages/*`), `core-model`, `licensing-billing`, coquilles, CI (`pnpm verify`)
- [x] Phase 1 : `timeline-engine` (applyOperation, undo/redo, mapping vitesses), suppression libre transcript → timeline, benchmarks
- [x] Phase 2 : formats `.hyb` Zip v2 + `.hybx` bundle, SHA-256, migration JSON v1, extensions via config produit
- [x] Phase 3 : STT adaptatif, détections config, sync waveforms, auto-cut VAD, quotas + usage_events
- [x] Phase 4 : SW + OPFS hors ligne, aperçu proxys 60 fps (media-engine), rendu WASM/cloud, timeline drag/resize
- [ ] V1+ : moteur natif, vraie transcription IA, comptes, paiement, licences réelles (Cursor / prochaines étapes)
