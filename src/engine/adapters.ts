import type { EditorDoc } from "./types";

/** Ports (pattern Port/Adapter). Le code métier ne dépend que de ces interfaces. */

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
}

export interface FileSystemAdapter {
  readonly runtime: "web-indexeddb" | "tauri-fs" | "memory";
  listProjects(): Promise<ProjectSummary[]>;
  readProject(id: string): Promise<EditorDoc | null>;
  writeProject(doc: EditorDoc): Promise<void>;
  deleteProject(id: string): Promise<void>;
}

export interface RenderJob {
  projectId: string;
  presetId: string;
  durationSec: number;
  watermark: boolean;
}

export interface MediaProcessAdapter {
  readonly runtime: "demo" | "wasm" | "native-ffmpeg" | "cloud";
  render(job: RenderJob, onProgress: (ratio: number) => void, signal?: AbortSignal): Promise<{ ok: true; fileName: string }>;
}

export type SyncStatus = "local-only" | "synced" | "syncing" | "offline";

export interface SyncAdapter {
  status(): SyncStatus;
}

/* ---------------- Implémentations Web (V0) ---------------- */

const DB_NAME = "projects-db";
const STORE = "projects";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const webFileSystemAdapter: FileSystemAdapter = {
  runtime: "web-indexeddb",
  async listProjects() {
    const all = await tx<EditorDoc[]>("readonly", (s) => s.getAll());
    return all
      .map((d) => ({ id: d.id, name: d.settings.name, updatedAt: d.updatedAt }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async readProject(id) {
    return (await tx<EditorDoc | undefined>("readonly", (s) => s.get(id))) ?? null;
  },
  async writeProject(doc) {
    await tx("readwrite", (s) => s.put(doc));
  },
  async deleteProject(id) {
    await tx("readwrite", (s) => s.delete(id));
  },
};

/** Rendu simulé : aucun média réel n'est encodé en V0. */
export const demoMediaProcessAdapter: MediaProcessAdapter = {
  runtime: "demo",
  render(job, onProgress, signal) {
    return new Promise((resolve, reject) => {
      let p = 0;
      const id = window.setInterval(() => {
        if (signal?.aborted) {
          window.clearInterval(id);
          reject(new DOMException("Rendu annulé", "AbortError"));
          return;
        }
        p = Math.min(1, p + 0.04 + Math.random() * 0.05);
        onProgress(p);
        if (p >= 1) {
          window.clearInterval(id);
          resolve({ ok: true, fileName: `${job.projectId}-${job.presetId}` });
        }
      }, 120);
    });
  },
};

export const localSyncAdapter: SyncAdapter = {
  status: () => (typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "local-only"),
};
