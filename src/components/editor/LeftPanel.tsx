import { useState } from "react";
import { FileText, Film, MessageSquareText, SlidersHorizontal, Sparkles, Type, Video } from "lucide-react";
import { useProductConfig } from "@/config/ProductConfigProvider";
import { DemoBadge } from "@/components/SiteHeader";
import { clipAt, sourceToTimeline, type EditOperation, type EditorDoc, type SourceRange } from "@/engine";
import { shortTime } from "@/lib/timecode";
import { TranscriptPanel } from "./TranscriptPanel";
import { camClass } from "./colors";

const TABS = [
  { id: "media", label: "Médias", icon: Film },
  { id: "multicam", label: "Multi-cam", icon: Video },
  { id: "audio", label: "Mix audio", icon: SlidersHorizontal },
  { id: "text", label: "Texte", icon: Type },
  { id: "captions", label: "Sous-titres", icon: MessageSquareText },
  { id: "transcript", label: "Transcript", icon: FileText },
  { id: "ai", label: "Centre IA", icon: Sparkles },
] as const;
type TabId = (typeof TABS)[number]["id"];

interface Props {
  doc: EditorDoc;
  time: number;
  apply: (ops: EditOperation[], key?: string) => void;
  removeSource: (r: SourceRange[]) => void;
  onSeek: (t: number) => void;
}

export function LeftPanel({ doc, time, apply, removeSource, onSeek }: Props) {
  const [tab, setTab] = useState<TabId>("transcript");
  const { config, activePlan, isFlagOn } = useProductConfig();
  const anglesTrack = doc.timeline.tracks.find((t) => t.role === "angles");
  const activeAngle = anglesTrack ? clipAt(anglesTrack, time)?.assetId : undefined;
  const angleAssets = doc.assets.filter((a) => a.angle !== undefined);
  const allowed = activePlan.multicamAngles ?? Infinity;
  const det = doc.transcript.detections;
  const notRemoved = (r: { start: number; end: number }) => sourceToTimeline((r.start + r.end) / 2, doc.removedRanges) !== null;
  const pendingFillers = det.fillers.filter(notRemoved);
  const pendingSilences = det.silences.filter(notRemoved);
  const pendingSaved = pendingFillers.reduce((a, f) => a + f.end - f.start, 0) + pendingSilences.reduce((a, s) => a + s.duration, 0);
  const removedTotal = doc.removedRanges.reduce((a, r) => a + r.end - r.start, 0);

  return (
    <div className="flex h-full min-h-0">
      <nav className="flex w-14 shrink-0 flex-col border-r border-border bg-background py-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            title={t.label}
            className={`flex flex-col items-center gap-0.5 px-1 py-2 text-[9px] ${tab === t.id ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <t.icon className="h-4 w-4" />
            <span className="w-full truncate text-center">{t.label}</span>
          </button>
        ))}
      </nav>
      <div className="min-w-0 flex-1 overflow-y-auto p-3">
        <h2 className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {TABS.find((t) => t.id === tab)?.label}
        </h2>

        {tab === "media" && (
          <ul className="space-y-1.5">
            {doc.assets.map((a) => (
              <li key={a.id} className="flex items-center gap-2 rounded bg-muted p-2 text-xs">
                <span className={`h-6 w-10 shrink-0 rounded-sm ${a.kind === "video" ? camClass(a) : a.kind === "audio" ? "bg-track-audio" : "bg-track-caption"}`} />
                <span className="flex-1 truncate">{a.name}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{a.kind}</span>
              </li>
            ))}
            <li className="pt-2"><DemoBadge>Import de fichiers réels : moteur natif</DemoBadge></li>
          </ul>
        )}

        {tab === "multicam" &&
          (isFlagOn("enable_multicam_mixer") ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {angleAssets.map((a, i) => {
                  const locked = i >= allowed;
                  return (
                    <button
                      key={a.id}
                      disabled={locked}
                      onClick={() => apply([{ type: "SWITCH_CAMERA_ANGLE", time, angleId: a.id }])}
                      className={`${camClass(a)} ${activeAngle === a.id ? "tally" : ""} flex aspect-video flex-col justify-between rounded p-1.5 text-left font-mono text-[10px] disabled:opacity-30`}
                    >
                      <span className="rounded bg-background/60 px-1">{i + 1}</span>
                      <span className="truncate">{a.name}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Touches 1–{Math.min(angleAssets.length, allowed)} pour couper en direct à la tête de lecture. Limite du plan : {activePlan.multicamAngles ?? "illimité"} angles.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Le mixeur multi-caméras est désactivé.</p>
          ))}

        {tab === "audio" && (
          <div className="space-y-3">
            {doc.timeline.tracks
              .filter((t) => t.kind === "audio")
              .map((t) => {
                const c = t.clips[0];
                return (
                  <div key={t.id} className="rounded bg-muted p-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span>{t.name}</span>
                      <button
                        onClick={() => apply([{ type: "SET_TRACK", trackId: t.id, patch: { muted: !t.muted } }])}
                        className={`rounded px-1.5 font-mono ${t.muted ? "bg-primary text-primary-foreground" : "bg-raised"}`}
                      >
                        M
                      </button>
                    </div>
                    {c && (
                      <input
                        type="range" min={0} max={2} step={0.01} value={c.audio.volume}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          apply(t.clips.map((x) => ({ type: "UPDATE_CLIP" as const, clipId: x.id, patch: { audio: { volume: v } } })), `mix:${t.id}`);
                        }}
                        className="mt-2 w-full accent-accent"
                        aria-label={`Volume ${t.name}`}
                      />
                    )}
                  </div>
                );
              })}
          </div>
        )}

        {tab === "text" && (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Titres, calques de texte et bas de page.</p>
            <DemoBadge>Prochaine étape</DemoBadge>
          </div>
        )}

        {tab === "captions" && (
          <ul className="space-y-1.5">
            {doc.timeline.tracks
              .find((t) => t.role === "captions")
              ?.clips.map((c) => (
                <li key={c.id}>
                  <button onClick={() => onSeek(c.start)} className="w-full rounded bg-muted p-2 text-left text-xs hover:bg-raised">
                    <span className="font-mono text-[10px] text-muted-foreground">{shortTime(c.start)}</span>
                    <span className="block">{c.label}</span>
                  </button>
                </li>
              ))}
          </ul>
        )}

        {tab === "transcript" && (
          <TranscriptPanel doc={doc} time={time} fillerWords={config.transcript.fillerWords} onRemove={removeSource} onSeek={onSeek} />
        )}

        {tab === "ai" &&
          (isFlagOn("enable_ai_center") ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <Stat label="Hésitations" value={pendingFillers.length} />
                <Stat label="Silences" value={pendingSilences.length} />
                <Stat label="Répétitions" value={det.repetitions.length} />
                <Stat label="Gain possible" value={`${pendingSaved.toFixed(1)}s`} />
              </div>
              <button
                onClick={() => removeSource(pendingFillers.map((f) => ({ start: f.start, end: f.end, reason: "hésitation" })))}
                disabled={!pendingFillers.length}
                className="w-full rounded-md bg-secondary px-3 py-2 text-xs hover:bg-raised disabled:opacity-40"
              >
                Retirer les hésitations
              </button>
              <button
                onClick={() => removeSource(pendingSilences.map((s) => ({ start: s.start, end: s.end, reason: "silence" })))}
                disabled={!pendingSilences.length}
                className="w-full rounded-md bg-secondary px-3 py-2 text-xs hover:bg-raised disabled:opacity-40"
              >
                Retirer les silences &gt; {config.transcript.silenceThresholdSec}s
              </button>
              <button
                onClick={() =>
                  removeSource([
                    ...pendingFillers.map((f) => ({ start: f.start, end: f.end, reason: "hésitation" })),
                    ...pendingSilences.map((s) => ({ start: s.start, end: s.end, reason: "silence" })),
                  ])
                }
                disabled={!pendingFillers.length && !pendingSilences.length}
                className="w-full rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
              >
                Tout nettoyer
              </button>
              <p className="text-xs text-muted-foreground">Déjà retiré : {removedTotal.toFixed(1)}s. Tout reste annulable.</p>
              <div className="rounded border border-border p-2 text-xs text-muted-foreground">
                Transcription de démonstration. Quota IA du plan : {activePlan.aiLabel}.
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Le Centre IA est désactivé.</p>
          ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded bg-muted p-2">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="text-base font-semibold">{value}</p>
    </div>
  );
}
