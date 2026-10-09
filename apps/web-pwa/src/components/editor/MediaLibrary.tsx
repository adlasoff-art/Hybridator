import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  createDefaultClip,
  defaultTrackIdForAssetKind,
  opfsMediaBlobStore,
  probeMediaFile,
  type Asset,
  type EditOperation,
  type EditorDoc,
} from "@/engine";
import {
  HYBRIDATOR_ASSET_MIME,
  resolveAssetObjectUrl,
  type DraggedAssetPayload,
} from "@/lib/media-url-cache";
import { camClass } from "./colors";

interface Props {
  doc: EditorDoc;
  time: number;
  apply: (ops: EditOperation[], coalesceKey?: string) => void;
}

function assetIdFromFile(file: File): string {
  const base = file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .slice(0, 40);
  return `asset_${base}_${Math.random().toString(36).slice(2, 8)}`;
}

export function MediaLibrary({ doc, time, apply }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      for (const a of doc.assets) {
        if (a.kind === "caption") continue;
        const url = await resolveAssetObjectUrl(doc.id, a.id, a.uri);
        if (url && !cancelled) next[a.id] = url;
      }
      if (!cancelled) setThumbs(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [doc.assets, doc.id]);

  const importFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = [...files];
      if (!list.length) return;
      setBusy(true);
      try {
        for (const file of list) {
          const probed = await probeMediaFile(file);
          const id = assetIdFromFile(file);
          const uri = await opfsMediaBlobStore.put(doc.id, id, file);
          URL.revokeObjectURL(probed.objectUrl);
          const asset: Asset = {
            id,
            name: file.name,
            kind: probed.kind,
            uri,
            durationSec: probed.durationSec,
          };
          apply([{ type: "ADD_ASSET", asset }]);
        }
        toast.success(
          list.length === 1 ? "Média importé dans le chutier." : `${list.length} médias importés.`,
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Import impossible.");
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [apply, doc.id],
  );

  const placeOnTimeline = (asset: Asset) => {
    const trackId = defaultTrackIdForAssetKind(asset.kind);
    const track = doc.timeline.tracks.find((t) => t.id === trackId);
    if (!track) {
      toast.error(`Piste ${trackId} introuvable.`);
      return;
    }
    const duration =
      asset.kind === "image" ? Math.min(3, asset.durationSec || 3) : asset.durationSec;
    const clip = createDefaultClip({
      id: `clip_${asset.id}_${Math.random().toString(36).slice(2, 7)}`,
      assetId: asset.id,
      trackId,
      start: Math.max(0, time),
      duration,
      sourceIn: 0,
      sourceOut: duration,
      label: asset.name,
    });
    apply([{ type: "ADD_CLIP", clip }]);
    toast.success(`Ajouté sur ${track.name}`);
  };

  const onDragStart = (e: React.DragEvent, asset: Asset) => {
    const payload: DraggedAssetPayload = { assetId: asset.id };
    e.dataTransfer.setData(HYBRIDATOR_ASSET_MIME, JSON.stringify(payload));
    e.dataTransfer.setData("text/plain", asset.id);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="video/*,audio/*,image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void importFiles(e.target.files);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="inline-flex w-full items-center justify-center gap-2 rounded border border-border bg-secondary px-3 py-2 text-xs font-medium hover:bg-raised disabled:opacity-50"
      >
        <Upload className="h-3.5 w-3.5 text-primary" />
        {busy ? "Import…" : "Importer"}
      </button>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) void importFiles(e.dataTransfer.files);
        }}
        className={`rounded border border-dashed px-3 py-6 text-center text-xs text-muted-foreground ${
          dragOver ? "border-primary bg-primary/5" : "border-border"
        }`}
      >
        Glissez des vidéos, photos ou fichiers audio ici
      </div>

      <ul className="grid grid-cols-2 gap-2">
        {doc.assets
          .filter((a) => a.kind !== "caption")
          .map((a) => (
            <li key={a.id} className="group min-w-0">
              <div
                draggable
                onDragStart={(e) => onDragStart(e, a)}
                className={`relative aspect-video cursor-grab overflow-hidden rounded border border-border active:cursor-grabbing ${
                  a.kind === "video"
                    ? camClass(a)
                    : a.kind === "audio"
                      ? "bg-track-audio"
                      : "bg-track-caption"
                }`}
              >
                {thumbs[a.id] && a.kind === "image" && (
                  <img src={thumbs[a.id]} alt="" className="h-full w-full object-cover" />
                )}
                {thumbs[a.id] && a.kind === "video" && (
                  <video
                    src={thumbs[a.id]}
                    muted
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                )}
                {!thumbs[a.id] && (
                  <span className="absolute inset-0 grid place-items-center font-mono text-[9px] uppercase text-foreground/70">
                    {a.kind}
                  </span>
                )}
                <button
                  type="button"
                  title="Ajouter à la timeline"
                  onClick={() => placeOnTimeline(a)}
                  className="absolute right-1 top-1 rounded bg-background/90 p-0.5 opacity-0 shadow group-hover:opacity-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <span className="absolute bottom-1 right-1 rounded bg-background/80 px-1 font-mono text-[9px]">
                  {a.durationSec.toFixed(1)}s
                </span>
              </div>
              <span className="mt-1 block truncate text-[10px] text-muted-foreground group-hover:text-foreground">
                {a.name}
              </span>
            </li>
          ))}
      </ul>
      {!doc.assets.filter((a) => a.kind !== "caption").length && (
        <p className="text-xs text-muted-foreground">Aucun média — importez pour commencer.</p>
      )}
    </div>
  );
}
