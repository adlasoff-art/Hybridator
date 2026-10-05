import { analyzeTranscript } from "./transcript";
import type { Asset, Clip, EditorDoc, TranscriptSegment } from "./types";

/** Contenu de démonstration (épisode fictif) — pas une donnée produit. */
const SCRIPT: { speaker: "host" | "guest"; text: string }[] = [
  { speaker: "host", text: "Bienvenue dans ce nouvel épisode euh consacré au montage de podcasts" },
  { speaker: "guest", text: "Merci de m'inviter bah c'est un sujet que j'adore vraiment vraiment" },
  { speaker: "host", text: "Alors euh comment tu prépares tes enregistrements multi caméras" },
  {
    speaker: "guest",
    text: "Je place trois caméras et genre un micro par invité pour isoler chaque voix",
  },
  { speaker: "host", text: "Et ensuite hum tu synchronises tout à la main" },
  {
    speaker: "guest",
    text: "Non l'alignement des ondes sonores fait le travail en quelques secondes",
  },
  { speaker: "host", text: "Super ben on va voir ça en détail juste après" },
];

const SPEAKER_LABEL = { host: "Animateur", guest: "Invité" } as const;

export const DEMO_ASSETS: Asset[] = [
  {
    id: "cam-wide",
    name: "Caméra 01 — Plan large",
    kind: "video",
    uri: "demo://cam-01.mp4",
    durationSec: 60,
    angle: 1,
  },
  {
    id: "cam-host",
    name: "Caméra 02 — Animateur",
    kind: "video",
    uri: "demo://cam-02.mp4",
    durationSec: 60,
    angle: 2,
  },
  {
    id: "cam-guest",
    name: "Caméra 03 — Invité",
    kind: "video",
    uri: "demo://cam-03.mp4",
    durationSec: 60,
    angle: 3,
  },
  { id: "broll", name: "B-roll — Atelier", kind: "video", uri: "demo://broll.mp4", durationSec: 8 },
  {
    id: "mic-host",
    name: "Micro 1 — Animateur",
    kind: "audio",
    uri: "demo://mic-01.wav",
    durationSec: 60,
  },
  {
    id: "mic-guest",
    name: "Micro 2 — Invité",
    kind: "audio",
    uri: "demo://mic-02.wav",
    durationSec: 60,
  },
  {
    id: "captions",
    name: "Sous-titres automatiques",
    kind: "caption",
    uri: "demo://captions.json",
    durationSec: 60,
  },
];

function buildSegments(): TranscriptSegment[] {
  let t = 0.4;
  return SCRIPT.map((line, si) => {
    const tokens = line.text.split(" ");
    const start = t;
    const words = tokens.map((tok) => {
      const isFiller = ["euh", "hum", "bah", "ben", "genre"].includes(tok);
      const d = 0.16 + 0.045 * tok.length;
      const w = { word: tok, start: t, end: t + d, confidence: isFiller ? 0.71 : 0.96 };
      t = w.end + (isFiller ? 0.7 : 0.07);
      return w;
    });
    const end = words[words.length - 1]?.end ?? start;
    t = end + (si % 2 === 0 ? 1.1 : 0.85);
    return {
      id: `seg-${si + 1}`,
      speaker: SPEAKER_LABEL[line.speaker],
      text: line.text,
      start,
      end,
      words,
    };
  });
}

export function makeClip(
  p: Pick<Clip, "id" | "assetId" | "trackId" | "start" | "duration"> & { label?: string },
): Clip {
  return {
    id: p.id,
    assetId: p.assetId,
    trackId: p.trackId,
    start: p.start,
    duration: p.duration,
    sourceIn: p.start,
    sourceOut: p.start + p.duration,
    transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    audio: { volume: 1, pan: 0, muted: false, noiseReduction: 0 },
    speed: 1,
    enabled: true,
    effects: [],
    label: p.label,
  };
}

export function createDemoDoc(
  rules: { fillerWords: string[]; silenceThresholdSec: number },
  opts: { id?: string; name?: string; now?: string } = {},
): EditorDoc {
  const segments = buildSegments();
  const transcript = analyzeTranscript({ language: "fr", segments }, rules);
  const duration = (segments[segments.length - 1]?.end ?? 0) + 0.8;

  const angleClips: Clip[] = segments.map((s, i) => {
    const next = segments[i + 1];
    const start = i === 0 ? 0 : s.start;
    const end = next ? next.start : duration;
    const assetId =
      i === 0 ? "cam-wide" : s.speaker === SPEAKER_LABEL.host ? "cam-host" : "cam-guest";
    return makeClip({ id: `v1-${i + 1}`, assetId, trackId: "v1", start, duration: end - start });
  });

  const now = opts.now ?? "2026-01-01T00:00:00.000Z";
  return {
    id: opts.id ?? "demo",
    createdAt: now,
    updatedAt: now,
    settings: {
      name: opts.name ?? "Épisode démo — Podcast multi-caméras",
      width: 1920,
      height: 1080,
      fps: 30,
      aspectRatio: "16:9",
      sampleRate: 48000,
    },
    assets: DEMO_ASSETS,
    timeline: {
      tracks: [
        {
          id: "v2",
          kind: "video",
          role: "broll",
          name: "Overlay / B-roll",
          muted: false,
          locked: false,
          clips: [
            makeClip({
              id: "v2-1",
              assetId: "broll",
              trackId: "v2",
              start: 9,
              duration: 5,
              label: "B-roll atelier",
            }),
          ],
        },
        {
          id: "v1",
          kind: "video",
          role: "angles",
          name: "Angles multi-cam",
          muted: false,
          locked: false,
          clips: angleClips,
        },
        {
          id: "a1",
          kind: "audio",
          role: "voice",
          name: "Voix iso — Animateur",
          muted: false,
          locked: false,
          clips: [makeClip({ id: "a1-1", assetId: "mic-host", trackId: "a1", start: 0, duration })],
        },
        {
          id: "a2",
          kind: "audio",
          role: "voice",
          name: "Voix iso — Invité",
          muted: false,
          locked: false,
          clips: [
            makeClip({ id: "a2-1", assetId: "mic-guest", trackId: "a2", start: 0, duration }),
          ],
        },
        {
          id: "c1",
          kind: "caption",
          role: "captions",
          name: "Sous-titres auto",
          muted: false,
          locked: false,
          clips: segments.map((s, i) =>
            makeClip({
              id: `c1-${i + 1}`,
              assetId: "captions",
              trackId: "c1",
              start: s.start,
              duration: s.end - s.start,
              label: s.text,
            }),
          ),
        },
      ],
    },
    transcript,
    removedRanges: [],
    operations: [],
  };
}
