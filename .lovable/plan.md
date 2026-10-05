# Plan — Refonte ciblée de l’éditeur

## Objectif
Aligner l’éditeur sur la direction « Console équilibrée » et les références fournies, sans modifier la timeline ni ajouter de nouvelles fonctions.

## Résultat attendu
1. **Palette graphite et lime** — fond `#111416`, panneaux `#1C2225`, accent `#8EB318`, texte `#DDE3E5`, déclinés en jetons sémantiques pour préserver la cohérence de toute l’interface.
2. **Typographie technique** — JetBrains Mono pour les titres et données techniques, Work Sans pour les libellés et contenus.
3. **Barre supérieure compacte** — projet mieux centré et identifiable, état local discret, commandes d’annulation, aperçu, enregistrement et export clairement hiérarchisées.
4. **Navigation et panneau gauche** — rail vertical plus lisible ; panneau de travail structuré comme une bibliothèque professionnelle. L’onglet Médias passera en grille compacte, tandis que Transcript, Multi-cam, Audio et IA conserveront leurs fonctions actuelles.
5. **Aperçu dominant** — zone vidéo agrandie et mieux cadrée, commandes de lecture intégrées dans un bandeau compact, avec repères lime sobres.
6. **Inspecteur compact** — sections, valeurs et réglages plus denses, avec séparateurs fins et états actifs lime.
7. **Timeline intacte** — aucune modification de sa structure, de ses interactions ou de ses couleurs.

## Vérification
- Contrôler l’affichage à la taille actuelle de l’aperçu et sur une largeur plus réduite.
- Vérifier les onglets, la lecture, l’annulation/rétablissement, l’enregistrement et l’ouverture de la fenêtre d’export.
- Confirmer qu’aucune erreur d’affichage ou de fonctionnement n’apparaît.

## Détails techniques
- Ajuster les jetons visuels globaux et le chargement des polices.
- Restructurer uniquement la présentation de l’éditeur, du panneau gauche et de l’inspecteur.
- Préserver le moteur, les opérations non destructives, la configuration produit centrale et le composant de timeline.
