# Plan — Hybridator V0 fonctionnelle

## Objectif
Construire la V0 du cahier des charges : un prototype d'éditeur web interactif, sombre, de style « Studio Broadcast ». Son architecture doit pouvoir accueillir plus tard le moteur natif développé avec Cursor. Aucune donnée commerciale ou de marque ne sera figée dans le code.

## Ce que vous verrez
1. **Accueil** — présentation du produit, avantages, liens vers l'éditeur et les tarifs.
2. **Éditeur** (agencement de la section 9.1) :
   - Barre du haut : nom du projet, état de synchronisation, annuler/rétablir, aperçu, export.
   - Panneau gauche : Médias, Multi-caméras, Mix audio, Texte, Sous-titres, Transcript, Centre IA.
   - Centre : aperçu vidéo, commandes de lecture, timecode.
   - Timeline multipiste : V2, V1 (angles), A1, A2, C1, avec sélection, découpe et zoom.
   - Inspecteur à droite : position, échelle, couleur, gain, panoramique, réglages multi-caméras.
3. **Transcript interactif** — le mot en cours est surligné pendant la lecture. Les hésitations et les silences sont colorés et se suppriment en un clic. Chaque suppression crée une coupe réversible.
4. **Projets** — création, liste et ouverture locale des projets ; import et export d'un projet .hyb de démonstration.
5. **Tarifs** — grille générée à partir d'une configuration modifiable.
6. **Appareils** — liste des équipements connectés (données de démonstration) et déconnexion.
7. **Export** — choix de préréglage (YouTube, formats verticaux, master pro, pistes audio séparées), avec rendu simulé.
8. **Bannière d'installation** — guide pour installer l'application sur l'appareil.
9. **Administration (aperçu)** — interrupteurs de fonctionnalités, quotas et suivi des coûts IA (données de démonstration).

## Données configurables, jamais figées
Le nom de la plateforme, le slogan, les noms des plans, les prix, la devise, la durée d'essai, le nombre d'appareils, les quotas IA, le stockage cloud, la qualité d'export, le nombre d'angles, les préréglages d'export et les interrupteurs de fonctionnalités seront réunis dans un fichier de configuration central, typé et validé. Les pages lisent toutes ces valeurs. Plus tard, cette configuration pourra provenir de Lovable Cloud sans modifier les pages.

## Organisation d'équipe (Master + sous-agents)
Un document d'équipe reprend votre matrice de compétences : agent Master (orchestration, découpage en graphe de tâches, revue senior, solutions de repli) et sous-agents Rendu, Audio/DSP, Engine Core, STT/linguistique, auto-cut multi-caméras, Debug/Performance, Sécurité/Licences et UI/PWA. Il décrit qui intervient, quand, et les points de validation de la Definition of Done.

## Briefs Cursor par phase
Je fournirai un brief prêt à coller au moment opportun, en commençant par les Phases 0 à 2, que Cursor peut lancer dès la livraison de la V0 :
- Phase 0 — monorepo, adaptateurs, types, interrupteurs de fonctionnalités (Master + Engine Core + Sécurité)
- Phase 1 — moteur de timeline non destructif et annuler/rétablir (Engine Core + QA)
- Phase 2 — formats .hyb/.hybx et empreintes d'intégrité (Engine Core + Sécurité)
- Phase 3 — IA normalisée, silences, auto-cut (STT + Audio DSP + Multi-cam)
- Phase 4 — interface et fonctionnement hors ligne (UI/PWA + Rendu)
- Phase 5 — licences multi-appareils et quotas (Sécurité/Licences + QA)

Chaque brief précise les sous-agents à mobiliser, les règles à respecter (moteur indépendant de React, adaptateurs, non-destruction, configuration non figée) et les critères de fin.

## Hors V0 (prévu pour Cursor ou les étapes suivantes)
Application de bureau native, rendu natif, enregistrement matériel multi-micros, vraie transcription IA, comptes, paiement et vérification réelle des appareils. Ces fonctions apparaîtront dans l'interface comme des démonstrations clairement signalées.

## Détails techniques
- Routes TanStack : `/`, `/editor`, `/projects`, `/pricing`, `/devices`, `/admin`, chacune avec ses propres métadonnées de page.
- `src/config/product.ts` : schéma Zod regroupant marque, plans, quotas, préréglages et interrupteurs ; accès via `useProductConfig()`.
- `src/engine/` : TypeScript pur, sans React. Contient les types `Clip`, `Track`, `EditOperation` et `NormalizedTranscript`, un historique de commandes inversibles et les adaptateurs `FileSystemAdapter`, `MediaProcessAdapter` et `SyncAdapter`, avec une implémentation web de démonstration.
- Sérialisation .hyb en JSON versionné (project, timeline, transcript, assets_manifest), avec empreintes SHA-256 calculées via WebCrypto.
- Projets locaux enregistrés dans IndexedDB. Manifeste PWA et bannière d'installation, sans service worker actif dans l'aperçu.
- Design tokens « Studio Broadcast » définis en OKLCH dans `styles.css`, avec typographie technique distinctive.
- Tests unitaires Vitest du moteur : opération, annulation, rétablissement, absence de modification des médias source.
- Fichiers `docs/team-agents.md` et `docs/cursor-briefs/phase-0..5.md`, plus une règle d'architecture dans `AGENTS.md`.
