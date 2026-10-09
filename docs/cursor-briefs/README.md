# Briefs Cursor par phase

Collez le brief de la phase en cours dans Cursor, **dans l'ordre**. Chaque brief suppose que la phase précédente respecte la DoD.

Règles communes à toutes les phases (à rappeler à Cursor) :
1. Le modèle de projet et le moteur de timeline n'ont aucune dépendance à React (voir `src/engine/` de la V0, qui sert de référence de contrat).
2. Tout accès aux fichiers et aux médias passe par `FileSystemAdapter`, `MediaProcessAdapter` et `SyncAdapter`.
3. Les opérations ne modifient jamais les médias source ; chaque modification est une `EditOperation` réversible.
4. **Aucune donnée commerciale ou de marque n'est écrite en dur** : nom de la plateforme, plans, prix, devise, durée d'essai, appareils, quotas, préréglages et interrupteurs de fonctionnalités proviennent de la configuration produit (`src/config/product.ts` en V0, puis du back-end).
5. Organisation : appliquer le modèle Master + sous-agents décrit dans `docs/team-agents.md`.

| Phase | Fichier | À lancer quand |
|---|---|---|
| 0 | phase-0.md | Dès maintenant (V0 livrée) |
| 1 | phase-1.md | Après la DoD de la phase 0 |
| 2 | phase-2.md | Après la phase 1 |
| 3 | phase-3.md | Après la phase 2 |
| 4 | phase-4.md | Après la phase 3 |
| 5 | phase-5.md | Après la phase 4 |
| 6 | phase-6.md | Après la phase 5 (ouverture V1+) |
| 7 | phase-7.md | Après la phase 6 (STT réel, Stripe, sync) |
| 8 | phase-8.md | Après la phase 7 (webhook signé, sync persistante) |
| 9 | phase-9-nle-media-timeline.md | Après la phase 8 — NLE CapCut (import médias + timeline) |
| 10 | phase-10-nle-tools.md | Après la phase 9 — effets, texte, transitions, snap/ripple |
| 11 | phase-11-generative-ai.md | Après la phase 10 — prompt→timeline + édition contextuelle |
| 12 | phase-12-capture-studio.md | Après la phase 11 — WebRTC captation ISO → chutier |
| 13 | phase-13-saas-accounts.md | Après la phase 12 — comptes SaaS register/login |
| 15 | phase-15-capcut-unlink-waveform.md | CapCut V1 — unlink A/V + waveforms (Jalon 1) |
| 16 | phase-16-capcut-inspector-keyframes.md | CapCut V1 — inspecteur + keyframes (Jalon 2) |
| 17 | phase-17-capcut-compose-export.md | CapCut V1 — compose WebGL + export (Jalon 3) |
| 18 | phase-18-capcut-captions-ai.md | CapCut V1 — captions auto + TTS (Jalon 4) |
