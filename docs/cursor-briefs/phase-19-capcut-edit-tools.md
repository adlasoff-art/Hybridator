# Brief Cursor — Phase 19 : Outils d’édition CapCut

Agent Master. Sous-agents : **C (Engine)**, **H (UI)**.

> Compléter la boîte à outils montage : Select / Razor, duplicate/copy-paste, keyframes, fades souris, crop.

## Tâches
1. C : `Clip.crop` + helpers `duplicateClip`, `upsertKeyframe` / `removeKeyframe` (pur TS).
2. H : barre d’outils timeline — Select (`V`) / Razor (`B`) ; clic razor = SPLIT au point.
3. H : Dupliquer (`Ctrl+D`), Copier/Coller (`Ctrl+C` / `Ctrl+V`) clips.
4. H : keyframes opacity/volume — ajouter à la tête de lecture ; losanges sur le clip ; sampling preview.
5. H : poignées fade-in / fade-out drag sur clips audio.
6. H : crop inspecteur (top/right/bottom/left) + `clip-path` preview.
7. F : tests helpers + `pnpm verify` ; roadmap Phase 19.

## Critères de fin
- Basculer Razor et scinder au clic ; Select pour drag/resize.
- Dupliquer / coller un clip sur la même piste (décalé).
- Keyframe opacity visible et appliquée en preview.
- Fades ajustables à la souris sur A*.
- Crop visible sur l’aperçu.
