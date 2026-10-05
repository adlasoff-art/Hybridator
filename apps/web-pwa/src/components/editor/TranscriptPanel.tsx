import { useCallback, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  normalizeWord,
  sourceRangeForWord,
  sourceRangeFromCharSpan,
  sourceToTimeline,
  type EditorDoc,
  type SourceRange,
  type TranscriptCharRef,
} from "@/engine";
import { shortTime } from "@/lib/timecode";

interface Props {
  doc: EditorDoc;
  time: number;
  fillerWords: string[];
  onRemove: (ranges: SourceRange[]) => void;
  onSeek: (t: number) => void;
}

function readCharRef(node: Node | null): TranscriptCharRef | null {
  const el =
    node instanceof HTMLElement
      ? node.closest("[data-seg][data-word][data-char]")
      : node?.parentElement?.closest("[data-seg][data-word][data-char]");
  if (!(el instanceof HTMLElement)) return null;
  const segmentId = el.dataset["seg"];
  const wordIndex = Number(el.dataset["word"]);
  const charIndex = Number(el.dataset["char"]);
  if (!segmentId || Number.isNaN(wordIndex) || Number.isNaN(charIndex)) return null;
  return { segmentId, wordIndex, charIndex };
}

export function TranscriptPanel({ doc, time, fillerWords, onRemove, onSeek }: Props) {
  const fillers = useMemo(() => new Set(fillerWords.map(normalizeWord)), [fillerWords]);
  const silenceByStart = useMemo(() => {
    const m = new Map<number, { start: number; end: number; duration: number }>();
    for (const s of doc.transcript.detections.silences) m.set(Math.round(s.start * 1000), s);
    return m;
  }, [doc.transcript]);

  const [selectionRange, setSelectionRange] = useState<SourceRange | null>(null);

  const captureSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setSelectionRange(null);
      return;
    }
    const from = readCharRef(sel.getRangeAt(0).startContainer);
    const to = readCharRef(sel.getRangeAt(0).endContainer);
    if (!from || !to) {
      setSelectionRange(null);
      return;
    }
    // Si la sélection se termine sur un nœud texte après le dernier caractère,
    // endContainer peut être le parent ; readCharRef gère closest.
    const range = sourceRangeFromCharSpan(doc.transcript, from, to);
    setSelectionRange(range);
  }, [doc.transcript]);

  return (
    <div className="space-y-4 text-sm leading-7" onMouseUp={captureSelection}>
      <div className="flex flex-wrap gap-2 font-mono text-[10px] uppercase">
        <span className="rounded bg-primary/20 px-1.5 text-primary">Hésitation</span>
        <span className="rounded bg-warning/20 px-1.5 text-warning">Silence</span>
        <span className="text-muted-foreground">
          Sélectionnez un texte (mot, syllabe, caractère) ou ✕ pour supprimer · timeline
          synchronisée
        </span>
      </div>

      {selectionRange && (
        <div className="flex items-center justify-between gap-2 rounded border border-border bg-secondary/60 px-2 py-1.5">
          <span className="truncate text-xs text-muted-foreground">{selectionRange.reason}</span>
          <button
            type="button"
            onClick={() => {
              onRemove([selectionRange]);
              setSelectionRange(null);
              window.getSelection()?.removeAllRanges();
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground hover:opacity-90"
          >
            <Trash2 className="h-3 w-3" /> Supprimer la sélection
          </button>
        </div>
      )}

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
              const chars = [...w.word];
              return (
                <span key={`${seg.id}-${i}`}>
                  <span
                    onClick={() => start !== null && onSeek(start)}
                    className={`group inline cursor-pointer rounded px-0.5 transition-colors ${
                      removed
                        ? "text-muted-foreground/50 line-through"
                        : active
                          ? "bg-foreground text-background"
                          : isFiller
                            ? "bg-primary/20 text-primary"
                            : "hover:bg-secondary"
                    }`}
                  >
                    {chars.map((ch, ci) => (
                      <span
                        key={`${seg.id}-${i}-${ci}`}
                        data-seg={seg.id}
                        data-word={i}
                        data-char={ci}
                      >
                        {ch}
                      </span>
                    ))}
                    {!removed && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove([sourceRangeForWord(w)]);
                        }}
                        className="ml-0.5 text-[10px] opacity-0 transition-opacity group-hover:opacity-70 hover:!opacity-100"
                        aria-label={`Supprimer ${w.word}`}
                        title="Supprimer ce mot de la timeline"
                      >
                        ✕
                      </button>
                    )}
                  </span>{" "}
                  {silence && !silenceRemoved && (
                    <button
                      type="button"
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
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            const words = doc.transcript.segments.flatMap((s) => s.words);
            const ranges = words
              .filter((w) => fillers.has(normalizeWord(w.word)))
              .map((w) => sourceRangeForWord(w, "hésitation"));
            onRemove(ranges);
          }}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
        >
          <Trash2 className="h-3.5 w-3.5" /> Supprimer toutes les hésitations
        </button>
      </div>
    </div>
  );
}
