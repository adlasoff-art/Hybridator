# Organisation de l'équipe — Master + sous-agents

Pour chaque fonctionnalité, l'agent Master découpe le travail en tâches atomiques organisées en graphe de tâches (DAG). Il les confie aux sous-agents, vérifie la cohérence entre modules et valide la Definition of Done avant mise en production.

## Agent Master — Chef d'orchestre et validateur senior
- Architecture des systèmes multimédia : pipelines de rendu temps réel, montage non destructif.
- Gestion d'état et graphe de tâches : parallélisation des tâches sans interblocage.
- Revue de code senior : performance, fuites mémoire, conformité à la DoD.
- Solution de repli : réattribution d'une tâche en cas d'échec ou d'incohérence.

## Pôle Ingénierie et code
| Sous-agent | Rôle | Compétences clés |
|---|---|---|
| A. Moteur de rendu | Composition multicouche, effets temps réel | GLSL/WGSL, LUTs, WebCodecs, FFmpeg (natif/WASM), OffscreenCanvas 60 fps, proxys et cache d'images |
| B. Audio / DSP | Multipiste, mixage, alignement, réduction de bruit | Web Audio API, AudioWorklets, intercorrélation des formes d'onde, FFT, EQ/compression/gate, EBU R128 / LUFS |
| C. Engine Core | Timeline, historique, format de projet | État immuable / CRDT, annuler/rétablir, sérialiseur .hyb/.hybx (MessagePack, Zip), pont Rust/Tauri 2 |

## Pôle IA et analyse linguistique
| Sous-agent | Rôle | Compétences clés |
|---|---|---|
| D. STT et linguistique | Transcription, segmentation, anomalies du discours | Whisper / Deepgram / Vosk, horodatage au mot, détection des silences et des tics, sortie `NormalizedTranscript` |
| E. Auto-cut multi-caméras | Coupes automatiques entre les angles | Détection d'activité vocale (VAD) multipiste, règles éditoriales (plan minimal configurable, plan large en cas de chevauchement de voix) |

## Pôle Qualité, débogage et sécurité
| Sous-agent | Rôle | Compétences clés |
|---|---|---|
| F. Débogage / Performance | Images perdues, goulets d'étranglement, fuites mémoire | Profilage CDP (thread principal, heap, GPU), fuites WASM/WebGL, benchmarks multipiste 4K |
| G. Sécurité et licences | Jetons d'appareil, accès aux API | Empreinte d'appareil, heartbeat, JWT, RLS, secrets uniquement côté serveur, protection du code critique |
| H. UI/UX et PWA | Interface fluide, sombre, utilisable hors ligne | Tailwind, shadcn, Service Workers, OPFS, glisser-déposer sur la timeline |

## Exemple de flux
« Supprime les silences de plus de 1 s et exporte »
1. D détecte les plages et produit le JSON normalisé.
2. C convertit le JSON en `REMOVE_RANGE`.
3. A recalcule l'aperçu et lance le rendu.
4. F vérifie la synchronisation entre l'audio et la vidéo.
5. Le Master valide la DoD puis livre le résultat.

## Points de validation (DoD)
Le typage et le lint passent sans erreur. Le projet .hyb/.hybx se recharge sans perte d'une version à l'autre (web et bureau). L'accès respecte le plan et les interrupteurs de fonctionnalités. Les médias source ne sont jamais modifiés. En cas d'échec, le travail est conservé et l'utilisateur peut relancer l'opération.
