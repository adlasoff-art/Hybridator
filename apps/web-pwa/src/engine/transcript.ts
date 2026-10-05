import type { NormalizedTranscript, TranscriptSegment } from "./types";

export const normalizeWord = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");

/** Calcule détections et métriques à partir des segments (règles fournies par la config). */
export function analyzeTranscript(
  base: { language: string; segments: TranscriptSegment[] },
  rules: { fillerWords: string[]; silenceThresholdSec: number },
): NormalizedTranscript {
  const fillerSet = new Set(rules.fillerWords.map(normalizeWord));
  const words = base.segments.flatMap((s) => s.words);
  const silences: NormalizedTranscript["detections"]["silences"] = [];
  const fillers: NormalizedTranscript["detections"]["fillers"] = [];
  const repetitions: NormalizedTranscript["detections"]["repetitions"] = [];
  const tics = new Map<string, { start: number; end: number }[]>();

  words.forEach((w, i) => {
    const prev = words[i - 1];
    if (prev) {
      const gap = w.start - prev.end;
      if (gap >= rules.silenceThresholdSec)
        silences.push({ start: prev.end, end: w.start, duration: gap });
      if (normalizeWord(prev.word) === normalizeWord(w.word) && normalizeWord(w.word)) {
        repetitions.push({
          phrase: w.word,
          occurrences: [
            { start: prev.start, end: prev.end },
            { start: w.start, end: w.end },
          ],
        });
      }
    }
    const n = normalizeWord(w.word);
    if (fillerSet.has(n)) {
      fillers.push({ word: w.word, start: w.start, end: w.end });
      tics.set(n, [...(tics.get(n) ?? []), { start: w.start, end: w.end }]);
    }
  });

  const duration = words.length ? (words[words.length - 1]?.end ?? 0) : 0;
  const saved =
    silences.reduce((a, s) => a + s.duration, 0) +
    fillers.reduce((a, f) => a + (f.end - f.start), 0);

  return {
    language: base.language,
    duration,
    segments: base.segments,
    detections: {
      silences,
      fillers,
      repetitions,
      speechTics: [...tics.entries()].map(([word, ts]) => ({
        word,
        count: ts.length,
        timestamps: ts,
      })),
    },
    metrics: { totalPotentiallySavedTime: saved },
  };
}
