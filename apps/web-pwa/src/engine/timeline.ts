import {
  ALL_TRACKS,
  type Clip,
  type EditOperation,
  type EditorDoc,
  type SourceRange,
  type Timeline,
  type Track,
} from "./types";

const EPS = 1e-6;

export const clipEnd = (c: Clip): number => c.start + c.duration;

export function timelineDuration(t: Timeline): number {
  let max = 0;
  for (const tr of t.tracks) for (const c of tr.clips) max = Math.max(max, clipEnd(c));
  return max;
}

export function findClip(t: Timeline, clipId: string): Clip | undefined {
  for (const tr of t.tracks) {
    const c = tr.clips.find((x) => x.id === clipId);
    if (c) return c;
  }
  return undefined;
}

export function clipAt(track: Track, time: number): Clip | undefined {
  return track.clips.find((c) => time >= c.start - EPS && time < clipEnd(c) - EPS);
}

function sliceClip(c: Clip, from: number, to: number, id: string): Clip {
  return {
    ...c,
    id,
    start: from,
    duration: to - from,
    sourceIn: c.sourceIn + (from - c.start) * c.speed,
    sourceOut: c.sourceIn + (to - c.start) * c.speed,
  };
}

function removeRangeFromTrack(track: Track, s: number, e: number): Track {
  const len = e - s;
  const out: Clip[] = [];
  for (const c of track.clips) {
    const cs = c.start;
    const ce = clipEnd(c);
    if (ce <= s + EPS) out.push(c);
    else if (cs >= e - EPS) out.push({ ...c, start: cs - len });
    else {
      if (cs < s - EPS) out.push(sliceClip(c, cs, s, c.id));
      if (ce > e + EPS) {
        const right = sliceClip(c, e, ce, `${c.id}.${Math.round(e * 1000)}`);
        out.push({ ...right, start: s });
      }
    }
  }
  return { ...track, clips: out };
}

function splitInTrack(track: Track, clipId: string, position: number): Track {
  const clips: Clip[] = [];
  for (const c of track.clips) {
    if (c.id === clipId && position > c.start + EPS && position < clipEnd(c) - EPS) {
      clips.push(sliceClip(c, c.start, position, c.id));
      clips.push(sliceClip(c, position, clipEnd(c), `${c.id}.${Math.round(position * 1000)}`));
    } else clips.push(c);
  }
  return { ...track, clips };
}

/* ---------- Correspondance temps source <-> timeline ---------- */

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

function timelineRangeToSource(
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

function mergeRanges(ranges: SourceRange[]): SourceRange[] {
  const out: SourceRange[] = [];
  for (const r of sorted(ranges)) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end + EPS) {
      out[out.length - 1] = { ...last, end: Math.max(last.end, r.end) };
    } else out.push({ ...r });
  }
  return out;
}

/* ---------- Application des opérations (pure, immuable) ---------- */

export function applyOperation(doc: EditorDoc, op: EditOperation): EditorDoc {
  const t = doc.timeline;
  let tracks = t.tracks;
  let removedRanges = doc.removedRanges;

  switch (op.type) {
    case "REMOVE_RANGE": {
      if (op.end - op.start <= EPS) return doc;
      tracks = tracks.map((tr) =>
        op.trackId === ALL_TRACKS || tr.id === op.trackId
          ? removeRangeFromTrack(tr, op.start, op.end)
          : tr,
      );
      if (op.trackId === ALL_TRACKS) {
        removedRanges = mergeRanges([
          ...removedRanges,
          ...timelineRangeToSource(op.start, op.end, removedRanges, op.reason),
        ]);
      }
      break;
    }
    case "SPLIT_CLIP":
      tracks = tracks.map((tr) => splitInTrack(tr, op.clipId, op.position));
      break;
    case "CHANGE_SPEED": {
      if (op.speed <= 0) return doc;
      tracks = tracks.map((tr) => ({
        ...tr,
        clips: tr.clips.map((c) =>
          c.id === op.clipId
            ? { ...c, speed: op.speed, duration: (c.sourceOut - c.sourceIn) / op.speed }
            : c,
        ),
      }));
      break;
    }
    case "SWITCH_CAMERA_ANGLE": {
      tracks = tracks.map((tr) => {
        if (tr.role !== "angles") return tr;
        const c = clipAt(tr, op.time);
        if (!c) return tr;
        const split = splitInTrack(tr, c.id, op.time);
        const target = clipAt(split, op.time);
        return {
          ...split,
          clips: split.clips.map((x) => (x.id === target?.id ? { ...x, assetId: op.angleId } : x)),
        };
      });
      break;
    }
    case "UPDATE_CLIP":
      tracks = tracks.map((tr) => ({
        ...tr,
        clips: tr.clips.map((c) =>
          c.id === op.clipId
            ? {
                ...c,
                transform: { ...c.transform, ...op.patch.transform },
                audio: { ...c.audio, ...op.patch.audio },
                enabled: op.patch.enabled ?? c.enabled,
                label: op.patch.label ?? c.label,
              }
            : c,
        ),
      }));
      break;
    case "SET_TRACK":
      tracks = tracks.map((tr) =>
        tr.id === op.trackId
          ? { ...tr, muted: op.patch.muted ?? tr.muted, locked: op.patch.locked ?? tr.locked }
          : tr,
      );
      break;
  }

  return {
    ...doc,
    timeline: { ...t, tracks },
    removedRanges,
    operations: [...doc.operations, op],
  };
}

/**
 * Text-to-edit : convertit des plages source (mots, silences) en REMOVE_RANGE.
 * Les plages sont traitées de la fin vers le début pour que chaque calcul reste exact.
 */
export function opsForSourceRanges(doc: EditorDoc, ranges: SourceRange[]): EditOperation[] {
  const ops: EditOperation[] = [];
  for (const r of [...ranges].sort((a, b) => b.start - a.start)) {
    const ts = sourceToTimeline(r.start, doc.removedRanges);
    if (ts === null) continue;
    ops.push({
      type: "REMOVE_RANGE",
      trackId: ALL_TRACKS,
      start: ts,
      end: ts + (r.end - r.start),
      reason: r.reason,
    });
  }
  return ops;
}

export function applyOperations(doc: EditorDoc, ops: EditOperation[]): EditorDoc {
  return ops.reduce(applyOperation, doc);
}

export function isSourceRemoved(x: number, removed: SourceRange[]): boolean {
  return sourceToTimeline(x, removed) === null;
}
