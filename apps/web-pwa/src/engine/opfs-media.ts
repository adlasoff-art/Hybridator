import type { MediaBlobStore } from "@hybridator/core-model";

async function rootDir(): Promise<FileSystemDirectoryHandle> {
  if (!navigator.storage?.getDirectory) {
    throw new Error("OPFS indisponible dans ce navigateur.");
  }
  return navigator.storage.getDirectory();
}

async function projectDir(projectId: string): Promise<FileSystemDirectoryHandle> {
  const root = await rootDir();
  const media = await root.getDirectoryHandle("media", { create: true });
  return media.getDirectoryHandle(projectId, { create: true });
}

/** Médias locaux en Origin Private File System — utilisables hors ligne. */
export const opfsMediaBlobStore: MediaBlobStore = {
  runtime: "opfs",
  async put(projectId, assetId, data) {
    const dir = await projectDir(projectId);
    const handle = await dir.getFileHandle(assetId, { create: true });
    const writable = await handle.createWritable();
    const blob = data instanceof Blob ? data : new Blob([data as BlobPart]);
    await writable.write(blob);
    await writable.close();
    return `opfs://${projectId}/${assetId}`;
  },
  async get(projectId, assetId) {
    try {
      const dir = await projectDir(projectId);
      const handle = await dir.getFileHandle(assetId);
      return await handle.getFile();
    } catch {
      return null;
    }
  },
  async deleteAsset(projectId, assetId) {
    try {
      const dir = await projectDir(projectId);
      await dir.removeEntry(assetId);
    } catch {
      /* ignore */
    }
  },
  async deleteProject(projectId) {
    try {
      const root = await rootDir();
      const media = await root.getDirectoryHandle("media", { create: true });
      await media.removeEntry(projectId, { recursive: true });
    } catch {
      /* ignore */
    }
  },
};

export function createMemoryMediaBlobStore(): MediaBlobStore {
  const map = new Map<string, Blob>();
  const key = (p: string, a: string) => `${p}::${a}`;
  return {
    runtime: "memory",
    async put(projectId, assetId, data) {
      const blob = data instanceof Blob ? data : new Blob([data as BlobPart]);
      map.set(key(projectId, assetId), blob);
      return `memory://${projectId}/${assetId}`;
    },
    async get(projectId, assetId) {
      return map.get(key(projectId, assetId)) ?? null;
    },
    async deleteAsset(projectId, assetId) {
      map.delete(key(projectId, assetId));
    },
    async deleteProject(projectId) {
      for (const k of [...map.keys()]) {
        if (k.startsWith(`${projectId}::`)) map.delete(k);
      }
    },
  };
}
