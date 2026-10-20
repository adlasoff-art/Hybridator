# Creator OS — Studio modes (itération 6)

## Audit CaptureStudio (état actuel = Mode A)

Fichier : `apps/web-pwa/src/components/editor/CaptureStudio.tsx`

Capacités livrées (Mode A — Libre) :
- Enumération caméras / micros (`listCaptureDevices`)
- Live preview WebRTC + vu-mètre + gain
- Enregistrement ISO → OPFS (`opfsMediaBlobStore`) + clip non destructif via `EditOperation`
- Option placer sur V1/A1 à la tête de lecture

Hors scope Mode A (ne pas inventer d’UI) :
- B — Guidé (checklist tournage / script lié)
- C — Multi-cam sync (angles liés, switcher)
- D — Téléprompteur / prompteur
- E — ISO avancé (timecode, markers auto, monitoring)

## DoD Mode A

- [x] Label explicite « Mode A — Libre » dans le panneau éditeur
- [x] Stub `/app/studio` pointe vers l’éditeur sans mock
- [x] Pas de mutation des médias source
- [ ] Checklist manuelle : live → REC → Stop & sauver → clip dans chutier / timeline

## Prochaines itérations

Une capacité = une itération + `pnpm verify`. Voir `creator-os-backlog.md` §6–12.
