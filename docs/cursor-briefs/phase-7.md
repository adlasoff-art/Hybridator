# Brief Cursor — Phase 7 : STT fournisseur, Stripe Checkout, sync cloud

Agent Master. Sous-agents : **D (STT)**, **G (Sécurité/Licences)**, **C (Engine Core)**, **H (UI)**.

> Suite V1+ après Phase 6. Shell Tauri 2 reporté tant que Rust n'est pas installé.

## Tâches
1. D : brancher les fournisseurs STT réels derrière `/api/stt` (`STT_PROVIDER=openai|deepgram`) — clé uniquement serveur ; repli démo si média non accessible.
2. G : Checkout Stripe réel via API REST (`STRIPE_SECRET_KEY` + `STRIPE_PRICE_<planId>`) ; webhook `/api/billing/webhook` pour activer le plan.
3. C : étendre `SyncAdapter` (push/pull/list) + endpoints `/api/sync/*` (magasin serveur, secrets hors client).
4. H : enregistrer → push cloud si entitlement ; UI sync / checkout branchées sur les vrais endpoints.
5. F : tests unitaires providers (mock fetch), billing, sync ; `pnpm verify` vert.

## Critères de fin
- Aucune clé Stripe / STT dans le client.
- Avec secrets serveur : chemin fournisseur + Checkout + sync opérationnels.
- Sans secrets : messages polis, travail local intact.
- Roadmap Phase 7 cochée.
