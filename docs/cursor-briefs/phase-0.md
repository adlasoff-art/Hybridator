# Brief Cursor — Phase 0 : monorepo, adaptateurs, types, interrupteurs de fonctionnalités

Tu es l'agent Master (Lead Architect) du projet. Mobilise les sous-agents **C (Engine Core)**, **G (Sécurité/Licences)** et **H (UI/PWA)**.

## Objectif
Créer le monorepo pnpm conforme à la structure cible : `apps/desktop`, `apps/web-pwa`, `apps/mobile` et les packages `core-model`, `timeline-engine`, `media-engine`, `ai-core`, `licensing-billing` et `ui-system`.

## Tâches (graphe de tâches)
1. C : extraire les types de `src/engine/types.ts` (V0) vers `packages/core-model`, en TypeScript strict et sans React.
2. C : définir les ports `FileSystemAdapter`, `MediaProcessAdapter` et `SyncAdapter`, puis créer les implémentations factices pour les tests.
3. G : définir le schéma de configuration produit (plans, quotas, interrupteurs) en Zod et prévoir son chargement distant, avec repli sur les valeurs par défaut. Aucune valeur n'est écrite en dur.
4. H : faire consommer ces packages par `apps/web-pwa`, en reprenant l'interface V0.
5. Master : mettre en place le CI (`pnpm typecheck`, `pnpm lint`, `pnpm test`).

## Critères de fin
Le CI passe sans aucun avertissement. Les packages s'importent sans React. Une modification de la configuration (prix, nom de la plateforme) se répercute dans l'interface sans changer le code.
