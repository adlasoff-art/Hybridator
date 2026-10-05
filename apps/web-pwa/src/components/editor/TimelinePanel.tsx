import { Lock, Scissors, Volume2, VolumeX, ZoomIn, ZoomOut } from "lucide-react";
import { clipEnd, timelineDuration, type EditOperation, type EditorDoc } from "@/engine";
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
}

const LABEL_W = 168;

export function TimelinePanel({
  doc,
  time,
  zoom,
  setZoom,
  selectedClipId,
  onSelect,
  onSeek,
  apply,
}: Props) {
  const duration = timelineDuration(doc.timeline);
  const width = Math.max(duration + 4, 10) * zoom;
  const step = zoom > 60 ? 1 : zoom > 25 ? 5 : 10;
  const ticks = Array.from({ length: Math.ceil(duration / step) + 2 }, (_, i) => i * step);

  const seekFromEvent = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(duration, (e.clientX - rect.left) / zoom)));
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3 font-mono text-xs">
        <span className="font-semibold uppercase tracking-wider text-muted-foreground">
          Timeline multipiste
        </span>
        <button
          disabled={!selectedClipId}
          onClick={() =>
            selectedClipId &&
            apply([{ type: "SPLIT_CLIP", clipId: selectedClipId, position: time }])
          }
          className="ml-3 inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-secondary disabled:opacity-40"
          title="Couper le clip sélectionné à la tête de lecture (S)"
        >
          <Scissors className="h-3.5 w-3.5" /> Couper
        </button>
        <span className="ml-auto text-muted-foreground">{doc.operations.length} opérations</span>
        <button
          onClick={() => setZoom(Math.max(8, zoom / 1.4))}
          className="rounded p-1 hover:bg-secondary"
          aria-label="Dézoomer"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setZoom(Math.min(200, zoom * 1.4))}
          className="rounded p-1 hover:bg-secondary"
          aria-label="Zoomer"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <div style={{ width: width + LABEL_W }} className="relative">
          {/* ruler */}
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
              >
                {track.clips.map((c) => {
                  const asset = doc.assets.find((a) => a.id === c.assetId);
                  const color = track.role === "angles" ? camClass(asset) : trackClipClass(track);
                  return (
                    <button
                      key={c.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(c.id);
                      }}
                      className={`absolute top-1 bottom-1 overflow-hidden rounded-sm border px-1.5 text-left text-[10px] leading-tight ${color} ${
                        selectedClipId === c.id
                          ? "border-foreground ring-1 ring-foreground"
                          : "border-background/40"
                      } ${track.muted || !c.enabled ? "opacity-40" : ""}`}
                      style={{ left: c.start * zoom, width: Math.max(2, c.duration * zoom - 1) }}
                      title={c.label ?? asset?.name}
                    >
                      <span className="block truncate font-medium">
                        {track.role === "angles"
                          ? `CAM ${asset?.angle ?? "?"}`
                          : (c.label ?? asset?.name)}
                      </span>
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
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {/* playhead */}
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
