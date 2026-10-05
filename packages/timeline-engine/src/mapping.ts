import type { Clip, EditorDoc, SourceRange, Track } from "@hybridator/core-model";

const EPS = 1e-6;

const sorted = (r: SourceRange[]) => [...r].sort((a, b) => a.start - b.start);

export function timelineToSource(t: number, removed: SourceRange[]): number {
  let x = t;
  for (const r of sorted(removed)) {
    if (r.start <= x + EPS) x += r.end - r.start;
    else break;
  }
  return x;
}

/** null si le point source a été supprimé */
export function sourceToTimeline(x: number, removed: SourceRange[]): number | null {
  let shift = 0;
  for (const r of sorted(removed)) {
    if (x >= r.start - EPS && x < r.end - EPS) return null;
    if (r.end <= x + EPS) shift += r.end - r.start;
  }
  return x - shift;
}

export function isSourceRemoved(x: number, removed: SourceRange[]): boolean {
  return sourceToTimeline(x, removed) === null;
}

export const clipEnd = (c: Clip): number => c.start + c.duration;

/** Piste de référence pour convertir durée source → durée timeline (vitesses). */
export function referenceTrack(doc: EditorDoc): Track | undefined {
  return (
    doc.timeline.tracks.find((t) => t.role === "main") ??
    doc.timeline.tracks.find((t) => t.kind === "video") ??
    doc.timeline.tracks.find((t) => t.kind === "audio") ??
    doc.timeline.tracks[0]
  );
}

/**
 * Durée timeline correspondant à une plage source continue, en tenant compte
 * de la vitesse des clips sur la piste de référence.
 */
export function sourceSpanTimelineDuration(
  doc: EditorDoc,
  sourceStart: number,
  sourceEnd: number,
): number {
  if (sourceEnd - sourceStart <= EPS) return 0;
  const track = referenceTrack(doc);
  if (!track || track.clips.length === 0) return sourceEnd - sourceStart;

  let remaining = sourceEnd - sourceStart;
  let src = sourceStart;
  let tlDur = 0;

  while (remaining > EPS) {
    const clip = track.clips.find((c) => src >= c.sourceIn - EPS && src < c.sourceOut - EPS);
    if (!clip) {
      // Hors clip : hypothèse 1:1 pour la portion restante
      tlDur += remaining;
      break;
    }
    const speed = clip.speed > 0 ? clip.speed : 1;
    const takeSrc = Math.min(clip.sourceOut - src, remaining);
    tlDur += takeSrc / speed;
    src += takeSrc;
    remaining -= takeSrc;
  }
  return tlDur;
}

/**
 * Convertit une plage source (transcript) en plage timeline pour REMOVE_RANGE,
 * en tenant compte des suppressions déjà appliquées et des vitesses de clips.
 */
export function sourceSpanToTimelineRange(
  doc: EditorDoc,
  sourceStart: number,
  sourceEnd: number,
): { start: number; end: number } | null {
  const startTl = sourceToTimeline(sourceStart, doc.removedRanges);
  if (startTl === null) return null;
  // Avancer jusqu'au premier point source encore présent si le début est dans un trou
  const s = sourceStart;
  const e = sourceEnd;
  if (e - s <= EPS) return null;

  // Portion encore visible : ignorer les sous-plages déjà removed
  const visible: { start: number; end: number }[] = [];
  let cursor = s;
  const holes = sorted(doc.removedRanges).filter((r) => r.end > s + EPS && r.start < e - EPS);
  for (const h of holes) {
    if (cursor < h.start - EPS) visible.push({ start: cursor, end: Math.min(h.start, e) });
    cursor = Math.max(cursor, h.end);
  }
  if (cursor < e - EPS) visible.push({ start: cursor, end: e });
  if (visible.length === 0) return null;

  const first = visible[0]!;
  const tl0 = sourceToTimeline(first.start, doc.removedRanges);
  if (tl0 === null) return null;

  let tlLen = 0;
  for (const v of visible) tlLen += sourceSpanTimelineDuration(doc, v.start, v.end);
  return { start: tl0, end: tl0 + tlLen };
}

export function timelineRangeToSource(
  s: number,
  e: number,
  removed: SourceRange[],
  reason: string,
): SourceRange[] {
  const res: SourceRange[] = [];
  const list = sorted(removed);
  let cur = timelineToSource(s, removed);
  let remaining = e - s;
  while (remaining > EPS) {
    const next = list.find((r) => r.start > cur + EPS);
    const take = Math.min(next ? next.start - cur : Infinity, remaining);
    res.push({ start: cur, end: cur + take, reason });
    remaining -= take;
    cur = next ? next.end : cur + take;
  }
  return res;
}

export function mergeRanges(ranges: SourceRange[]): SourceRange[] {
  const out: SourceRange[] = [];
  for (const r of sorted(ranges)) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end + EPS) {
      out[out.length - 1] = { ...last, end: Math.max(last.end, r.end) };
    } else out.push({ ...r });
  }
  return out;
}
