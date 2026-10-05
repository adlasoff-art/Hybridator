import { useMemo } from "react";
import { Trash2 } from "lucide-react";
import { normalizeWord, sourceToTimeline, type EditorDoc, type SourceRange } from "@/engine";
import { shortTime } from "@/lib/timecode";

interface Props {
  doc: EditorDoc;
  time: number;
  fillerWords: string[];
  onRemove: (ranges: SourceRange[]) => void;
  onSeek: (t: number) => void;
}

export function TranscriptPanel({ doc, time, fillerWords, onRemove, onSeek }: Props) {
  const fillers = useMemo(() => new Set(fillerWords.map(normalizeWord)), [fillerWords]);
  const silenceByStart = useMemo(() => {
    const m = new Map<number, { start: number; end: number; duration: number }>();
    for (const s of doc.transcript.detections.silences) m.set(Math.round(s.start * 1000), s);
    return m;
  }, [doc.transcript]);

  return (
    <div className="space-y-4 text-sm leading-7">
      <div className="flex flex-wrap gap-2 font-mono text-[10px] uppercase">
        <span className="rounded bg-primary/20 px-1.5 text-primary">Hésitation</span>
        <span className="rounded bg-warning/20 px-1.5 text-warning">Silence</span>
        <span className="text-muted-foreground">
          Cliquez un mot pour y aller · ✕ pour supprimer
        </span>
      </div>
      {doc.transcript.segments.map((seg) => (
        <div key={seg.id}>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {seg.speaker} · {shortTime(seg.start)}
          </p>
          <p>
            {seg.words.map((w, i) => {
              const tl = sourceToTimeline((w.start + w.end) / 2, doc.removedRanges);
              const removed = tl === null;
              const start = sourceToTimeline(w.start, doc.removedRanges);
              const active =
                !removed && start !== null && time >= start && time < start + (w.end - w.start);
              const isFiller = fillers.has(normalizeWord(w.word));
              const silence = silenceByStart.get(Math.round(w.end * 1000));
              const silenceRemoved = silence
                ? sourceToTimeline((silence.start + silence.end) / 2, doc.removedRanges) === null
                : true;
              return (
                <span key={`${seg.id}-${i}`}>
                  <span
                    onClick={() => start !== null && onSeek(start)}
                    className={`group cursor-pointer rounded px-0.5 transition-colors ${
                      removed
                        ? "text-muted-foreground/50 line-through"
                        : active
                          ? "bg-foreground text-background"
                          : isFiller
                            ? "bg-primary/20 text-primary"
                            : "hover:bg-secondary"
                    }`}
                  >
                    {w.word}
                    {isFiller && !removed && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove([
                            { start: w.start, end: w.end, reason: `hésitation « ${w.word} »` },
                          ]);
                        }}
                        className="ml-0.5 text-[10px] opacity-70 hover:opacity-100"
                        aria-label={`Supprimer ${w.word}`}
                      >
                        ✕
                      </button>
                    )}
                  </span>{" "}
                  {silence && !silenceRemoved && (
                    <button
                      onClick={() =>
                        onRemove([{ start: silence.start, end: silence.end, reason: "silence" }])
                      }
                      className="mx-0.5 rounded bg-warning/20 px-1 font-mono text-[10px] text-warning hover:bg-warning/30"
                      title="Supprimer ce silence"
                    >
                      ⏸ {silence.duration.toFixed(1)}s ✕
                    </button>
                  )}
                </span>
              );
            })}
          </p>
        </div>
      ))}
      <button
        onClick={() => {
          const words = doc.transcript.segments.flatMap((s) => s.words);
          const ranges = words
            .filter((w) => fillers.has(normalizeWord(w.word)))
            .map((w) => ({ start: w.start, end: w.end, reason: "hésitation" }));
          onRemove(ranges);
        }}
        className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
      >
        <Trash2 className="h-3.5 w-3.5" /> Supprimer toutes les hésitations
      </button>
    </div>
  );
}
