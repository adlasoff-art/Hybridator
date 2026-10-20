import {
  createDefaultClip,
  type EditOperation,
  type EditorDoc,
  type TranscriptWord,
} from "@hybridator/core-model";

export type CaptionWordTiming = { word: string; start: number; end: number };

function flattenWords(doc: EditorDoc): TranscriptWord[] {
  return doc.transcript.segments.flatMap((s) => s.words);
}

/**
 * Génère des clips T1 à partir du transcript (sous-titres auto CapCut-like).
 * - `block` : groupes de mots
 * - `karaoke` : lignes avec timings mot-à-mot (highlight animé en preview)
 */
export function opsForAutoCaptions(
  doc: EditorDoc,
  options: { style?: "block" | "karaoke"; maxChars?: number } = {},
): EditOperation[] {
  const words = flattenWords(doc);
  if (!words.length) return [];
  const style = options.style ?? "block";
  const maxChars = options.maxChars ?? 42;
  const ops: EditOperation[] = [];
  const t1 = doc.timeline.tracks.find((t) => t.id === "t1");
  if (!t1) return [];

  for (const c of t1.clips) {
    if (c.label?.startsWith("Caption ·")) {
      ops.push({ type: "DELETE_CLIP", clipId: c.id });
    }
  }

  let buf: TranscriptWord[] = [];
  let chars = 0;

  const flush = (karaoke: boolean) => {
    if (!buf.length) return;
    const start = buf[0]!.start;
    const end = buf[buf.length - 1]!.end;
    const text = buf.map((w) => w.word).join(" ");
    const timings: CaptionWordTiming[] = buf.map((w) => ({
      word: w.word,
      start: w.start,
      end: w.end,
    }));
    const clip = createDefaultClip({
      id: `cap_${start.toFixed(3)}_${Math.random().toString(36).slice(2, 6)}`,
      assetId: ensureCaptionAsset(doc, ops),
      trackId: "t1",
      start,
      duration: Math.max(0.2, end - start),
      label: `Caption · ${text.slice(0, 24)}`,
    });
    clip.effects = [
      {
        id: `ts_${clip.id}`,
        type: "text-style",
        params: karaoke
          ? {
              content: text,
              mode: "karaoke",
              words: JSON.stringify(timings),
              highlightColor: "#a3e635",
              anim: "pop",
              fontSize: 32,
              weight: 700,
              y: 90,
            }
          : {
              content: text,
              mode: "block",
              fontSize: 28,
              weight: 600,
              y: 90,
            },
      },
    ];
    ops.push({ type: "ADD_CLIP", clip });
    buf = [];
    chars = 0;
  };

  for (const w of words) {
    if (chars + w.word.length + 1 > maxChars) flush(style === "karaoke");
    buf.push(w);
    chars += w.word.length + 1;
  }
  flush(style === "karaoke");
  return ops;
}

/** Parse les timings karaoke stockés dans text-style.params.words */
export function parseKaraokeWords(raw: unknown): CaptionWordTiming[] {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed = JSON.parse(raw) as CaptionWordTiming[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (w) =>
        w && typeof w.word === "string" && typeof w.start === "number" && typeof w.end === "number",
    );
  } catch {
    return [];
  }
}

function ensureCaptionAsset(doc: EditorDoc, ops: EditOperation[]): string {
  const existing = doc.assets.find((a) => a.id === "asset_auto_caption");
  if (existing) return existing.id;
  if (!ops.some((o) => o.type === "ADD_ASSET" && o.asset.id === "asset_auto_caption")) {
    ops.push({
      type: "ADD_ASSET",
      asset: {
        id: "asset_auto_caption",
        name: "Auto captions",
        kind: "caption",
        uri: "builtin://captions/auto",
        durationSec: 0,
      },
    });
  }
  return "asset_auto_caption";
}
