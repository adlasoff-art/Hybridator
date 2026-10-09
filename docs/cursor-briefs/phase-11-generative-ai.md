# Brief Cursor — Phase 11 : IA générative (prompt→timeline + édition contextuelle)

Agent Master. Sous-agents : **F (IA)**, **C (Engine Core)**, **H (UI)**, **G (Sécurité)**.

> Suite CapCut. Aucune clé API côté client. Proxy serveur ; repli démo hors ligne.

## Tâches
1. F/C : port `GenerativeAiAdapter` + types `GenerativePlan` / `GenerativeEditResult` dans `@hybridator/ai-core`.
2. C : `planToOperations` / `intentsToOperations` (pur TS) → `EditOperation`s + assets `builtin://ai/…`.
3. F : adaptateurs démo + serveur (`/api/ai/generate`, `/api/ai/edit-clip`) ; OpenAI optionnel via `OPENAI_API_KEY` / `GENERATIVE_API_KEY`.
4. H : onglet Génération IA — scénario A (prompt→projet) et B (instruction sur clip sélectionné).
5. G : quotas via `withQuotaGate` ; secrets uniquement serveur ; health `generativeConfigured`.
6. F : tests plan→ops + handler serveur démo ; `pnpm verify` ; roadmap Phase 11.

## Critères de fin
- Prompt « vidéo 30s + voix + musique » produit clips sur V1/A1/A2/T1 (mode démo ou serveur).
- Instruction sur clip (« flou », « transition », « bruit ») applique des ops sans casser le doc si échec.
- Aucune clé dans le client ni dans le bundle.
