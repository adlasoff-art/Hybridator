import type { EditorDoc, FileSystemAdapter, ProjectSummary } from "@hybridator/core-model";

export type TauriInvoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

/**
 * FileSystemAdapter natif (Tauri 2).
 * Sans runtime Tauri, bascule sur un stockage mémoire (tests / stub Phase 6).
 */
export function createTauriFileSystemAdapter(
  invoke?: TauriInvoke,
  memoryFallback = true,
): FileSystemAdapter {
  if (!invoke && memoryFallback) {
    const map = new Map<string, EditorDoc>();
    return {
      runtime: "tauri-fs",
      async listProjects(): Promise<ProjectSummary[]> {
        return [...map.values()]
          .map((d) => ({ id: d.id, name: d.settings.name, updatedAt: d.updatedAt }))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      },
      async readProject(id) {
        return map.get(id) ?? null;
      },
      async writeProject(doc) {
        map.set(doc.id, doc);
      },
      async deleteProject(id) {
        map.delete(id);
      },
    };
  }
  if (!invoke) {
    throw new Error("invoke Tauri requis pour FileSystemAdapter natif.");
  }
  const call = invoke;
  return {
    runtime: "tauri-fs",
    listProjects: () => call<ProjectSummary[]>("fs_list_projects"),
    readProject: (id) => call<EditorDoc | null>("fs_read_project", { id }),
    writeProject: (doc) => call<void>("fs_write_project", { doc }),
    deleteProject: (id) => call<void>("fs_delete_project", { id }),
  };
}
