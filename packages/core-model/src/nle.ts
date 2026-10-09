/**
 * Factories NLE CapCut-like — TypeScript pur.
 */

import type { Clip, ClipAudio, ClipTransform, EditorDoc, Track } from "./types";

export const DEFAULT_CLIP_TRANSFORM: ClipTransform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  opacity: 1,
};

export const DEFAULT_CLIP_AUDIO: ClipAudio = {
  volume: 1,
  pan: 0,
  muted: false,
  noiseReduction: 0,
};

export function createDefaultClip(
  partial: Pick<Clip, "id" | "assetId" | "trackId" | "start" | "duration"> & {
    sourceIn?: number;
    sourceOut?: number;
    label?: string;
    speed?: number;
  },
): Clip {
  const sourceIn = partial.sourceIn ?? 0;
  const duration = partial.duration;
  const speed = partial.speed ?? 1;
  return {
    id: partial.id,
    assetId: partial.assetId,
    trackId: partial.trackId,
    start: partial.start,
    duration,
    sourceIn,
    sourceOut: partial.sourceOut ?? sourceIn + duration * speed,
    transform: { ...DEFAULT_CLIP_TRANSFORM },
    audio: { ...DEFAULT_CLIP_AUDIO },
    speed,
    enabled: true,
    effects: [],
    label: partial.label,
  };
}

/** Pistes standard CapCut : V1/V2 vidéo, A1/A2 audio, T1 légendes. */
export function createStandardNleTracks(): Track[] {
  return [
    {
      id: "v2",
      kind: "video",
      role: "broll",
      name: "V2",
      muted: false,
      locked: false,
      clips: [],
    },
    {
      id: "v1",
      kind: "video",
      role: "main",
      name: "V1",
      muted: false,
      locked: false,
      clips: [],
    },
    {
      id: "a1",
      kind: "audio",
      role: "voice",
      name: "A1",
      muted: false,
      locked: false,
      clips: [],
    },
    {
      id: "a2",
      kind: "audio",
      role: "music",
      name: "A2",
      muted: false,
      locked: false,
      clips: [],
    },
    {
      id: "t1",
      kind: "caption",
      role: "captions",
      name: "T1",
      muted: false,
      locked: false,
      clips: [],
    },
  ];
}

export function createEmptyNleDoc(
  opts: { id?: string; name?: string; now?: string } = {},
): EditorDoc {
  const now = opts.now ?? new Date().toISOString();
  return {
    id: opts.id ?? `proj_${Date.now().toString(36)}`,
    createdAt: now,
    updatedAt: now,
    settings: {
      name: opts.name ?? "Sans titre",
      width: 1920,
      height: 1080,
      fps: 30,
      aspectRatio: "16:9",
      sampleRate: 48000,
    },
    assets: [],
    timeline: { tracks: createStandardNleTracks() },
    transcript: {
      language: "fr",
      duration: 0,
      segments: [],
      detections: { silences: [], fillers: [], repetitions: [], speechTics: [] },
      metrics: { totalPotentiallySavedTime: 0 },
    },
    removedRanges: [],
    operations: [],
  };
}

/** Piste cible selon le kind d'asset. */
export function defaultTrackIdForAssetKind(kind: "video" | "audio" | "image" | "caption"): string {
  if (kind === "audio") return "a1";
  if (kind === "caption") return "t1";
  return "v1";
}
