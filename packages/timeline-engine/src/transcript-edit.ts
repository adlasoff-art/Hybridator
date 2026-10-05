import type { NormalizedTranscript, SourceRange, TranscriptWord } from "@hybridator/core-model";

/**
 * Référence d'un caractère dans le transcript (pour sélection libre).
 * L'interpolation temporelle est linéaire dans la durée du mot — chaque
 * caractère / syllabe sélectionné(e) produit la plage source correspondante.
 */
export interface TranscriptCharRef {
  segmentId: string;
  wordIndex: number;
  /** Index UTF-16 dans `word.word` (0 .. length) */
  charIndex: number;
}

export interface ResolvedWord {
  segmentId: string;
  wordIndex: number;
  word: TranscriptWord;
}

function findWord(
  transcript: NormalizedTranscript,
  segmentId: string,
  wordIndex: number,
): ResolvedWord | null {
  const seg = transcript.segments.find((s) => s.id === segmentId);
  const word = seg?.words[wordIndex];
  if (!seg || !word) return null;
  return { segmentId, wordIndex, word };
}

/** Plage source pour une sous-chaîne [fromChar, toChar) d'un mot. */
export function sourceRangeWithinWord(
  word: TranscriptWord,
  fromChar: number,
  toChar: number,
  reason?: string,
): SourceRange {
  const len = Math.max([...word.word].length, 1);
  // Utiliser les code points pour éviter de couper les paires UTF-16
  const chars = [...word.word];
  const from = Math.max(0, Math.min(fromChar, chars.length));
  const to = Math.max(from, Math.min(toChar, chars.length));
  const dur = Math.max(word.end - word.start, 0);
  const start = word.start + (from / len) * dur;
  const end = word.start + (to / len) * dur;
  const label = chars.slice(from, to).join("") || word.word;
  return {
    start,
    end: Math.max(end, start + 1e-4),
    reason: reason ?? `texte « ${label} »`,
  };
}

/** Plage source d'un mot entier. */
export function sourceRangeForWord(word: TranscriptWord, reason?: string): SourceRange {
  return {
    start: word.start,
    end: word.end,
    reason: reason ?? `mot « ${word.word} »`,
  };
}

/**
 * Plage source couvrant une sélection libre (du premier caractère au dernier inclus).
 * Peut s'étendre sur plusieurs mots / segments.
 */
export function sourceRangeFromCharSpan(
  transcript: NormalizedTranscript,
  from: TranscriptCharRef,
  to: TranscriptCharRef,
  reason?: string,
): SourceRange | null {
  const a = findWord(transcript, from.segmentId, from.wordIndex);
  const b = findWord(transcript, to.segmentId, to.wordIndex);
  if (!a || !b) return null;

  const aChars = [...a.word.word];
  const bChars = [...b.word.word];

  // Normaliser l'ordre chronologique
  const aMid = (a.word.start + a.word.end) / 2;
  const bMid = (b.word.start + b.word.end) / 2;
  const ordered =
    aMid < bMid ||
    (a.segmentId === b.segmentId &&
      (a.wordIndex < b.wordIndex ||
        (a.wordIndex === b.wordIndex && from.charIndex <= to.charIndex)))
      ? { start: a, end: b, startChar: from.charIndex, endChar: to.charIndex }
      : { start: b, end: a, startChar: to.charIndex, endChar: from.charIndex };

  if (
    ordered.start.segmentId === ordered.end.segmentId &&
    ordered.start.wordIndex === ordered.end.wordIndex
  ) {
    const endExclusive = Math.min(ordered.endChar + 1, [...ordered.start.word.word].length);
    return sourceRangeWithinWord(
      ordered.start.word,
      ordered.startChar,
      Math.max(ordered.startChar + 1, endExclusive),
      reason,
    );
  }

  const startRange = sourceRangeWithinWord(
    ordered.start.word,
    ordered.startChar,
    [...ordered.start.word.word].length,
  );
  const endRange = sourceRangeWithinWord(ordered.end.word, 0, ordered.endChar + 1);
  const label = `${aChars.slice(0, 8).join("")}…${bChars.slice(-8).join("")}`;
  return {
    start: startRange.start,
    end: endRange.end,
    reason: reason ?? `texte « ${label} »`,
  };
}

/** Flatten des mots avec indices — utile aux tests et à l'UI. */
export function flattenTranscriptWords(transcript: NormalizedTranscript): ResolvedWord[] {
  const out: ResolvedWord[] = [];
  for (const seg of transcript.segments) {
    seg.words.forEach((word, wordIndex) => {
      out.push({ segmentId: seg.id, wordIndex, word });
    });
  }
  return out;
}
