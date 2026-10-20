import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { FolderOpen, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { CreatorOsLayout } from "@/components/dashboard/DashboardShell";
import { projectInitials, projectThumbStyle } from "@/components/dashboard/thumb";
import { useProductConfig } from "@/config/ProductConfigProvider";
import { defaultProductConfig } from "@/config/product";
import {
  createEmptyNleDoc,
  createSyncAdapter,
  HybParseError,
  openHybx,
  parseHyb,
  webFileSystemAdapter,
  type ProjectSummary,
} from "@/engine";

const name = defaultProductConfig.brand.name;

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: `Mes projets — ${name}` },
      {
        name: "description",
        content: "Créez, ouvrez et importez vos projets de montage enregistrés sur cet appareil.",
      },
      { property: "og:title", content: `Mes projets — ${name}` },
      {
        property: "og:description",
        content: "Créez, ouvrez et importez vos projets de montage enregistrés sur cet appareil.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Projects,
});

function Projects() {
  const { config, cloudSyncAllowed, account } = useProductConfig();
  const navigate = useNavigate();
  const [list, setList] = useState<ProjectSummary[] | null>(null);
  const [cloudList, setCloudList] = useState<ProjectSummary[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    webFileSystemAdapter
      .listProjects()
      .then(setList)
      .catch(() => setList([]));
    if (cloudSyncAllowed) {
      const adapter = createSyncAdapter(() => true, {
        accountId: () => account?.accountId ?? "acc_local",
      });
      void adapter
        .listRemote()
        .then(setCloudList)
        .catch(() => setCloudList([]));
    } else {
      setCloudList([]);
    }
  }, [cloudSyncAllowed, account?.accountId]);
  useEffect(refresh, [refresh]);

  const create = async () => {
    try {
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      const doc = createEmptyNleDoc({
        id,
        name: `Nouveau projet ${new Date().toLocaleDateString("fr-FR")}`,
        now,
      });
      await webFileSystemAdapter.writeProject(doc);
      void navigate({ to: "/editor", search: { id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Création impossible");
    }
  };

  const onImport = async (f: File) => {
    try {
      const buf = new Uint8Array(await f.arrayBuffer());
      const lower = f.name.toLowerCase();
      const bundleExt = `.${config.brand.bundleExtension.toLowerCase()}`;
      const doc = lower.endsWith(bundleExt)
        ? await (await openHybx(buf)).readDocument()
        : await parseHyb(buf);
      await webFileSystemAdapter.writeProject(doc);
      toast.success(`« ${doc.settings.name} » importé`);
      refresh();
    } catch (e) {
      const msg =
        e instanceof HybParseError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Import impossible";
      toast.error(msg);
    }
  };

  return (
    <CreatorOsLayout>
      <div className="dash-page">
        <div className="dash-page-head">
          <div>
            <h1>Projets</h1>
            <p className="dash-page-lead">
              Enregistrés sur cet appareil
              {cloudSyncAllowed ? " · copies cloud listées ci-dessous" : ""}.
            </p>
          </div>
          <div className="dash-page-actions">
            <input
              ref={fileRef}
              type="file"
              accept={`.${config.brand.projectExtension},.${config.brand.bundleExtension},application/json,application/zip`}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImport(f);
                e.target.value = "";
              }}
            />
            <button type="button" className="dash-btn" onClick={() => fileRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Importer .{config.brand.projectExtension}/
              {config.brand.bundleExtension}
            </button>
            <button
              type="button"
              className="dash-btn dash-btn-primary"
              onClick={() => void create()}
            >
              <Plus className="h-3.5 w-3.5" /> Nouveau projet
            </button>
          </div>
        </div>

        <div className="dash-card">
          <Link to="/editor" className="dash-list-row">
            <FolderOpen className="h-5 w-5 shrink-0" style={{ color: "var(--dash-blue)" }} />
            <span className="dash-list-meta">
              <strong>Épisode démo — Podcast multi-caméras</strong>
              <small>Projet d&apos;exemple, toujours disponible</small>
            </span>
          </Link>
          {list === null ? (
            <p className="dash-muted" style={{ padding: "1rem" }}>
              Chargement…
            </p>
          ) : list.length === 0 ? (
            <p className="dash-muted" style={{ padding: "1rem" }}>
              Aucun projet enregistré pour l&apos;instant.
            </p>
          ) : (
            list.map((p) => (
              <div key={p.id} className="dash-list-row">
                <span className="dash-thumb" style={projectThumbStyle(p.id, p.name)} aria-hidden>
                  {projectInitials(p.name)}
                </span>
                <Link to="/editor" search={{ id: p.id }} className="dash-list-meta">
                  <strong>{p.name}</strong>
                  <small>Modifié le {new Date(p.updatedAt).toLocaleString("fr-FR")}</small>
                </Link>
                <button
                  type="button"
                  aria-label={`Supprimer ${p.name}`}
                  className="dash-btn dash-btn-danger"
                  onClick={async () => {
                    await webFileSystemAdapter.deleteProject(p.id);
                    refresh();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {cloudSyncAllowed && cloudList.length > 0 ? (
          <section>
            <h2 className="dash-side-label" style={{ margin: "0 0 0.5rem" }}>
              Cloud
            </h2>
            <div className="dash-card">
              {cloudList.map((p) => (
                <Link key={p.id} to="/editor" search={{ id: p.id }} className="dash-list-row">
                  <FolderOpen className="h-5 w-5 shrink-0" style={{ color: "var(--dash-green)" }} />
                  <span className="dash-list-meta">
                    <strong>{p.name}</strong>
                    <small>Cloud · {new Date(p.updatedAt).toLocaleString("fr-FR")}</small>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </CreatorOsLayout>
  );
}
