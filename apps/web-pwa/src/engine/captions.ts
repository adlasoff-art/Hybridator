import {
  createDefaultClip,
  type EditOperation,
  type EditorDoc,
  type TranscriptWord,
} from "@hybridator/core-model";

function flattenWords(doc: EditorDoc): TranscriptWord[] {
  return doc.transcript.segments.flatMap((s) => s.words);
}

/**
 * Génère des clips T1 à partir du transcript (sous-titres auto CapCut-like).
 * Mode word-by-word si `style === "karaoke"`, sinon groupes de mots.
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

  // Retirer les anciens clips auto-captions (label préfixé).
  for (const c of t1.clips) {
    if (c.label?.startsWith("Caption ·")) {
      ops.push({ type: "DELETE_CLIP", clipId: c.id });
    }
  }

  if (style === "karaoke") {
    for (const w of words) {
      const dur = Math.max(0.08, w.end - w.start);
      const clip = createDefaultClip({
        id: `cap_${w.start.toFixed(3)}_${Math.random().toString(36).slice(2, 6)}`,
        assetId: ensureCaptionAsset(doc, ops),
        trackId: "t1",
        start: w.start,
        duration: dur,
        label: `Caption · ${w.word}`,
      });
      clip.effects = [
        {
          id: `ts_${clip.id}`,
          type: "text-style",
          params: { content: w.word, fontSize: 36, weight: 700, y: 80 },
        },
      ];
      ops.push({ type: "ADD_CLIP", clip });
    }
    return ops;
  }

  let buf: TranscriptWord[] = [];
  let chars = 0;
  const flush = () => {
    if (!buf.length) return;
    const start = buf[0]!.start;
    const end = buf[buf.length - 1]!.end;
    const text = buf.map((w) => w.word).join(" ");
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
        params: { content: text, fontSize: 28, weight: 600, y: 90 },
      },
    ];
    ops.push({ type: "ADD_CLIP", clip });
    buf = [];
    chars = 0;
  };

  for (const w of words) {
    if (chars + w.word.length + 1 > maxChars) flush();
    buf.push(w);
    chars += w.word.length + 1;
  }
  flush();
  return ops;
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
