import {
  ALL_TRACKS,
  type Clip,
  type EditOperation,
  type EditorDoc,
  type SourceRange,
  type Timeline,
  type Track,
} from "@hybridator/core-model";
import {
  clipEnd,
  mergeRanges,
  sourceSpanToTimelineRange,
  sourceToTimeline,
  timelineRangeToSource,
} from "./mapping";

const EPS = 1e-6;

export { clipEnd } from "./mapping";

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

function trackOfClip(tracks: Track[], clipId: string): Track | undefined {
  return tracks.find((tr) => tr.clips.some((c) => c.id === clipId));
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
      if (trackOfClip(tracks, op.clipId)?.locked) return doc;
      tracks = tracks.map((tr) => splitInTrack(tr, op.clipId, op.position));
      break;
    case "CHANGE_SPEED": {
      if (op.speed <= 0) return doc;
      if (trackOfClip(tracks, op.clipId)?.locked) return doc;
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
    case "UPDATE_CLIP": {
      if (trackOfClip(tracks, op.clipId)?.locked) return doc;
      tracks = tracks.map((tr) => ({
        ...tr,
        clips: tr.clips.map((c) => {
          if (c.id !== op.clipId) return c;
          const next = {
            ...c,
            transform: { ...c.transform, ...op.patch.transform },
            audio: { ...c.audio, ...op.patch.audio },
            enabled: op.patch.enabled ?? c.enabled,
            label: op.patch.label ?? c.label,
            effects: op.patch.effects ?? c.effects,
          };
          if (op.patch.transition === null) {
            const { transition: _t, ...rest } = next;
            void _t;
            return rest;
          }
          if (op.patch.transition !== undefined) {
            return { ...next, transition: op.patch.transition };
          }
          return next;
        }),
      }));
      break;
    }
    case "SET_TRACK":
      tracks = tracks.map((tr) =>
        tr.id === op.trackId
          ? { ...tr, muted: op.patch.muted ?? tr.muted, locked: op.patch.locked ?? tr.locked }
          : tr,
      );
      break;
    case "MOVE_CLIP": {
      if (op.start < -EPS) return doc;
      if (trackOfClip(tracks, op.clipId)?.locked) return doc;
      tracks = tracks.map((tr) => ({
        ...tr,
        clips: tr.clips.map((c) =>
          c.id === op.clipId ? { ...c, start: Math.max(0, op.start) } : c,
        ),
      }));
      break;
    }
    case "RESIZE_CLIP": {
      if (op.duration <= EPS || op.sourceOut <= op.sourceIn + EPS) return doc;
      if (trackOfClip(tracks, op.clipId)?.locked) return doc;
      tracks = tracks.map((tr) => ({
        ...tr,
        clips: tr.clips.map((c) =>
          c.id === op.clipId
            ? {
                ...c,
                start: Math.max(0, op.start),
                duration: op.duration,
                sourceIn: op.sourceIn,
                sourceOut: op.sourceOut,
              }
            : c,
        ),
      }));
      break;
    }
    case "ADD_ASSET": {
      if (doc.assets.some((a) => a.id === op.asset.id)) return doc;
      return {
        ...doc,
        assets: [...doc.assets, op.asset],
        operations: [...doc.operations, op],
      };
    }
    case "REMOVE_ASSET": {
      const referenced = tracks.some((tr) => tr.clips.some((c) => c.assetId === op.assetId));
      if (referenced) return doc;
      return {
        ...doc,
        assets: doc.assets.filter((a) => a.id !== op.assetId),
        operations: [...doc.operations, op],
      };
    }
    case "ADD_CLIP": {
      const track = tracks.find((tr) => tr.id === op.clip.trackId);
      if (!track || track.locked) return doc;
      if (findClip(t, op.clip.id)) return doc;
      if (op.clip.duration <= EPS) return doc;
      tracks = tracks.map((tr) =>
        tr.id === op.clip.trackId ? { ...tr, clips: [...tr.clips, op.clip] } : tr,
      );
      break;
    }
    case "DELETE_CLIP": {
      const victim = findClip(t, op.clipId);
      if (!victim) return doc;
      if (trackOfClip(tracks, op.clipId)?.locked) return doc;
      const end = clipEnd(victim);
      tracks = tracks.map((tr) => {
        if (tr.id !== victim.trackId) {
          return { ...tr, clips: tr.clips.filter((c) => c.id !== op.clipId) };
        }
        const remaining = tr.clips.filter((c) => c.id !== op.clipId);
        if (!op.ripple) return { ...tr, clips: remaining };
        const shifted = remaining.map((c) =>
          c.start >= end - EPS ? { ...c, start: Math.max(0, c.start - victim.duration) } : c,
        );
        return { ...tr, clips: shifted };
      });
      break;
    }
    case "ADD_TRACK": {
      if (tracks.some((tr) => tr.id === op.track.id)) return doc;
      tracks = [...tracks, op.track];
      break;
    }
    case "ADD_EFFECT": {
      const clip = findClip(t, op.clipId);
      if (!clip || trackOfClip(tracks, op.clipId)?.locked) return doc;
      if (clip.effects.some((e) => e.id === op.effect.id)) return doc;
      tracks = tracks.map((tr) => ({
        ...tr,
        clips: tr.clips.map((c) =>
          c.id === op.clipId ? { ...c, effects: [...c.effects, op.effect] } : c,
        ),
      }));
      break;
    }
    case "REMOVE_EFFECT": {
      const clip = findClip(t, op.clipId);
      if (!clip || trackOfClip(tracks, op.clipId)?.locked) return doc;
      if (!clip.effects.some((e) => e.id === op.effectId)) return doc;
      tracks = tracks.map((tr) => ({
        ...tr,
        clips: tr.clips.map((c) =>
          c.id === op.clipId ? { ...c, effects: c.effects.filter((e) => e.id !== op.effectId) } : c,
        ),
      }));
      break;
    }
    case "SET_TRANSITION": {
      const clip = findClip(t, op.clipId);
      if (!clip || trackOfClip(tracks, op.clipId)?.locked) return doc;
      tracks = tracks.map((tr) => ({
        ...tr,
        clips: tr.clips.map((c) => {
          if (c.id !== op.clipId) return c;
          if (op.transition === null) {
            const { transition: _t, ...rest } = c;
            void _t;
            return rest;
          }
          return { ...c, transition: op.transition };
        }),
      }));
      break;
    }
  }

  return {
    ...doc,
    timeline: { ...t, tracks },
    removedRanges,
    operations: [...doc.operations, op],
  };
}

/**
 * Text-to-edit : convertit des plages source (mots, silences, caractères) en REMOVE_RANGE.
 * Les plages sont triées de la fin vers le début pour que chaque calcul reste exact
 * à l'application successive. Les durées timeline tiennent compte des vitesses de clips.
 */
export function opsForSourceRanges(doc: EditorDoc, ranges: SourceRange[]): EditOperation[] {
  const ops: EditOperation[] = [];
  for (const r of [...ranges].sort((a, b) => b.start - a.start)) {
    const span = sourceSpanToTimelineRange(doc, r.start, r.end);
    if (!span || span.end - span.start <= EPS) continue;
    ops.push({
      type: "REMOVE_RANGE",
      trackId: ALL_TRACKS,
      start: span.start,
      end: span.end,
      reason: r.reason,
    });
  }
  return ops;
}

export function applyOperations(doc: EditorDoc, ops: EditOperation[]): EditorDoc {
  return ops.reduce(applyOperation, doc);
}

export { sourceToTimeline } from "./mapping";
