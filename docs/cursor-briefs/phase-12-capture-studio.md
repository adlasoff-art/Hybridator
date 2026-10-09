# Brief Cursor — Phase 12 : Studio Captation (WebRTC → chutier)

Agent Master. Sous-agents : **H (UI)**, **A (Rendu/médias)**, **C (Engine)**.

> Enregistrement multi-sources navigateur. Desktop Tauri reste Phase 14.

## Tâches
1. A : énumération `MediaDevices` (caméras / micros / cartes d’acquisition exposées par l’OS).
2. A : prévisualisation live + vu-mètres audio (AnalyserNode) + contrôle de gain.
3. A : `MediaRecorder` ISO → blob → `MediaBlobStore` (OPFS) → `ADD_ASSET` dans le chutier.
4. H : panneau **Captation / Live** (plus de stub) ; option « placer sur V1/A1 à la tête de lecture ».
5. C : helpers purs testables (MIME recorder, labels) ; pas de React dans `packages/*`.
6. F : tests helpers + `pnpm verify` ; roadmap Phase 12.

## Critères de fin
- Sélectionner une caméra et un micro, voir le flux live.
- Vu-mètre réactif pendant la prévisualisation / enregistrement.
- Stop enregistrement → média visible dans Multimédia (OPFS).
- Fonctionne sans backend ; permissions navigateur requises.
