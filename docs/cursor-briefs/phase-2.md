# Brief Cursor — Phase 2 : formats .hyb / .hybx et intégrité

Agent Master. Sous-agents : **C (Engine Core)** et **G (Sécurité)**.

## Tâches
1. C : faire évoluer le .hyb JSON versionné de la V0 vers un conteneur Zip ou MessagePack contenant project.json, timeline.json, transcript.json et assets_manifest.json.
2. C : créer le .hybx en bundle (médias ou proxys, waveforms, vignettes) avec lecture en flux, sans tout charger en mémoire.
3. G : générer des empreintes SHA-256 par fichier et par asset, refuser les fichiers altérés et prévoir la migration des anciennes versions de format.
4. Les extensions de fichier proviennent de la configuration (`brand.projectExtension` / `bundleExtension`).

## Critères de fin
Un aller-retour web → bureau → web se fait sans perte. Un fichier altéré est rejeté avec un message clair.
