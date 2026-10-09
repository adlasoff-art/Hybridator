# Brief Cursor — Phase 13 : SaaS comptes / utilisateurs

Agent Master. Sous-agents : **G (Sécurité)**, **H (UI)**, **C (Engine/sync)**.

> Auth email/mot de passe côté serveur. Projets cloud déjà scopés par `accountId`.

## Tâches
1. G : magasin utilisateurs + sessions (mémoire / `SYNC_DATA_DIR`) ; mots de passe scrypt ; tokens opaques.
2. G : API `POST /api/auth/register|login|logout`, `GET /api/auth/me` ; aucune clé/mot de passe en clair côté client.
3. H : page `/account` (inscription, connexion, profil, déconnexion).
4. H : header + `ProductConfigProvider` branchés sur le compte authentifié.
5. C : sync cloud utilise l’`accountId` du compte connecté (déjà en place — vérifier).
6. F : tests register/login/me ; `pnpm verify` ; roadmap Phase 13.

## Critères de fin
- Créer un compte, se reconnecter, voir le profil.
- Logout invalide le token serveur.
- Compte démo local reste utilisable sans inscription.
