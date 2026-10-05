# Brief Cursor — Phase 5 : licences multi-appareils et quotas

Agent Master. Sous-agents : **G (Sécurité/Licences)** et **F (QA)**.

## Tâches
1. G : générer une empreinte d'appareil signée, vérifier la licence au démarrage, mettre en place le heartbeat et le JWT.
2. G : gérer les sessions actives et permettre la déconnexion à distance lorsque la limite d'appareils du plan (issue de la configuration) est dépassée.
3. G : tenir des compteurs isolés par sous-système (STT, analyse, TTS, génératif, stockage) et enregistrer un `usage_events` immuable.
4. Gérer l'essai : sa durée et son quota proviennent de la configuration. À la fin de l'essai, passer automatiquement au plan de repli (filigrane, arrêt de la synchronisation cloud).
5. F : tester les limites (quota atteint → blocage poli, travail conservé).

## Critères de fin
L'accès respecte strictement le plan et les interrupteurs de fonctionnalités. Les journaux de coûts sont visibles dans l'administration.
