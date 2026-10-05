# Brief Cursor — Phase 4 : interface React et fonctionnement hors ligne

Agent Master. Sous-agents : **H (UI/PWA)**, **A (Rendu)** et **F (Performance)**.

## Tâches
1. H : ajouter un Service Worker, stocker les médias locaux dans OPFS et passer en mode hors ligne pour les projets locaux.
2. A : générer un aperçu réel via WebCodecs et OffscreenCanvas, avec des proxys pour un défilement fluide.
3. A : effectuer le rendu léger en WASM et le rendu lourd via des workers cloud, derrière `MediaProcessAdapter`.
4. H : permettre le glisser-déposer et le redimensionnement des clips sur la timeline.
5. F : garantir 60 fps à l'aperçu et aucune désynchronisation entre l'audio et la vidéo.

## Critères de fin
L'application est installable et ouvre les projets locaux hors ligne. L'aperçu reste fluide sur un projet multi-caméras de référence.
