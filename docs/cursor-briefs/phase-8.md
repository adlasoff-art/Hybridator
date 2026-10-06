# Brief Cursor — Phase 8 : webhook Stripe signé et sync persistante

Agent Master. Sous-agents : **G (Sécurité/Licences)**, **C (Engine Core)**, **H (UI)**.

> Suite V1+ après Phase 7. Shell Tauri 2 reporté tant que Rust n'est pas installé.

## Tâches
1. G : vérifier `Stripe-Signature` (HMAC-SHA256, `t` + `v1`) sur `/api/billing/webhook` avec `STRIPE_WEBHOOK_SECRET`.
2. C : persister les projets cloud (répertoire `SYNC_DATA_DIR` ; port prêt pour S3) — plus de magasin uniquement en RAM.
3. C : persister les sessions compte avec le même magasin.
4. H : liste des projets cloud sur `/projects` quand la sync est autorisée.
5. F : tests signature (valide / falsifiée / expirée) + magasin fichier ; `pnpm verify` vert.

## Critères de fin
- Webhook rejeté sans signature valide si le secret est configuré.
- Un process serveur redémarré retrouve les projets cloud (avec `SYNC_DATA_DIR`).
- Aucun secret Stripe dans le client.
- Roadmap Phase 8 cochée.
