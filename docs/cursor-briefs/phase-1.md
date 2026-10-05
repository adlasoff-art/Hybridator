# Brief Cursor — Phase 1 : moteur de timeline non destructif et annuler/rétablir

Agent Master. Sous-agents : **C (Engine Core)** et **F (Debug/Performance)**.

## Tâches
1. C : porter `applyOperation` (V0) dans `packages/timeline-engine`, couvrant REMOVE_RANGE (ripple), SPLIT_CLIP, CHANGE_SPEED, SWITCH_CAMERA_ANGLE, UPDATE_CLIP et SET_TRACK.
2. C : mettre en place un historique sous forme de commandes inversibles ou de structures persistantes (partage structurel) ; étudier un CRDT pour la future collaboration.
3. C : gérer la correspondance entre temps source et temps timeline lorsque les vitesses varient.
4. F : mener des benchmarks (1 000 clips, 10 pistes) et vérifier l'absence de fuite mémoire dans l'historique.

## Critères de fin
Les tests de propriété montrent que appliquer puis annuler restitue exactement l'état initial. Aucune modification des assets. Les performances restent sous les seuils définis par le Master.
