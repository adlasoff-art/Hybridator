import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { EditorDoc, ProjectSummary } from "@hybridator/core-model";
import type { AccountSession } from "@/lib/account-session";

/**
 * Magasin cloud : mémoire + fichiers (`SYNC_DATA_DIR`).
 * Remplaçable par S3 sans changer les routes (`CloudObjectStore`).
 */

export interface CloudObjectStore {
  get(key: string): Promise<string | null>;
  put(key: string, body: string): Promise<void>;
  delete(key: string): Promise<boolean>;
  list(prefix: string): Promise<string[]>;
}

const memory = new Map<string, string>();

function env(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  const v = process.env[name];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function safeSegment(id: string): string {
  const s = id.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return s.length > 0 ? s : "unknown";
}

class MemoryObjectStore implements CloudObjectStore {
  async get(key: string) {
    return memory.get(key) ?? null;
  }
  async put(key: string, body: string) {
    memory.set(key, body);
  }
  async delete(key: string) {
    return memory.delete(key);
  }
  async list(prefix: string) {
    return [...memory.keys()].filter((k) => k.startsWith(prefix));
  }
}

class FileObjectStore implements CloudObjectStore {
  constructor(private readonly root: string) {}

  private pathFor(key: string): string {
    const parts = key.split("/").map(safeSegment);
    return join(this.root, ...parts);
  }

  async get(key: string) {
    try {
      return await readFile(this.pathFor(key), "utf8");
    } catch {
      return null;
    }
  }

  async put(key: string, body: string) {
    const p = this.pathFor(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, body, "utf8");
  }

  async delete(key: string) {
    try {
      await rm(this.pathFor(key), { force: true });
      return true;
    } catch {
      return false;
    }
  }

  async list(prefix: string) {
    const parts = prefix.split("/").filter(Boolean).map(safeSegment);
    const dir = join(this.root, ...parts);
    try {
      const names = await readdir(dir);
      return names.filter((n) => n.endsWith(".json")).map((n) => `${prefix}${n}`);
    } catch {
      return [];
    }
  }
}

let backend: CloudObjectStore = new MemoryObjectStore();

export function getCloudObjectStore(): CloudObjectStore {
  const dir = env("SYNC_DATA_DIR");
  if (dir) return new FileObjectStore(dir);
  return backend;
}

/** Tests / injection S3 : remplacer le backend mémoire. */
export function setCloudObjectStoreForTests(store: CloudObjectStore | null): void {
  backend = store ?? new MemoryObjectStore();
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function projectKey(accountId: string, projectId: string): string {
  return `projects/${safeSegment(accountId)}/${safeSegment(projectId)}.json`;
}

function projectPrefix(accountId: string): string {
  return `projects/${safeSegment(accountId)}/`;
}

function sessionKey(accountId: string): string {
  return `sessions/${safeSegment(accountId)}.json`;
}

export async function syncList(accountId: string): Promise<ProjectSummary[]> {
  const store = getCloudObjectStore();
  const keys = await store.list(projectPrefix(accountId));
  const out: ProjectSummary[] = [];
  for (const key of keys) {
    const raw = await store.get(key);
    if (!raw) continue;
    try {
      const d = JSON.parse(raw) as EditorDoc;
      out.push({ id: d.id, name: d.settings.name, updatedAt: d.updatedAt });
    } catch {
      /* ignore corrupt */
    }
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function syncGet(accountId: string, projectId: string): Promise<EditorDoc | null> {
  const raw = await getCloudObjectStore().get(projectKey(accountId, projectId));
  if (!raw) return null;
  try {
    return clone(JSON.parse(raw) as EditorDoc);
  } catch {
    return null;
  }
}

export async function syncPut(accountId: string, doc: EditorDoc): Promise<void> {
  const next = clone(doc);
  next.updatedAt = new Date().toISOString();
  await getCloudObjectStore().put(projectKey(accountId, next.id), JSON.stringify(next));
}

export async function syncDelete(accountId: string, projectId: string): Promise<boolean> {
  return getCloudObjectStore().delete(projectKey(accountId, projectId));
}

export async function sessionGet(accountId: string): Promise<AccountSession | null> {
  const raw = await getCloudObjectStore().get(sessionKey(accountId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AccountSession;
  } catch {
    return null;
  }
}

export async function sessionPut(session: AccountSession): Promise<void> {
  await getCloudObjectStore().put(sessionKey(session.accountId), JSON.stringify(session));
}

export async function syncResetForTests(): Promise<void> {
  memory.clear();
  backend = new MemoryObjectStore();
}
