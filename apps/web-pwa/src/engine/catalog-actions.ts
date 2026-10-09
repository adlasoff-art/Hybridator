import {
  createDefaultClip,
  type Asset,
  type CatalogItem,
  type EditOperation,
  type EditorDoc,
  type Effect,
} from "@hybridator/core-model";

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Place un titre ou sticker du catalogue sur la timeline. */
export function opsForCatalogOverlay(
  doc: EditorDoc,
  item: CatalogItem,
  time: number,
): EditOperation[] {
  if (item.kind !== "text" && item.kind !== "sticker") return [];

  const isText = item.kind === "text";
  const trackId = isText ? "t1" : "v2";
  const track = doc.timeline.tracks.find((t) => t.id === trackId);
  if (!track) return [];

  const assetId = uid(isText ? "text" : "stk");
  const duration = item.defaultDurationSec;
  const asset: Asset = {
    id: assetId,
    name: item.label,
    kind: isText ? "caption" : "image",
    uri: isText ? `builtin://text/${item.id}` : `builtin://sticker/${item.id}`,
    durationSec: duration,
  };
  const clip = createDefaultClip({
    id: uid("clip"),
    assetId,
    trackId,
    start: Math.max(0, time),
    duration,
    sourceIn: 0,
    sourceOut: duration,
    label: item.content ?? item.label,
  });
  if (item.params) {
    clip.effects = [
      {
        id: uid("meta"),
        type: isText ? "text-style" : "sticker",
        params: { ...item.params, content: item.content ?? item.label },
      },
    ];
  } else if (!isText && item.content) {
    clip.effects = [
      {
        id: uid("meta"),
        type: "sticker",
        params: { content: item.content },
      },
    ];
  }
  return [
    { type: "ADD_ASSET", asset },
    { type: "ADD_CLIP", clip },
  ];
}

export function opForCatalogEffect(clipId: string, item: CatalogItem): EditOperation | null {
  if (item.kind !== "effect" || !item.effectType) return null;
  const effect: Effect = {
    id: uid("fx"),
    type: item.effectType,
    params: { ...(item.params ?? {}) },
  };
  return { type: "ADD_EFFECT", clipId, effect };
}

export function opForCatalogTransition(clipId: string, item: CatalogItem): EditOperation | null {
  if (item.kind !== "transition" || !item.effectType) return null;
  return {
    type: "SET_TRANSITION",
    clipId,
    transition: { type: item.effectType, durationSec: item.defaultDurationSec },
  };
}
