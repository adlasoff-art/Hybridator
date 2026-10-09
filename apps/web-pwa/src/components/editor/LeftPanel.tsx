import { useState } from "react";
import { toast } from "sonner";
import { useProductConfig } from "@/config/ProductConfigProvider";
import {
  alignAngleOffsets,
  buildAutoCutOperations,
  clipAt,
  opsForAutoCaptions,
  requestTtsClip,
  runAiJob,
  sourceToTimeline,
  timelineDuration,
  type EditOperation,
  type EditorDoc,
  type SourceRange,
} from "@/engine";
import { withQuotaGate } from "@/lib/usage-store";
import { resolveSttAdapter } from "@/lib/stt-client";
import { shortTime } from "@/lib/timecode";
import { TranscriptPanel } from "./TranscriptPanel";
import { MediaLibrary } from "./MediaLibrary";
import { CatalogBrowser } from "./CatalogBrowser";
import { GenerativeAiPanel } from "./GenerativeAiPanel";
import { CaptureStudio } from "./CaptureStudio";
import { camClass } from "./colors";

export const CREATIVE_TABS = [
  { id: "media", label: "Multimédia" },
  { id: "ai", label: "Génération IA" },
  { id: "audio", label: "Son" },
  { id: "text", label: "Texte" },
  { id: "stickers", label: "Stickers" },
  { id: "effects", label: "Effets" },
  { id: "transitions", label: "Transitions" },
  { id: "captions", label: "Légendes" },
  { id: "capture", label: "Captation / Live" },
] as const;

export type CreativeTabId = (typeof CREATIVE_TABS)[number]["id"];

interface Props {
  doc: EditorDoc;
  time: number;
  tab: CreativeTabId;
  selectedClipId: string | null;
  apply: (ops: EditOperation[], key?: string) => void;
  patchDoc: (fn: (d: EditorDoc) => EditorDoc) => void;
  removeSource: (r: SourceRange[]) => void;
  onSeek: (t: number) => void;
  onLoadDemo: () => void;
}

function demoWaveform(seed: number, n = 4000): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.sin((i + seed * 17) / 19) * 0.6;
  return out;
}

export function LeftPanel({
  doc,
  time,
  tab,
  selectedClipId,
  apply,
  patchDoc,
  removeSource,
  onSeek,
  onLoadDemo,
}: Props) {
  const [aiBusy, setAiBusy] = useState(false);
  const { config, activePlan, isFlagOn, inTrial } = useProductConfig();
  const anglesTrack = doc.timeline.tracks.find((t) => t.role === "angles");
  const activeAngle = anglesTrack ? clipAt(anglesTrack, time)?.assetId : undefined;
  const angleAssets = doc.assets.filter((a) => a.angle !== undefined);
  const allowed = activePlan.multicamAngles ?? Infinity;
  const det = doc.transcript.detections;
  const notRemoved = (r: { start: number; end: number }) =>
    sourceToTimeline((r.start + r.end) / 2, doc.removedRanges) !== null;
  const pendingFillers = det.fillers.filter(notRemoved);
  const pendingSilences = det.silences.filter(notRemoved);

  const runAlignAngles = () => {
    const waves = angleAssets.slice(0, allowed).map((a, i) => ({
      angleId: a.id,
      samples: demoWaveform(i + 1),
    }));
    if (waves.length < 2) {
      toast.message("Ajoutez au moins deux angles pour aligner.");
      return;
    }
    const shifted = new Float32Array(waves[1]!.samples.length);
    const lag = 35;
    for (let i = 0; i < shifted.length; i++) {
      shifted[i] = i >= lag ? waves[0]!.samples[i - lag]! : 0;
    }
    waves[1] = { angleId: waves[1]!.angleId, samples: shifted };
    const offsets = alignAngleOffsets(waves, 1000, 0.2);
    const summary = offsets
      .filter((o) => o.angleId !== waves[0]?.angleId)
      .map((o) => `${o.angleId}: ${(o.offsetSec * 1000).toFixed(0)} ms`)
      .join(" · ");
    toast.success(`Alignement : ${summary || "ok"}`);
  };

  const runAutoCut = () => {
    const wide = angleAssets.find((a) => a.angle === 1)?.id ?? angleAssets[0]?.id;
    const host = angleAssets.find((a) => a.angle === 2)?.id;
    const guest = angleAssets.find((a) => a.angle === 3)?.id;
    if (!wide || !host || !guest) {
      toast.message("Auto-cut : angles wide / host / guest requis.");
      return;
    }
    const segs = doc.transcript.segments;
    const ops = buildAutoCutOperations({
      wideAngleId: wide,
      minShotSec: config.multicam.minShotSec,
      timelineEnd: timelineDuration(doc.timeline),
      angles: [
        {
          angleId: host,
          ranges: segs
            .filter((s) => /anim|host/i.test(s.speaker))
            .map((s) => ({ start: s.start, end: s.end })),
        },
        {
          angleId: guest,
          ranges: segs
            .filter((s) => /invit|guest/i.test(s.speaker))
            .map((s) => ({ start: s.start, end: s.end })),
        },
        { angleId: wide, ranges: [] },
      ],
    });
    if (ops.length === 0) {
      toast.message("Aucune coupe proposée.");
      return;
    }
    apply(ops);
    toast.success(`Auto-cut : ${ops.length} bascule(s).`);
  };

  const runTranscribe = async () => {
    if (aiBusy) return;
    setAiBusy(true);
    const { adapter: stt, mode } = await resolveSttAdapter(isFlagOn("enable_server_stt"));
    const minutes = Math.max(1, Math.ceil(timelineDuration(doc.timeline) / 60));
    const gate = withQuotaGate(activePlan, "stt", minutes, "min", stt.providerId, doc.id, {
      rates: config.usageCostRatesUsd,
      ...(inTrial ? { trialAiMinutesCap: config.trial.aiMinutes } : {}),
    });
    const snapshot = doc;
    const result = await runAiJob({
      before: gate.before,
      run: () =>
        stt.transcribe(
          {
            projectId: doc.id,
            mediaUri: doc.assets.find((a) => a.kind === "audio")?.uri ?? "demo://audio",
            durationSec: timelineDuration(doc.timeline),
            language: "fr",
          },
          config.transcript,
        ),
      after: gate.after,
    });
    setAiBusy(false);
    if (!result.ok) {
      toast.error(`${result.error} Projet intact — vous pouvez relancer.`);
      return;
    }
    if (snapshot.id !== doc.id) {
      toast.message("Projet changé pendant le job — résultat ignoré.");
      return;
    }
    patchDoc((d) => ({ ...d, transcript: result.value, assets: d.assets }));
    toast.success(
      mode === "server"
        ? "Transcription terminée (proxy serveur)."
        : "Transcription terminée (adaptateur démo).",
    );
  };

  const label = CREATIVE_TABS.find((t) => t.id === tab)?.label ?? tab;

  return (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      <div className="sticky top-0 z-10 flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
        <h2 className="font-mono text-[10px] font-semibold uppercase text-foreground">{label}</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "media" && (
          <div className="space-y-4">
            <MediaLibrary doc={doc} time={time} apply={apply} />
            <button
              type="button"
              onClick={onLoadDemo}
              className="w-full rounded border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              Charger le projet démo (podcast)
            </button>
          </div>
        )}

        {tab === "ai" && (
          <div className="space-y-4">
            <GenerativeAiPanel
              doc={doc}
              selectedClipId={selectedClipId}
              apply={apply}
              patchDoc={patchDoc}
            />
            {isFlagOn("enable_ai_center") && (
              <div className="space-y-2 border-t border-border pt-3">
                <p className="font-mono text-[10px] uppercase text-muted-foreground">
                  Transcript / STT
                </p>
                <button
                  type="button"
                  disabled={aiBusy}
                  onClick={() => void runTranscribe()}
                  className="w-full rounded-md border border-border px-3 py-2 text-xs hover:bg-secondary disabled:opacity-40"
                >
                  {aiBusy ? "Transcription…" : "Relancer la transcription (STT)"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    removeSource(
                      pendingFillers.map((f) => ({
                        start: f.start,
                        end: f.end,
                        reason: "hésitation",
                      })),
                    )
                  }
                  disabled={!pendingFillers.length}
                  className="w-full rounded-md bg-secondary px-3 py-2 text-xs disabled:opacity-40"
                >
                  Retirer les hésitations ({pendingFillers.length})
                </button>
                <button
                  type="button"
                  onClick={() =>
                    removeSource(
                      pendingSilences.map((s) => ({
                        start: s.start,
                        end: s.end,
                        reason: "silence",
                      })),
                    )
                  }
                  disabled={!pendingSilences.length}
                  className="w-full rounded-md bg-secondary px-3 py-2 text-xs disabled:opacity-40"
                >
                  Retirer les silences ({pendingSilences.length})
                </button>
              </div>
            )}
          </div>
        )}

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
                        type="button"
                        onClick={() =>
                          apply([{ type: "SET_TRACK", trackId: t.id, patch: { muted: !t.muted } }])
                        }
                        className={`rounded px-1.5 font-mono ${t.muted ? "bg-primary text-primary-foreground" : "bg-raised"}`}
                      >
                        M
                      </button>
                    </div>
                    {c && (
                      <input
                        type="range"
                        min={0}
                        max={2}
                        step={0.01}
                        value={c.audio.volume}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          apply(
                            t.clips.map((x) => ({
                              type: "UPDATE_CLIP" as const,
                              clipId: x.id,
                              patch: { audio: { volume: v } },
                            })),
                            `mix:${t.id}`,
                          );
                        }}
                        className="mt-2 w-full accent-accent"
                        aria-label={`Volume ${t.name}`}
                      />
                    )}
                  </div>
                );
              })}
            {!doc.timeline.tracks.some((t) => t.kind === "audio" && t.clips.length) && (
              <p className="text-xs text-muted-foreground">
                Ajoutez de l’audio depuis Multimédia sur A1 / A2.
              </p>
            )}
          </div>
        )}

        {tab === "text" && (
          <CatalogBrowser
            mode="text"
            doc={doc}
            time={time}
            selectedClipId={selectedClipId}
            apply={apply}
          />
        )}
        {tab === "stickers" && (
          <CatalogBrowser
            mode="stickers"
            doc={doc}
            time={time}
            selectedClipId={selectedClipId}
            apply={apply}
          />
        )}
        {tab === "effects" && (
          <CatalogBrowser
            mode="effects"
            doc={doc}
            time={time}
            selectedClipId={selectedClipId}
            apply={apply}
          />
        )}
        {tab === "transitions" && (
          <CatalogBrowser
            mode="transitions"
            doc={doc}
            time={time}
            selectedClipId={selectedClipId}
            apply={apply}
          />
        )}

        {tab === "captions" && (
          <div className="space-y-4">
            <ul className="space-y-1.5">
              {doc.timeline.tracks
                .find((t) => t.role === "captions")
                ?.clips.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => onSeek(c.start)}
                      className="w-full rounded bg-muted p-2 text-left text-xs hover:bg-raised"
                    >
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {shortTime(c.start)}
                      </span>
                      <span className="block">{c.label}</span>
                    </button>
                  </li>
                ))}
            </ul>
            {doc.transcript.segments.length > 0 && (
              <div className="border-t border-border pt-3 space-y-2">
                <p className="mb-2 font-mono text-[10px] uppercase text-muted-foreground">
                  Transcript
                </p>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="rounded bg-secondary px-2 py-1 text-[10px] uppercase hover:bg-raised"
                    onClick={() => {
                      const ops = opsForAutoCaptions(doc, { style: "block" });
                      if (!ops.length) {
                        toast.message("Aucun mot dans le transcript.");
                        return;
                      }
                      apply(ops);
                      toast.success("Sous-titres générés sur T1.");
                    }}
                  >
                    Auto captions
                  </button>
                  <button
                    type="button"
                    className="rounded bg-secondary px-2 py-1 text-[10px] uppercase hover:bg-raised"
                    onClick={() => {
                      const ops = opsForAutoCaptions(doc, { style: "karaoke" });
                      if (!ops.length) return;
                      apply(ops);
                      toast.success("Captions mot-à-mot sur T1.");
                    }}
                  >
                    Karaoke
                  </button>
                  <button
                    type="button"
                    className="rounded bg-secondary px-2 py-1 text-[10px] uppercase hover:bg-raised"
                    onClick={() => {
                      void (async () => {
                        const a2 = doc.timeline.tracks.find((t) => t.id === "a2");
                        if (!a2 || a2.locked) {
                          toast.error("Piste A2 verrouillée ou absente.");
                          return;
                        }
                        const text = doc.transcript.segments.map((s) => s.text).join(" ");
                        const res = await requestTtsClip({
                          projectId: doc.id,
                          text: text.slice(0, 800),
                          startSec: time,
                        });
                        if (!res.ok) {
                          toast.error(res.error);
                          return;
                        }
                        apply(res.ops);
                        toast.success("Voix off TTS placée sur A2.");
                      })();
                    }}
                  >
                    TTS → A2
                  </button>
                </div>
                <TranscriptPanel
                  doc={doc}
                  time={time}
                  fillerWords={config.transcript.fillerWords}
                  onRemove={removeSource}
                  onSeek={onSeek}
                />
              </div>
            )}
            {!doc.transcript.segments.length &&
              !doc.timeline.tracks.find((t) => t.role === "captions")?.clips.length && (
                <p className="text-xs text-muted-foreground">Aucune légende pour l’instant.</p>
              )}
          </div>
        )}

        {tab === "capture" && (
          <div className="space-y-4">
            <CaptureStudio doc={doc} time={time} apply={apply} />
            {isFlagOn("enable_multicam_mixer") && angleAssets.length > 0 && (
              <div className="space-y-3 border-t border-border pt-3">
                <p className="font-mono text-[10px] uppercase text-muted-foreground">
                  Multi-cam (projet démo)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {angleAssets.map((a, i) => {
                    const locked = i >= allowed;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        disabled={locked}
                        onClick={() =>
                          apply([{ type: "SWITCH_CAMERA_ANGLE", time, angleId: a.id }])
                        }
                        className={`${camClass(a)} ${activeAngle === a.id ? "tally" : ""} flex aspect-video flex-col justify-between rounded p-1.5 text-left font-mono text-[10px] disabled:opacity-30`}
                      >
                        <span className="rounded bg-background/60 px-1">{i + 1}</span>
                        <span className="truncate">{a.name}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={runAlignAngles}
                  className="w-full rounded-md border border-border px-3 py-2 text-xs hover:bg-secondary"
                >
                  Aligner les angles
                </button>
                <button
                  type="button"
                  onClick={runAutoCut}
                  className="w-full rounded-md bg-secondary px-3 py-2 text-xs hover:bg-raised"
                >
                  Auto-cut VAD
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
