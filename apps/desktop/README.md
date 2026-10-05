# @hybridator/desktop

Adaptateurs natifs Phase 6 derrière les ports `FileSystemAdapter` (`tauri-fs`) et `MediaProcessAdapter` (`native-ffmpeg`).

## État
- **Sans Rust / Tauri** : stubs testables (`pnpm --filter @hybridator/desktop test`) — stockage mémoire + rendu progressif.
- **Avec Rust** : installer [Rust](https://rustup.rs), puis initialiser Tauri 2 dans ce dossier et brancher `invoke` sur `createTauriFileSystemAdapter(invoke)` / `createNativeFfmpegAdapter(invoke)`.

## Commandes Tauri prévues
| Commande | Rôle |
|---|---|
| `fs_list_projects` / `fs_read_project` / `fs_write_project` / `fs_delete_project` | Projets locaux natifs |
| `ffmpeg_render` | Rendu FFmpeg hors navigateur |

L'UI web continue d'utiliser IndexedDB / OPFS / WASM ; le desktop consomme les mêmes packages `@hybridator/*`.
