import type { FileSystemAdapter, MediaProcessAdapter, SyncAdapter } from "./adapters";
import type { EditorDoc } from "./types";

/** Adaptateurs mémoire pour les tests — aucune dépendance navigateur. */

function cloneDoc(doc: EditorDoc): EditorDoc {
  return JSON.parse(JSON.stringify(doc)) as EditorDoc;
}

export function createMemoryFileSystemAdapter(seed: EditorDoc[] = []): FileSystemAdapter {
  const store = new Map<string, EditorDoc>(seed.map((d) => [d.id, cloneDoc(d)]));

  return {
    runtime: "memory",
    async listProjects() {
      return [...store.values()]
        .map((d) => ({ id: d.id, name: d.settings.name, updatedAt: d.updatedAt }))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async readProject(id) {
      const doc = store.get(id);
      return doc ? cloneDoc(doc) : null;
    },
    async writeProject(doc) {
      store.set(doc.id, cloneDoc(doc));
    },
    async deleteProject(id) {
      store.delete(id);
    },
  };
}

export function createMemoryMediaProcessAdapter(): MediaProcessAdapter {
  return {
    runtime: "memory",
    async render(job, onProgress, signal) {
      if (signal?.aborted) {
        const err = new Error("Rendu annulé");
        err.name = "AbortError";
        throw err;
      }
      onProgress(1);
      return { ok: true, fileName: `${job.projectId}-${job.presetId}` };
    },
  };
}

export function createMemorySyncAdapter(
  status: ReturnType<SyncAdapter["status"]> = "local-only",
): SyncAdapter {
  const store = new Map<string, EditorDoc>();
  return {
    status: () => status,
    async pushProject(doc) {
      if (status === "offline" || status === "local-only") {
        return { ok: false, error: "Sync cloud indisponible." };
      }
      store.set(doc.id, cloneDoc(doc));
      return { ok: true };
    },
    async pullProject(id) {
      const doc = store.get(id);
      return doc ? cloneDoc(doc) : null;
    },
    async listRemote() {
      return [...store.values()].map((d) => ({
        id: d.id,
        name: d.settings.name,
        updatedAt: d.updatedAt,
      }));
    },
  };
}
