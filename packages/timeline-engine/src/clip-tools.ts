import {
  DEFAULT_CLIP_CROP,
  type Clip,
  type EditOperation,
  type EditorDoc,
  type Keyframe,
  type KeyframeTrack,
} from "@hybridator/core-model";
import { findClip } from "./timeline";

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Duplique un clip juste après l'original (même piste). */
export function opsForDuplicateClip(doc: EditorDoc, clipId: string): EditOperation[] {
  const clip = findClip(doc.timeline, clipId);
  if (!clip) return [];
  const track = doc.timeline.tracks.find((t) => t.id === clip.trackId);
  if (!track || track.locked) return [];
  const copy: Clip = {
    ...clip,
    id: newId("clip"),
    start: clip.start + clip.duration,
    effects: clip.effects.map((e) => ({ ...e, id: newId("fx"), params: { ...e.params } })),
    keyframes: clip.keyframes?.map((tr) => ({
      ...tr,
      keys: tr.keys.map((k) => ({ ...k, id: newId("kf") })),
    })),
    ...(clip.crop ? { crop: { ...clip.crop } } : {}),
    ...(clip.mask ? { mask: { ...clip.mask } } : {}),
    ...(clip.colorGrade ? { colorGrade: { ...clip.colorGrade } } : {}),
    ...(clip.transition ? { transition: { ...clip.transition } } : {}),
    audio: { ...clip.audio },
    transform: { ...clip.transform },
  };
  return [{ type: "ADD_CLIP", clip: copy }];
}

/** Colle un clip (sérialisé) sur une piste à `start`. */
export function opsForPasteClip(
  doc: EditorDoc,
  clip: Clip,
  start: number,
  trackId?: string,
): EditOperation[] {
  const targetId = trackId ?? clip.trackId;
  const track = doc.timeline.tracks.find((t) => t.id === targetId);
  if (!track || track.locked) return [];
  const pasted: Clip = {
    ...clip,
    id: newId("clip"),
    trackId: targetId,
    start: Math.max(0, start),
    effects: clip.effects.map((e) => ({ ...e, id: newId("fx"), params: { ...e.params } })),
    keyframes: clip.keyframes?.map((tr) => ({
      ...tr,
      keys: tr.keys.map((k) => ({ ...k, id: newId("kf") })),
    })),
    audio: { ...clip.audio },
    transform: { ...clip.transform },
  };
  return [{ type: "ADD_CLIP", clip: pasted }];
}

export function cloneClipForClipboard(clip: Clip): Clip {
  return JSON.parse(JSON.stringify(clip)) as Clip;
}

/** Ajoute ou met à jour une keyframe sur une propriété. */
export function upsertKeyframeTracks(
  existing: KeyframeTrack[] | undefined,
  property: KeyframeTrack["property"],
  timeSec: number,
  value: number,
): KeyframeTrack[] {
  const tracks = existing ? existing.map((t) => ({ ...t, keys: [...t.keys] })) : [];
  let track = tracks.find((t) => t.property === property);
  if (!track) {
    track = { property, keys: [] };
    tracks.push(track);
  }
  const eps = 1e-3;
  const idx = track.keys.findIndex((k) => Math.abs(k.timeSec - timeSec) < eps);
  const key: Keyframe = { id: newId("kf"), timeSec: Math.max(0, timeSec), value };
  if (idx >= 0) track.keys[idx] = key;
  else {
    track.keys.push(key);
    track.keys.sort((a, b) => a.timeSec - b.timeSec);
  }
  return tracks;
}

export function removeKeyframeAt(
  existing: KeyframeTrack[] | undefined,
  property: KeyframeTrack["property"],
  timeSec: number,
): KeyframeTrack[] {
  if (!existing) return [];
  const eps = 1e-3;
  return existing
    .map((t) =>
      t.property === property
        ? { ...t, keys: t.keys.filter((k) => Math.abs(k.timeSec - timeSec) >= eps) }
        : t,
    )
    .filter((t) => t.keys.length > 0);
}

export function normalizeCrop(
  patch: Partial<{ top: number; right: number; bottom: number; left: number }> | null | undefined,
  current?: { top: number; right: number; bottom: number; left: number },
): { top: number; right: number; bottom: number; left: number } | null {
  if (patch === null || patch === undefined) return null;
  const base = current ?? DEFAULT_CLIP_CROP;
  const next = {
    top: clamp01(patch.top ?? base.top),
    right: clamp01(patch.right ?? base.right),
    bottom: clamp01(patch.bottom ?? base.bottom),
    left: clamp01(patch.left ?? base.left),
  };
  if (next.top + next.bottom >= 0.95 || next.left + next.right >= 0.95) {
    return { ...base };
  }
  return next;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(0.49, n));
}

/** Bascule reverse CapCut sur le clip. */
export function opsForReverseClip(doc: EditorDoc, clipId: string): EditOperation[] {
  const clip = findClip(doc.timeline, clipId);
  if (!clip) return [];
  const track = doc.timeline.tracks.find((t) => t.id === clip.trackId);
  if (!track || track.locked) return [];
  return [{ type: "UPDATE_CLIP", clipId, patch: { reversed: !clip.reversed } }];
}

/**
 * Insère un freeze frame à `position` (temps timeline) : coupe le clip,
 * pose un arrêt `holdSec`, puis reprend le reste.
 */
export function opsForFreezeFrame(
  doc: EditorDoc,
  clipId: string,
  position: number,
  holdSec = 2,
): EditOperation[] {
  const clip = findClip(doc.timeline, clipId);
  if (!clip) return [];
  const track = doc.timeline.tracks.find((t) => t.id === clip.trackId);
  if (!track || track.locked) return [];
  const hold = Math.max(0.2, holdSec);
  if (position <= clip.start + 0.05 || position >= clip.start + clip.duration - 0.05) return [];

  const local = position - clip.start;
  const sourceAt = clip.reversed
    ? clip.sourceOut - local * clip.speed
    : clip.sourceIn + local * clip.speed;
  const leftDur = local;
  const frameSpan = 1 / 30;
  const leftSourceIn = clip.reversed ? Math.min(sourceAt, clip.sourceOut) : clip.sourceIn;
  const leftSourceOut = clip.reversed ? clip.sourceOut : sourceAt;
  const rightSourceIn = clip.reversed ? clip.sourceIn : sourceAt;
  const rightSourceOut = clip.reversed ? Math.max(clip.sourceIn, sourceAt) : clip.sourceOut;
  const rightSpan = Math.abs(rightSourceOut - rightSourceIn);
  const rightDur = rightSpan / Math.max(0.01, clip.speed);

  const freeze: Clip = {
    ...clip,
    id: newId("clip"),
    start: position,
    duration: hold,
    sourceIn: Math.max(0, sourceAt),
    sourceOut: Math.max(0, sourceAt) + frameSpan,
    speed: frameSpan / hold,
    label: `${clip.label ?? "Clip"} (freeze)`,
    effects: clip.effects.map((e) => ({ ...e, id: newId("fx"), params: { ...e.params } })),
    audio: { ...clip.audio, muted: true },
    transform: { ...clip.transform },
    reversed: false,
  };

  const right: Clip = {
    ...clip,
    id: newId("clip"),
    start: position + hold,
    duration: Math.max(0.05, rightDur),
    sourceIn: Math.min(rightSourceIn, rightSourceOut),
    sourceOut: Math.max(rightSourceIn, rightSourceOut),
    effects: clip.effects.map((e) => ({ ...e, id: newId("fx"), params: { ...e.params } })),
    audio: { ...clip.audio },
    transform: { ...clip.transform },
  };

  return [
    {
      type: "RESIZE_CLIP",
      clipId: clip.id,
      start: clip.start,
      duration: leftDur,
      sourceIn: Math.min(leftSourceIn, leftSourceOut),
      sourceOut: Math.max(leftSourceIn, leftSourceOut),
    },
    { type: "ADD_CLIP", clip: freeze },
    ...(rightDur > 0.05 ? [{ type: "ADD_CLIP" as const, clip: right }] : []),
  ];
}
