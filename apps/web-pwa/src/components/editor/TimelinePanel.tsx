import { useRef, useState } from "react";
import { Lock, Magnet, Scissors, Trash2, Volume2, VolumeX, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";
import {
  clipEnd,
  createDefaultClip,
  defaultTrackIdForAssetKind,
  snapClipStart,
  timelineDuration,
  type Clip,
  type EditOperation,
  type EditorDoc,
} from "@/engine";
import { HYBRIDATOR_ASSET_MIME, type DraggedAssetPayload } from "@/lib/media-url-cache";
import { shortTime } from "@/lib/timecode";
import { camClass, trackClipClass, trackCode } from "./colors";

interface Props {
  doc: EditorDoc;
  time: number;
  zoom: number;
  setZoom: (z: number) => void;
  selectedClipId: string | null;
  onSelect: (id: string | null) => void;
  onSeek: (t: number) => void;
  apply: (ops: EditOperation[]) => void;
  snapEnabled: boolean;
  setSnapEnabled: (v: boolean) => void;
  magneticEnabled: boolean;
  setMagneticEnabled: (v: boolean) => void;
}

const LABEL_W = 168;
const EDGE_PX = 6;

type DragState =
  | { mode: "move"; clipId: string; originStart: number; originX: number }
  | {
      mode: "resize-l" | "resize-r";
      clipId: string;
      originStart: number;
      originDuration: number;
      originSourceIn: number;
      originSourceOut: number;
      originX: number;
      assetDuration: number;
    };

export function TimelinePanel({
  doc,
  time,
  zoom,
  setZoom,
  selectedClipId,
  onSelect,
  onSeek,
  apply,
  snapEnabled,
  setSnapEnabled,
  magneticEnabled,
  setMagneticEnabled,
}: Props) {
  const duration = timelineDuration(doc.timeline);
  const width = Math.max(duration + 4, 10) * zoom;
  const step = zoom > 60 ? 1 : zoom > 25 ? 5 : 10;
  const ticks = Array.from({ length: Math.ceil(duration / step) + 2 }, (_, i) => i * step);
  const dragRef = useRef<DragState | null>(null);
  const [preview, setPreview] = useState<Record<string, Partial<Clip>>>({});

  const seekFromEvent = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(duration, (e.clientX - rect.left) / zoom)));
  };

  const clipVisual = (c: Clip): Clip => {
    const p = preview[c.id];
    return p ? { ...c, ...p } : c;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.originX) / zoom;
    if (d.mode === "move") {
      let start = Math.max(0, d.originStart + dx);
      if (snapEnabled || magneticEnabled) {
        start = snapClipStart(doc.timeline, d.clipId, start, {
          thresholdSec: snapEnabled ? 0.12 : 0.08,
          playhead: time,
          edges: snapEnabled,
          magnetic: magneticEnabled,
        });
      }
      setPreview({ [d.clipId]: { start } });
      return;
    }
    if (d.mode === "resize-r") {
      const newDur = Math.max(0.05, d.originDuration + dx);
      const sourceOut = Math.min(d.assetDuration, d.originSourceIn + newDur);
      const durationSec = Math.max(0.05, sourceOut - d.originSourceIn);
      setPreview({
        [d.clipId]: {
          duration: durationSec,
          sourceOut,
          sourceIn: d.originSourceIn,
          start: d.originStart,
        },
      });
      return;
    }
    // resize-l
    const maxLeft = d.originDuration - 0.05;
    const delta = Math.max(-d.originStart, Math.min(maxLeft, dx));
    const start = d.originStart + delta;
    const sourceIn = Math.max(0, d.originSourceIn + delta);
    const sourceOut = d.originSourceOut;
    const durationSec = Math.max(0.05, sourceOut - sourceIn);
    setPreview({
      [d.clipId]: { start, duration: durationSec, sourceIn, sourceOut },
    });
  };

  const endDrag = () => {
    const d = dragRef.current;
    const p = d ? preview[d.clipId] : undefined;
    dragRef.current = null;
    if (!d || !p) {
      setPreview({});
      return;
    }
    if (d.mode === "move" && typeof p.start === "number" && p.start !== d.originStart) {
      let start = p.start;
      if (snapEnabled || magneticEnabled) {
        start = snapClipStart(doc.timeline, d.clipId, start, {
          thresholdSec: snapEnabled ? 0.12 : magneticEnabled ? 0.08 : 0,
          playhead: time,
          edges: snapEnabled,
          magnetic: magneticEnabled,
        });
      }
      apply([{ type: "MOVE_CLIP", clipId: d.clipId, start }]);
    } else if (
      (d.mode === "resize-l" || d.mode === "resize-r") &&
      typeof p.start === "number" &&
      typeof p.duration === "number" &&
      typeof p.sourceIn === "number" &&
      typeof p.sourceOut === "number" &&
      (p.start !== d.originStart ||
        p.duration !== d.originDuration ||
        p.sourceIn !== d.originSourceIn ||
        p.sourceOut !== d.originSourceOut)
    ) {
      apply([
        {
          type: "RESIZE_CLIP",
          clipId: d.clipId,
          start: p.start,
          duration: p.duration,
          sourceIn: p.sourceIn,
          sourceOut: p.sourceOut,
        },
      ]);
    }
    setPreview({});
  };

  const dropAssetAt = (assetId: string, trackId: string | undefined, dropTime: number) => {
    const asset = doc.assets.find((a) => a.id === assetId);
    if (!asset) {
      toast.error("Média introuvable.");
      return;
    }
    const tid = trackId ?? defaultTrackIdForAssetKind(asset.kind);
    const track = doc.timeline.tracks.find((t) => t.id === tid);
    if (!track || track.locked) {
      toast.error("Piste indisponible.");
      return;
    }
    const kindOk =
      (asset.kind === "audio" && track.kind === "audio") ||
      (asset.kind !== "audio" && (track.kind === "video" || track.kind === "overlay"));
    const finalTrackId = kindOk ? tid : defaultTrackIdForAssetKind(asset.kind);
    const duration =
      asset.kind === "image" ? Math.min(3, asset.durationSec || 3) : asset.durationSec;
    const clip = createDefaultClip({
      id: `clip_${asset.id}_${Math.random().toString(36).slice(2, 7)}`,
      assetId: asset.id,
      trackId: finalTrackId,
      start: Math.max(0, dropTime),
      duration,
      sourceIn: 0,
      sourceOut: duration,
      label: asset.name,
    });
    apply([{ type: "ADD_CLIP", clip }]);
    onSelect(clip.id);
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-panel"
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
    >
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3 font-mono text-xs">
        <span className="font-semibold uppercase tracking-wider text-muted-foreground">
          Timeline
        </span>
        <button
          type="button"
          disabled={!selectedClipId}
          onClick={() =>
            selectedClipId &&
            apply([{ type: "SPLIT_CLIP", clipId: selectedClipId, position: time }])
          }
          className="ml-2 inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-secondary disabled:opacity-40"
          title="Scinder à la tête de lecture (S)"
        >
          <Scissors className="h-3.5 w-3.5" /> Scinder
        </button>
        <button
          type="button"
          disabled={!selectedClipId}
          onClick={() => {
            if (!selectedClipId) return;
            apply([{ type: "DELETE_CLIP", clipId: selectedClipId, ripple: magneticEnabled }]);
            onSelect(null);
          }}
          className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-secondary disabled:opacity-40"
          title={
            magneticEnabled ? "Supprimer + ripple (mode magnétique)" : "Supprimer le clip (Suppr)"
          }
        >
          <Trash2 className="h-3.5 w-3.5" /> Supprimer
        </button>
        <button
          type="button"
          onClick={() => setSnapEnabled(!snapEnabled)}
          className={`rounded px-2 py-1 text-[10px] uppercase ${snapEnabled ? "bg-primary/20 text-primary" : "hover:bg-secondary text-muted-foreground"}`}
          title="Accrochage aux bords / tête de lecture"
        >
          Snap
        </button>
        <button
          type="button"
          onClick={() => setMagneticEnabled(!magneticEnabled)}
          className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] uppercase ${magneticEnabled ? "bg-primary/20 text-primary" : "hover:bg-secondary text-muted-foreground"}`}
          title="Magnétique : abut au déplacement + ripple à la suppression"
        >
          <Magnet className="h-3 w-3" /> Mag
        </button>
        <span className="ml-auto text-muted-foreground">{doc.operations.length} ops</span>
        <button
          type="button"
          onClick={() => setZoom(Math.max(8, zoom / 1.4))}
          className="rounded p-1 hover:bg-secondary"
          aria-label="Dézoomer"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setZoom(Math.min(200, zoom * 1.4))}
          className="rounded p-1 hover:bg-secondary"
          aria-label="Zoomer"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <div style={{ width: width + LABEL_W }} className="relative">
          <div className="sticky top-0 z-20 flex h-6 border-b border-border bg-panel">
            <div
              style={{ width: LABEL_W }}
              className="sticky left-0 z-10 shrink-0 border-r border-border bg-panel"
            />
            <div className="relative flex-1 cursor-pointer" onClick={seekFromEvent}>
              {ticks.map((t) => (
                <span
                  key={t}
                  className="absolute top-0 h-full border-l border-border pl-1 font-mono text-[10px] text-muted-foreground"
                  style={{ left: t * zoom }}
                >
                  {shortTime(t)}
                </span>
              ))}
            </div>
          </div>
          {doc.timeline.tracks.map((track, i) => (
            <div key={track.id} className="flex h-11 border-b border-border">
              <div
                style={{ width: LABEL_W }}
                className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-border bg-panel px-2 text-xs"
              >
                <span className="w-7 rounded bg-raised py-0.5 text-center font-mono text-[10px] font-semibold">
                  {trackCode(track, i, doc.timeline.tracks)}
                </span>
                <span className="flex-1 truncate">{track.name}</span>
                {track.kind === "audio" && (
                  <button
                    onClick={() =>
                      apply([
                        { type: "SET_TRACK", trackId: track.id, patch: { muted: !track.muted } },
                      ])
                    }
                    aria-label={track.muted ? "Réactiver" : "Couper le son"}
                    className={
                      track.muted ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    }
                  >
                    {track.muted ? (
                      <VolumeX className="h-3.5 w-3.5" />
                    ) : (
                      <Volume2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
                {track.locked && <Lock className="h-3 w-3 text-muted-foreground" />}
              </div>
              <div
                className="relative flex-1"
                onClick={(e) => {
                  onSelect(null);
                  seekFromEvent(e);
                }}
                onDragOver={(e) => {
                  if (
                    e.dataTransfer.types.includes(HYBRIDATOR_ASSET_MIME) ||
                    e.dataTransfer.types.includes("text/plain")
                  ) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const raw =
                    e.dataTransfer.getData(HYBRIDATOR_ASSET_MIME) ||
                    e.dataTransfer.getData("text/plain");
                  if (!raw) return;
                  let assetId = raw;
                  try {
                    const parsed = JSON.parse(raw) as DraggedAssetPayload;
                    if (parsed.assetId) assetId = parsed.assetId;
                  } catch {
                    /* plain id */
                  }
                  const rect = e.currentTarget.getBoundingClientRect();
                  const dropTime = Math.max(0, (e.clientX - rect.left) / zoom);
                  dropAssetAt(assetId, track.id, dropTime);
                }}
              >
                {track.clips.map((raw) => {
                  const c = clipVisual(raw);
                  const asset = doc.assets.find((a) => a.id === c.assetId);
                  const color = track.role === "angles" ? camClass(asset) : trackClipClass(track);
                  const locked = track.locked;
                  return (
                    <div
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(c.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelect(c.id);
                        }
                      }}
                      onPointerDown={(e) => {
                        if (locked || e.button !== 0) return;
                        e.stopPropagation();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        onSelect(c.id);
                        const rect = e.currentTarget.getBoundingClientRect();
                        const localX = e.clientX - rect.left;
                        const assetDur = asset?.durationSec ?? c.sourceOut;
                        if (localX <= EDGE_PX) {
                          dragRef.current = {
                            mode: "resize-l",
                            clipId: c.id,
                            originStart: raw.start,
                            originDuration: raw.duration,
                            originSourceIn: raw.sourceIn,
                            originSourceOut: raw.sourceOut,
                            originX: e.clientX,
                            assetDuration: assetDur,
                          };
                        } else if (localX >= rect.width - EDGE_PX) {
                          dragRef.current = {
                            mode: "resize-r",
                            clipId: c.id,
                            originStart: raw.start,
                            originDuration: raw.duration,
                            originSourceIn: raw.sourceIn,
                            originSourceOut: raw.sourceOut,
                            originX: e.clientX,
                            assetDuration: assetDur,
                          };
                        } else {
                          dragRef.current = {
                            mode: "move",
                            clipId: c.id,
                            originStart: raw.start,
                            originX: e.clientX,
                          };
                        }
                      }}
                      className={`absolute top-1 bottom-1 overflow-hidden rounded-sm border px-1.5 text-left text-[10px] leading-tight ${color} ${
                        selectedClipId === c.id
                          ? "border-foreground ring-1 ring-foreground"
                          : "border-background/40"
                      } ${track.muted || !c.enabled ? "opacity-40" : ""} ${
                        locked ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing"
                      }`}
                      style={{ left: c.start * zoom, width: Math.max(2, c.duration * zoom - 1) }}
                      title={
                        locked
                          ? "Piste verrouillée"
                          : `${c.label ?? asset?.name} — glisser pour déplacer, bords pour redimensionner`
                      }
                    >
                      {!locked && (
                        <>
                          <span className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize" />
                          <span className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize" />
                        </>
                      )}
                      <span className="block truncate font-medium">
                        {track.role === "angles"
                          ? `CAM ${asset?.angle ?? "?"}`
                          : (c.label ?? asset?.name)}
                      </span>
                      {(c.effects.length > 0 || c.transition) && (
                        <span className="mt-0.5 flex gap-0.5 font-mono text-[8px] opacity-80">
                          {c.effects.length > 0 && <span>FX×{c.effects.length}</span>}
                          {c.transition && <span>TR:{c.transition.type}</span>}
                        </span>
                      )}
                      {track.kind === "audio" && (
                        <span className="mt-0.5 flex h-3 items-center gap-px opacity-70">
                          {Array.from(
                            { length: Math.min(80, Math.floor((c.duration * zoom) / 4)) },
                            (_, k) => (
                              <span
                                key={k}
                                className="w-0.5 bg-foreground"
                                style={{
                                  height: `${25 + Math.abs(Math.sin((c.sourceIn + k) * 1.7)) * 75}%`,
                                }}
                              />
                            ),
                          )}
                        </span>
                      )}
                      {c.speed !== 1 && <span className="font-mono">×{c.speed}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-primary"
            style={{ left: LABEL_W + time * zoom }}
          >
            <div className="-ml-1.5 h-2 w-3 rounded-b bg-primary" />
          </div>
          <div
            className="pointer-events-none absolute top-6 bottom-0 z-0 border-l border-dashed border-muted-foreground/30"
            style={{ left: LABEL_W + clipEndOfAll(doc) * zoom }}
          />
        </div>
      </div>
    </div>
  );
}

function clipEndOfAll(doc: EditorDoc) {
  let m = 0;
  for (const t of doc.timeline.tracks) for (const c of t.clips) m = Math.max(m, clipEnd(c));
  return m;
}
