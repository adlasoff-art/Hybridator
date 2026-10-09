# Brief Cursor — Phase 9 : NLE CapCut (médias + timeline)

Agent Master. Sous-agents : **C (Engine Core)**, **H (UI)**, **A (Rendu)** pour l’aperçu.

> Réalignement produit : éditeur type CapCut. IA générative et Captation = phases suivantes (stubs UI seulement).

## Tâches
1. C : `ADD_ASSET`, `ADD_CLIP`, `DELETE_CLIP`, `REMOVE_ASSET`, `ADD_TRACK` dans `core-model` + `applyOperation` ; tests.
2. C : `createEmptyNleDoc()` (pistes V1/V2/A1/A2/T1) ; démo podcast en option secondaire.
3. H : bibliothèque Multimédia — import fichiers → probe → OPFS → grille + bouton `+` + DnD vers timeline.
4. H : shell CapCut (onglets Multimédia / Génération IA / Son / Texte / Stickers / Effets / Transitions / Légendes / Captation) ; hors Multimédia = stubs.
5. H : timeline — scinder, supprimer, zoom, drop depuis le chutier ; labels V1/A1…
6. A/H : preview blob URL des médias importés ; inspecteur opacité %, échelle %, vitesse slider.
7. F : `pnpm verify` vert ; roadmap Phase 9 cochée.

## Critères de fin
- Importer vidéo/audio/image → visible dans Multimédia avec durée.
- Drag ou `+` → clip sur timeline ; split + trim + delete OK.
- Preview lit le fichier importé (pas seulement `demo://`).
- Nouveaux projets démarrent vides (pas le démo podcast).
- Aucune clé API / captation live en Phase 9.
