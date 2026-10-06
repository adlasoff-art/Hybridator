import type { EditorDoc } from "./types";

/** Ports (pattern Port/Adapter). Le code métier ne dépend que de ces interfaces. */

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
}

export interface FileSystemAdapter {
  readonly runtime: "web-indexeddb" | "tauri-fs" | "memory" | "opfs";
  listProjects(): Promise<ProjectSummary[]>;
  readProject(id: string): Promise<EditorDoc | null>;
  writeProject(doc: EditorDoc): Promise<void>;
  deleteProject(id: string): Promise<void>;
}

/** Stockage binaire des médias locaux (OPFS / natif) — séparé du document projet. */
export interface MediaBlobStore {
  readonly runtime: "opfs" | "memory" | "tauri-fs";
  put(projectId: string, assetId: string, data: Uint8Array | Blob): Promise<string>;
  get(projectId: string, assetId: string): Promise<Blob | null>;
  deleteAsset(projectId: string, assetId: string): Promise<void>;
  deleteProject(projectId: string): Promise<void>;
}

export interface RenderJob {
  projectId: string;
  presetId: string;
  durationSec: number;
  watermark: boolean;
}

/** Minimal runtime-agnostic abort signal (compatible with DOM AbortSignal). */
export interface CancelSignal {
  readonly aborted: boolean;
}

export interface MediaProcessAdapter {
  readonly runtime: "demo" | "wasm" | "native-ffmpeg" | "cloud" | "memory";
  render(
    job: RenderJob,
    onProgress: (ratio: number) => void,
    signal?: CancelSignal,
  ): Promise<{ ok: true; fileName: string }>;
}

export type SyncStatus = "local-only" | "synced" | "syncing" | "offline";

export interface SyncAdapter {
  status(): SyncStatus;
  /** Pousse le document projet vers le cloud (no-op / erreur polie si local-only). */
  pushProject(doc: EditorDoc): Promise<{ ok: true } | { ok: false; error: string }>;
  pullProject(id: string): Promise<EditorDoc | null>;
  listRemote(): Promise<ProjectSummary[]>;
}
