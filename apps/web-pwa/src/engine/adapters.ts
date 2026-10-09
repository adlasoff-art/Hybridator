import type {
  CancelSignal,
  EditorDoc,
  FileSystemAdapter,
  MediaProcessAdapter,
  ProjectSummary,
  SyncAdapter,
} from "@hybridator/core-model";
import {
  createCloudMediaProcessAdapter,
  createHybridMediaProcessAdapter,
  createWasmMediaProcessAdapter,
} from "@hybridator/media-engine";

export type {
  FileSystemAdapter,
  MediaBlobStore,
  MediaProcessAdapter,
  ProjectSummary,
  RenderJob,
  SyncAdapter,
  SyncStatus,
} from "@hybridator/core-model";

export { opfsMediaBlobStore, createMemoryMediaBlobStore } from "./opfs-media";

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

/** Rendu simulé legacy (tests / démo sans WASM). */
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

/** Cloud simulé local quand aucun endpoint n'est configuré (pas de secrets client). */
function createSimulatedCloudAdapter(): MediaProcessAdapter {
  return {
    runtime: "cloud",
    render(job, onProgress, signal?: CancelSignal) {
      return new Promise((resolve, reject) => {
        let p = 0;
        const tick = () => {
          if (signal?.aborted) {
            reject(Object.assign(new Error("Rendu annulé"), { name: "AbortError" }));
            return;
          }
          p = Math.min(1, p + 0.03);
          onProgress(p);
          if (p >= 1) {
            resolve({ ok: true, fileName: `${job.projectId}-${job.presetId}-cloud.mp4` });
            return;
          }
          setTimeout(tick, 50);
        };
        setTimeout(tick, 0);
      });
    },
  };
}

/**
 * WASM léger + cloud lourd derrière MediaProcessAdapter.
 * `VITE_CLOUD_RENDER_URL` active le vrai POST workers ; sinon cloud simulé.
 */
export function createDefaultMediaProcessAdapter(): MediaProcessAdapter {
  const wasm = createWasmMediaProcessAdapter();
  const endpoint =
    typeof import.meta !== "undefined" &&
    typeof import.meta.env?.["VITE_CLOUD_RENDER_URL"] === "string"
      ? (import.meta.env["VITE_CLOUD_RENDER_URL"] as string)
      : "";
  const cloud = endpoint
    ? createCloudMediaProcessAdapter({ endpoint })
    : createSimulatedCloudAdapter();
  return createHybridMediaProcessAdapter(wasm, cloud, 120);
}

export const defaultMediaProcessAdapter = createDefaultMediaProcessAdapter();

function syncAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  try {
    const token = localStorage.getItem("hybridator.authToken");
    if (token) headers["authorization"] = `Bearer ${token}`;
  } catch {
    /* ignore */
  }
  return headers;
}

/** Sync local / cloud ; le cloud n'est actif que si l'entitlement l'autorise. */
export function createSyncAdapter(
  cloudAllowed: () => boolean,
  _options?: { accountId?: () => string },
): SyncAdapter {
  // accountId client ignoré côté serveur — seule la session Bearer compte (sinon acc_local).
  void _options;

  return {
    status: () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";
      return cloudAllowed() ? "synced" : "local-only";
    },
    async pushProject(doc) {
      if (!cloudAllowed()) {
        return { ok: false, error: "Sync cloud non autorisée pour ce plan / essai." };
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return { ok: false, error: "Hors ligne — sync reportée. Projet local intact." };
      }
      try {
        const res = await fetch("/api/sync/projects", {
          method: "PUT",
          headers: syncAuthHeaders(),
          body: JSON.stringify({ doc }),
        });
        if (!res.ok) {
          const msg = await res.text().catch(() => res.statusText);
          return { ok: false, error: msg || "Échec sync cloud." };
        }
        return { ok: true };
      } catch {
        return { ok: false, error: "Sync cloud indisponible. Projet local intact." };
      }
    },
    async pullProject(id) {
      if (!cloudAllowed()) return null;
      try {
        const res = await fetch(`/api/sync/projects/${encodeURIComponent(id)}`, {
          headers: syncAuthHeaders(),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { ok: boolean; doc?: EditorDoc };
        return data.doc ?? null;
      } catch {
        return null;
      }
    },
    async listRemote() {
      if (!cloudAllowed()) return [];
      try {
        const res = await fetch("/api/sync/projects", { headers: syncAuthHeaders() });
        if (!res.ok) return [];
        const data = (await res.json()) as { projects?: ProjectSummary[] };
        return data.projects ?? [];
      } catch {
        return [];
      }
    },
  };
}

export const localSyncAdapter: SyncAdapter = createSyncAdapter(() => false);
