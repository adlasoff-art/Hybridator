import type { Clip, EditorDoc, Track } from "@hybridator/core-model";

const transform = { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 };
const audio = { volume: 1, pan: 0, muted: false, noiseReduction: 0 };

function clip(
  partial: Partial<Clip> & Pick<Clip, "id" | "assetId" | "trackId" | "start" | "duration">,
): Clip {
  const duration = partial.duration;
  const speed = partial.speed ?? 1;
  const sourceIn = partial.sourceIn ?? partial.start;
  return {
    transform,
    audio,
    speed,
    enabled: true,
    effects: [],
    sourceIn,
    sourceOut: partial.sourceOut ?? sourceIn + duration * speed,
    ...partial,
  };
}

export function makeDoc(overrides?: Partial<EditorDoc>): EditorDoc {
  const tracks: Track[] = [
    {
      id: "v1",
      kind: "video",
      role: "main",
      name: "Main",
      muted: false,
      locked: false,
      clips: [
        clip({
          id: "v1-1",
          assetId: "cam",
          trackId: "v1",
          start: 0,
          duration: 20,
          sourceIn: 0,
          sourceOut: 20,
        }),
      ],
    },
    {
      id: "a1",
      kind: "audio",
      role: "voice",
      name: "Voice",
      muted: false,
      locked: false,
      clips: [
        clip({
          id: "a1-1",
          assetId: "mic",
          trackId: "a1",
          start: 0,
          duration: 20,
          sourceIn: 0,
          sourceOut: 20,
        }),
      ],
    },
  ];

  return {
    id: "test",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    settings: {
      name: "Test",
      width: 1920,
      height: 1080,
      fps: 30,
      aspectRatio: "16:9",
      sampleRate: 48000,
    },
    assets: [
      { id: "cam", name: "Cam", kind: "video", uri: "demo://cam", durationSec: 20 },
      { id: "mic", name: "Mic", kind: "audio", uri: "demo://mic", durationSec: 20 },
    ],
    timeline: { tracks },
    transcript: {
      language: "fr",
      duration: 6,
      segments: [
        {
          id: "s1",
          speaker: "host",
          text: "Bonjour le monde",
          start: 0,
          end: 3,
          words: [
            { word: "Bonjour", start: 0.0, end: 1.0, confidence: 0.99 },
            { word: "le", start: 1.1, end: 1.4, confidence: 0.98 },
            { word: "monde", start: 1.5, end: 2.5, confidence: 0.99 },
          ],
        },
        {
          id: "s2",
          speaker: "guest",
          text: "Salut",
          start: 3,
          end: 4,
          words: [{ word: "Salut", start: 3.0, end: 3.8, confidence: 0.97 }],
        },
      ],
      detections: { silences: [], fillers: [], repetitions: [], speechTics: [] },
      metrics: { totalPotentiallySavedTime: 0 },
    },
    removedRanges: [],
    operations: [],
    ...overrides,
  };
}

/** Document stress : 10 pistes × 100 clips = 1 000 clips. */
export function makeHeavyDoc(tracks = 10, clipsPerTrack = 100): EditorDoc {
  const clipDur = 1;
  const built: Track[] = Array.from({ length: tracks }, (_, ti) => {
    const id = `t${ti}`;
    return {
      id,
      kind: ti % 2 === 0 ? ("video" as const) : ("audio" as const),
      role: ti === 0 ? ("main" as const) : ("broll" as const),
      name: `Track ${ti}`,
      muted: false,
      locked: false,
      clips: Array.from({ length: clipsPerTrack }, (_, ci) => {
        const start = ci * clipDur;
        return clip({
          id: `${id}-c${ci}`,
          assetId: "cam",
          trackId: id,
          start,
          duration: clipDur,
          sourceIn: start,
          sourceOut: start + clipDur,
        });
      }),
    };
  });

  const base = makeDoc();
  return {
    ...base,
    timeline: { tracks: built },
    assets: base.assets,
  };
}
