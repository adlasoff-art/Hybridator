# Brief Cursor — Phase 21 : LUT · Chroma · Denoise

Agent Master. Sous-agents : **A**, **C**, **H**.

> Suite CapCut : import LUT `.cube`, contrôles chroma key, denoise audio (stub RNNoise-ready).

## Tâches
1. C : `Clip.lut` + `ColorGrade.hue/lightness` ; parse/apply LUT pur TS.
2. A : chroma key RGBA (export compose) ; preview CSS/approx + inspecteur.
3. A : `DenoiseAdapter` stub (gate + high-pass) — port pour WASM RNNoise.
4. H : onglet Couleur (HSL, import `.cube`) ; fond vert ; denoise label.
5. F : tests + `pnpm verify` ; roadmap Phase 21.

## Critères de fin
- Importer un `.cube` et le voir appliqué à l’export.
- Régler chroma key (teinte / tolérance) sur un clip.
- Denoise amount branché sur un adaptateur testable.
