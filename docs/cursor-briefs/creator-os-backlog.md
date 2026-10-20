# Creator OS — backlog séquencé (après dashboard)

Prérequis : itérations dashboard 1–5 livrées (`/app`, honesty-first, stubs). Une capacité = une itération avec DoD + `pnpm verify`.

## 6 — Studio modes

- Auditer `CaptureStudio` dans l’éditeur.
- Livrer **Mode A (libre)** d’abord → voir `creator-os-studio-modes.md` (label UI + audit).
- Modes B–E = backlog documenté (pas de faux UI complète).

## 7 — Intelligence éditoriale

- Suggestions → `EditOperation` uniquement.
- Preview avant apply.
- Jamais de mutation des assets source.
- → Livré : `creator-os-editorial-ai.md` (`AiOpsPreview` + summarize).

## 8 — Déclinaisons / formats

- Versions dérivées comme projets/docs liés.
- Migration hyb non destructive.

## 9 — Publications / OAuth

- Audit des API officielles **avant** code client.
- Checklist export local si pas d’intégration.

## 10 — Analytics

- Sources étiquetées (interne vs plateforme).
- Zéro métrique fictive présentée comme réelle.

## 11 — Agence / permissions

- Modèle + contrôles serveur avant UI multi-tenant.

## 12 — Phase 14 Tauri

- Jalon desktop séparé, hors scope dashboard web.

## Checklist non-régression (permanente)

- `/editor` : play, seek, split, export, import média
- `/projects` : create / open / import hyb
- `/account`, `/pricing` : inchangés
- `pnpm verify` vert
- Thème éditeur graphite-lime intact (tokens dashboard sous `.dashboard-shell` seulement)
