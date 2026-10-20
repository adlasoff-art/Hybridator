import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { createEmptyNleDoc, webFileSystemAdapter, type ProjectSummary } from "@/engine";

type ProjectsStatus = "loading" | "ready" | "error";

type DashboardContextValue = {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  projects: ProjectSummary[];
  projectsStatus: ProjectsStatus;
  refreshProjects: () => void;
  createProject: () => Promise<void>;
  creating: boolean;
  /** Projets filtrés par la recherche (tous, pas seulement top 4). */
  searchMatches: ProjectSummary[];
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsStatus, setProjectsStatus] = useState<ProjectsStatus>("loading");
  const [creating, setCreating] = useState(false);

  const refreshProjects = useCallback(() => {
    setProjectsStatus((s) => (s === "ready" ? "ready" : "loading"));
    void webFileSystemAdapter
      .listProjects()
      .then((list) => {
        setProjects(list);
        setProjectsStatus("ready");
      })
      .catch(() => {
        setProjects([]);
        setProjectsStatus("error");
      });
  }, []);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, searchQuery]);

  const createProject = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    try {
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      const doc = createEmptyNleDoc({
        id,
        name: `Nouveau projet ${new Date().toLocaleDateString("fr-FR")}`,
        now,
      });
      await webFileSystemAdapter.writeProject(doc);
      refreshProjects();
      void navigate({ to: "/editor", search: { id } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Création impossible";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  }, [creating, navigate, refreshProjects]);

  const value = useMemo(
    () => ({
      searchQuery,
      setSearchQuery,
      projects,
      projectsStatus,
      refreshProjects,
      createProject,
      creating,
      searchMatches,
    }),
    [
      searchQuery,
      projects,
      projectsStatus,
      refreshProjects,
      createProject,
      creating,
      searchMatches,
    ],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}
