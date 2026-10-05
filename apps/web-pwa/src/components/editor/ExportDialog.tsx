import { useRef, useState } from "react";
import { Download, Lock, X } from "lucide-react";
import { toast } from "sonner";
import { useProductConfig } from "@/config/ProductConfigProvider";
import {
  defaultMediaProcessAdapter,
  serializeHyb,
  serializeHybx,
  timelineDuration,
  type EditorDoc,
} from "@/engine";
import { DemoBadge } from "@/components/SiteHeader";

function projectFileName(doc: EditorDoc, ext: string): string {
  return `${doc.settings.name.replace(/[^\p{L}\p{N}]+/gu, "-")}.${ext}`;
}

export async function downloadHyb(doc: EditorDoc, appName: string, ext: string) {
  const bytes = await serializeHyb(doc, appName);
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = projectFileName(doc, ext);
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadHybx(doc: EditorDoc, appName: string, ext: string) {
  // Proxys de démo (légers) — le bundle réel embarquera médias / waveforms / vignettes
  const proxy = new TextEncoder().encode(`proxy:${doc.id}`);
  const bytes = await serializeHybx(doc, {
    generator: appName,
    media: doc.assets.map((a) => ({
      assetId: a.id,
      data: proxy,
      kind: "proxy" as const,
    })),
  });
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = projectFileName(doc, ext);
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportDialog({ doc, onClose }: { doc: EditorDoc; onClose: () => void }) {
  const { config, activePlan, watermark } = useProductConfig();
  const [presetId, setPresetId] = useState(config.exportPresets[0]?.id ?? "");
  const [progress, setProgress] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);

  const start = async () => {
    abort.current = new AbortController();
    setProgress(0);
    try {
      const result = await defaultMediaProcessAdapter.render(
        { projectId: doc.id, presetId, durationSec: timelineDuration(doc.timeline), watermark },
        setProgress,
        abort.current.signal,
      );
      toast.success(
        `Rendu terminé (${defaultMediaProcessAdapter.runtime}) — ${result.fileName}. WASM local / cloud selon la durée.`,
      );
      onClose();
    } catch {
      toast.message("Rendu annulé. Votre projet est intact, vous pouvez relancer.");
      setProgress(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold">Exporter</h2>
          <DemoBadge>WASM / cloud</DemoBadge>
          <button
            onClick={onClose}
            className="ml-auto text-muted-foreground hover:text-foreground"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {config.exportPresets.map((p) => {
            const locked = activePlan.exportTier < p.minExportTier;
            return (
              <button
                key={p.id}
                disabled={locked || progress !== null}
                onClick={() => setPresetId(p.id)}
                className={`flex w-full items-start gap-3 rounded-md border p-3 text-left ${presetId === p.id ? "border-primary bg-primary/10" : "border-border hover:bg-secondary"} disabled:opacity-50`}
              >
                <span className="mt-0.5 w-12 shrink-0 rounded bg-raised py-0.5 text-center font-mono text-[10px]">
                  {p.aspectRatio}
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold">{p.name}</span>
                  <span className="block text-xs text-muted-foreground">{p.description}</span>
                </span>
                {locked && (
                  <Lock
                    className="h-4 w-4 text-muted-foreground"
                    aria-label="Plan supérieur requis"
                  />
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Plan {activePlan.name} : {activePlan.exportLabel}
          {watermark ? " · filigrane appliqué" : ""}
        </p>
        {progress !== null && (
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded bg-muted">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {Math.round(progress * 100)}%
            </p>
          </div>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            onClick={() => downloadHyb(doc, config.brand.name, config.brand.projectExtension)}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
          >
            <Download className="h-4 w-4" /> Projet .{config.brand.projectExtension}
          </button>
          <button
            onClick={() => downloadHybx(doc, config.brand.name, config.brand.bundleExtension)}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
          >
            <Download className="h-4 w-4" /> Bundle .{config.brand.bundleExtension}
          </button>
          {progress === null ? (
            <button
              onClick={start}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Lancer le rendu
            </button>
          ) : (
            <button
              onClick={() => abort.current?.abort()}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary"
            >
              Annuler
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
