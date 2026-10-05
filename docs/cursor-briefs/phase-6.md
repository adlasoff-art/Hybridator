# Brief Cursor — Phase 6 : pont V1 (serveur IA, comptes, adaptateurs natifs)

Agent Master. Sous-agents : **D (STT)**, **G (Sécurité/Licences)**, **C (Engine Core)**, **A (Rendu)**.

> Les briefs 0–5 sont livrés. Cette phase ouvre le **V1+** du roadmap : vraie IA via proxy serveur, comptes, prépa paiement, adaptateurs natifs (Tauri/FFmpeg) sans exiger Rust installé tout de suite.

## Tâches
1. D/G : exposer un endpoint serveur STT (`/api/stt`) — clés fournisseurs uniquement côté serveur ; le client utilise `createServerSttAdapter`.
2. G : sessions compte (`/api/auth/session`) + vérification licence serveur (`/api/license/verify`) branchées sur le bootstrap appareil.
3. G : stub paiement (`/api/billing/checkout`) — aucune clé Stripe/etc. côté client ; message poli si non configuré.
4. C/A : adaptateurs natifs purs TS dans `apps/desktop` (`tauri-fs`, `native-ffmpeg`) derrière les ports `FileSystemAdapter` / `MediaProcessAdapter` (stubs invocables, prêts pour Tauri 2).
5. H : basculer l'UI (transcription, admin, appareils) sur le chemin serveur quand disponible ; conserver le repli démo hors ligne.

## Critères de fin
- Aucun secret fournisseur dans le bundle client.
- Transcription via proxy serveur (ou repli démo explicite).
- Compte / licence / checkout passent par des endpoints serveur.
- `pnpm verify` vert ; roadmap Phase 6 cochée.
- Shell Tauri documenté (Rust requis pour le binaire ; adaptateurs déjà testables).
