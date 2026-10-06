import type { EditorDoc, ProjectSummary } from "@hybridator/core-model";

/** Magasin cloud en mémoire (process) — remplacé par S3/DB sans changer les routes. */
const cloudProjects = new Map<string, Map<string, EditorDoc>>();

function accountStore(accountId: string): Map<string, EditorDoc> {
  let s = cloudProjects.get(accountId);
  if (!s) {
    s = new Map();
    cloudProjects.set(accountId, s);
  }
  return s;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function syncList(accountId: string): ProjectSummary[] {
  return [...accountStore(accountId).values()]
    .map((d) => ({ id: d.id, name: d.settings.name, updatedAt: d.updatedAt }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function syncGet(accountId: string, projectId: string): EditorDoc | null {
  const doc = accountStore(accountId).get(projectId);
  return doc ? clone(doc) : null;
}

export function syncPut(accountId: string, doc: EditorDoc): void {
  const next = clone(doc);
  next.updatedAt = new Date().toISOString();
  accountStore(accountId).set(next.id, next);
}

export function syncDelete(accountId: string, projectId: string): boolean {
  return accountStore(accountId).delete(projectId);
}

/** Test helper — vide le magasin. */
export function syncResetForTests(): void {
  cloudProjects.clear();
}
