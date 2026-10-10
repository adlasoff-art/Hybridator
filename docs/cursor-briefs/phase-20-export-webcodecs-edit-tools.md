# Brief Cursor — Phase 20 : Export WebCodecs + outils Reverse/Freeze

Agent Master. Sous-agents : **A (Rendu)**, **C (Engine)**, **H (UI)**.

> Remplacer le rendu vidéo simulé par un encode navigateur quand possible ; compléter les outils CapCut reverse / freeze.

## Tâches
1. A : composeur frame timeline → canvas ; encode `VideoEncoder` + mux MP4 (`mp4-muxer`) ou fallback `MediaRecorder` WebM.
2. A/H : `ExportDialog` télécharge le blob réel ; toast honnête si simulation.
3. C : `reversed` sur clip + preview ; `opsForFreezeFrame` / `opsForReverseClip`.
4. H : boutons Reverse / Freeze dans timeline ou inspecteur.
5. F : tests helpers + `pnpm verify` ; roadmap Phase 20.

## Critères de fin
- Export produit un fichier `.mp4` ou `.webm` téléchargeable si APIs dispo.
- Reverse inverse la lecture source en preview.
- Freeze insère un arrêt sur image à la tête de lecture.
