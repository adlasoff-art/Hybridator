# Brief Cursor — Phase 3 : IA normalisée, silences et auto-cut multi-caméras

Agent Master. Sous-agents : **D (STT/linguistique)**, **B (Audio/DSP)**, **E (Auto-cut)** et **G (Sécurité)**.

## Tâches
1. D : créer des adaptateurs STT interchangeables qui produisent tous un `NormalizedTranscript`. Aucun fournisseur n'est écrit en dur.
2. D : détecter les hésitations, répétitions et silences ; la liste des mots et les seuils proviennent de la configuration.
3. B : synchroniser les angles par intercorrélation des formes d'onde.
4. E : réaliser l'auto-cut par détection d'activité vocale, avec une durée minimale de plan configurable et un plan large en cas de chevauchement de voix.
5. G : garder les clés uniquement côté serveur et inscrire chaque consommation dans `usage_events`.

## Critères de fin
Si un job IA échoue, le projet reste intact et l'utilisateur peut relancer l'opération. Les quotas sont vérifiés avant chaque appel.
