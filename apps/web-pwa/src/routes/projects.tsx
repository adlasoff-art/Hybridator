import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { FolderOpen, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
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
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const doc = createEmptyNleDoc({
      id,
      name: `Nouveau projet ${new Date().toLocaleDateString("fr-FR")}`,
      now,
    });
    await webFileSystemAdapter.writeProject(doc);
    navigate({ to: "/editor", search: { id } });
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
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-14">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="mr-auto text-3xl font-extrabold">Projets</h1>
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
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
          >
            <Upload className="h-4 w-4" /> Importer .{config.brand.projectExtension}/
            {config.brand.bundleExtension}
          </button>
          <button
            onClick={create}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Nouveau projet
          </button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Enregistrés sur cet appareil
          {cloudSyncAllowed ? " · copies cloud listées ci-dessous" : ""}. Les nouveaux projets
          partent d'un épisode de démonstration.
        </p>

        <div className="mt-8 rounded-lg border border-border bg-card">
          <Link
            to="/editor"
            className="flex items-center gap-4 border-b border-border p-4 hover:bg-secondary/50"
          >
            <FolderOpen className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Épisode démo — Podcast multi-caméras</p>
              <p className="text-xs text-muted-foreground">Projet d'exemple, toujours disponible</p>
            </div>
          </Link>
          {list === null ? (
            <p className="p-4 text-sm text-muted-foreground">Chargement…</p>
          ) : list.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Aucun projet enregistré pour l'instant.
            </p>
          ) : (
            list.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-4 border-b border-border p-4 last:border-0"
              >
                <FolderOpen className="h-5 w-5 text-muted-foreground" />
                <Link to="/editor" search={{ id: p.id }} className="flex-1 hover:underline">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Modifié le {new Date(p.updatedAt).toLocaleString("fr-FR")}
                  </p>
                </Link>
                <button
                  aria-label="Supprimer"
                  onClick={async () => {
                    await webFileSystemAdapter.deleteProject(p.id);
                    refresh();
                  }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
        {cloudSyncAllowed && cloudList.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Cloud
            </h2>
            <div className="rounded-lg border border-border bg-card">
              {cloudList.map((p) => (
                <Link
                  key={p.id}
                  to="/editor"
                  search={{ id: p.id }}
                  className="flex items-center gap-4 border-b border-border p-4 last:border-0 hover:bg-secondary/50"
                >
                  <FolderOpen className="h-5 w-5 text-accent" />
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Cloud · {new Date(p.updatedAt).toLocaleString("fr-FR")}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
