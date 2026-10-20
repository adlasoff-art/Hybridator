# Creator OS — Intelligence éditoriale (itération 7)

## Règles

1. Toute suggestion IA se matérialise en `EditOperation[]` (packages `ai-core` / `timeline-engine`).
2. **Preview obligatoire** avant `apply` (`AiOpsPreview`).
3. Jamais de mutation des assets source (OPFS / fichiers d’origine).

## Surfaces livrées

| Surface | Avant | Après |
|---|---|---|
| `GenerativeAiPanel` A/B | apply immédiat | Propose → aperçu → Appliquer / Annuler |
| Auto-cut VAD | apply immédiat | idem |
| Auto captions / Karaoke / TTS | apply immédiat | idem |
| Dashboard assistant | chips morts | « Générer un montage » si `enable_ai_center` |

Helpers : `summarizeEditOperations` (`@hybridator/ai-core`).

## DoD

- [x] Preview UI partagée
- [x] Ops résumées lisibles
- [x] Side-effects titre/transcript seulement après confirm
- [x] Tests summarize + `pnpm verify`
- [ ] Checklist manuelle : proposer génératif → lire ops → Annuler → re-proposer → Appliquer → Undo

## Hors scope (iter 8+)

Déclinaisons formats, publish OAuth, analytics plateformes.
