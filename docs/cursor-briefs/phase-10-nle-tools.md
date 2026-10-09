# Brief Cursor — Phase 10 : outils NLE (effets, texte, transitions, snap/ripple)

Agent Master. Sous-agents : **C (Engine Core)**, **H (UI)**.

> Suite CapCut après Phase 9. IA générative et Captation restent hors scope.

## Tâches
1. C : catalogue pur TS (textes, stickers, effets, transitions) + ops `ADD_EFFECT` / `REMOVE_EFFECT` / `SET_TRANSITION` ; `DELETE_CLIP` avec `ripple`.
2. C : helper `snapClipStart` (seuils bords / playhead / voisins) ; tests.
3. H : panneau Texte / Stickers / Effets / Transitions fonctionnels (plus de stubs).
4. H : timeline — toggles Accrochage (snap) + Magnétique (ripple delete / abut) ; badges effets/transitions sur clips.
5. H : preview — overlays texte/stickers + indication CSS d’effet/transition simple.
6. H : inspecteur — liste des effets du clip + retrait.
7. F : brief + roadmap Phase 10 ; `pnpm verify` vert.

## Critères de fin
- Ajouter un titre / sticker sur T1 ou V2 depuis le catalogue.
- Appliquer un effet ou une transition au clip sélectionné.
- Snap actif lors du déplacement ; suppression avec ripple décale les clips suivants.
- Aucune dépendance React dans `packages/*`.
