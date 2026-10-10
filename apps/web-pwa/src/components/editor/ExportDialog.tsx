import { useRef, useState } from "react";
import { Download, Lock, X } from "lucide-react";
import { toast } from "sonner";
import { useProductConfig } from "@/config/ProductConfigProvider";
import {
  clipAt,
  defaultMediaProcessAdapter,
  serializeHyb,
  serializeHybx,
  timelineDuration,
  type EditorDoc,
} from "@/engine";
import { resolveAssetObjectUrl } from "@/lib/media-url-cache";
import {
  encodeTimelineExport,
  sourceTimeAt,
  transcriptToSrt,
  transcriptToVtt,
  webCodecsAvailable,
} from "@hybridator/media-engine";
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

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** Seek un <video> caché pour peindre les frames d'export quand le média OPFS est dispo. */
async function createMediaResolver(doc: EditorDoc) {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  let loadedUri: string | null = null;

  return async (time: number): Promise<CanvasImageSource | null> => {
    const vTrack =
      doc.timeline.tracks.find((t) => t.id === "v1" && !t.hidden) ??
      doc.timeline.tracks.find((t) => t.kind === "video" && !t.hidden);
    if (!vTrack) return null;
    const clip = clipAt(vTrack, time);
    if (!clip || !clip.enabled) return null;
    const asset = doc.assets.find((a) => a.id === clip.assetId);
    if (!asset || asset.uri.startsWith("demo://")) return null;
    try {
      const url = await resolveAssetObjectUrl(doc.id, asset.id, asset.uri);
      if (!url) return null;
      if (loadedUri !== url) {
        video.src = url;
        loadedUri = url;
        await video.play().catch(() => undefined);
        video.pause();
      }
      const st = Math.max(0, sourceTimeAt(clip, time));
      if (Math.abs(video.currentTime - st) > 0.04) {
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            video.removeEventListener("seeked", onSeeked);
            resolve();
          };
          video.addEventListener("seeked", onSeeked);
          try {
            video.currentTime = st;
          } catch {
            resolve();
          }
          setTimeout(resolve, 120);
        });
      }
      return video;
    } catch {
      return null;
    }
  };
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
      const durationSec = timelineDuration(doc.timeline);
      const preset = config.exportPresets.find((p) => p.id === presetId);
      const cues = doc.transcript.segments.map((s) => ({
        start: s.start,
        end: s.end,
        text: s.text,
      }));
      if (cues.length) {
        for (const [name, body, mime] of [
          [`${doc.settings.name}.srt`, transcriptToSrt(cues), "text/srt"],
          [`${doc.settings.name}.vtt`, transcriptToVtt(cues), "text/vtt"],
        ] as const) {
          downloadBlob(new Blob([body], { type: mime }), name.replace(/[^\p{L}\p{N}._-]+/gu, "-"));
        }
      }

      const dims =
        preset?.aspectRatio === "9:16"
          ? { width: 1080, height: 1920 }
          : preset?.aspectRatio === "1:1"
            ? { width: 1080, height: 1080 }
            : {
                width: doc.settings.width || 1280,
                height: doc.settings.height || 720,
              };
      const resolveMedia = await createMediaResolver(doc);
      const encoded = await encodeTimelineExport({
        doc,
        settings: {
          ...dims,
          fps: doc.settings.fps || 30,
          format: "mp4",
          includeAudio: false,
        },
        watermark,
        brandName: config.brand.name,
        resolveMedia,
        fileBaseName: doc.settings.name,
        signal: abort.current.signal,
        onProgress: (p) => setProgress(p.ratio),
      });

      if (encoded.ok) {
        downloadBlob(encoded.blob, encoded.fileName);
        toast.success(
          `Export ${encoded.mode.toUpperCase()} téléchargé (${encoded.fileName})${
            cues.length ? " · SRT/VTT inclus" : ""
          }.`,
        );
        onClose();
        return;
      }

      // Repli : adaptateur simulé (honnête).
      const result = await defaultMediaProcessAdapter.render(
        { projectId: doc.id, presetId, durationSec, watermark },
        setProgress,
        abort.current.signal,
      );
      toast.message(
        cues.length
          ? `Sous-titres téléchargés. Vidéo simulée (${result.fileName}) — ${encoded.reason}${
              webCodecsAvailable() ? "" : " (WebCodecs absent)"
            }.`
          : `Rendu simulé (${result.fileName}) — ${encoded.reason}. Aucun fichier vidéo généré.`,
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
          <DemoBadge>WebCodecs / WebM</DemoBadge>
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
          {" · "}
          {webCodecsAvailable() ? "WebCodecs détecté" : "repli WebM / simulation"}
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
