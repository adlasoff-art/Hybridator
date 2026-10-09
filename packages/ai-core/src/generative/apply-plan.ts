import {
  createDefaultClip,
  type Asset,
  type EditOperation,
  type EditorDoc,
  type Effect,
} from "@hybridator/core-model";
import type {
  AppliedGenerativePlan,
  GenerativeEditIntent,
  GenerativeEditResult,
  GenerativePlan,
} from "./types";

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Convertit un plan IA en opérations ADD_ASSET / ADD_CLIP / effets.
 * N'applique pas au document — le client dispatch les ops.
 */
export function planToOperations(plan: GenerativePlan): AppliedGenerativePlan {
  const operations: EditOperation[] = [];

  for (const item of plan.clips) {
    const assetId = uid("ai");
    const kind: Asset["kind"] =
      item.kind === "text" || item.kind === "sticker"
        ? item.kind === "text"
          ? "caption"
          : "image"
        : item.kind === "music" || item.kind === "audio"
          ? "audio"
          : "video";

    const asset: Asset = {
      id: assetId,
      name: item.label,
      kind,
      uri: `builtin://ai/${item.kind}/${assetId}`,
      durationSec: item.duration,
    };
    operations.push({ type: "ADD_ASSET", asset });

    const effects: Effect[] = (item.effectTypes ?? []).map((type) => ({
      id: uid("fx"),
      type,
      params: {},
    }));
    if (item.content) {
      effects.push({
        id: uid("meta"),
        type: item.kind === "text" ? "text-style" : item.kind === "sticker" ? "sticker" : "ai-meta",
        params: { content: item.content },
      });
    }

    const clip = createDefaultClip({
      id: uid("clip"),
      assetId,
      trackId: item.trackHint,
      start: Math.max(0, item.start),
      duration: Math.max(0.1, item.duration),
      sourceIn: 0,
      sourceOut: Math.max(0.1, item.duration),
      label: item.content ?? item.label,
    });
    clip.effects = effects;
    if (item.transitionType) {
      clip.transition = { type: item.transitionType, durationSec: 0.5 };
    }
    operations.push({ type: "ADD_CLIP", clip });
  }

  return { title: plan.title, operations };
}

/** Convertit des intentions d'édition en EditOperations ciblant le clip. */
export function intentsToOperations(
  doc: EditorDoc,
  clipId: string,
  result: GenerativeEditResult,
): EditOperation[] {
  const clip = doc.timeline.tracks.flatMap((t) => t.clips).find((c) => c.id === clipId);
  if (!clip) return [];

  const ops: EditOperation[] = [];

  for (const intent of result.intents) {
    switch (intent.type) {
      case "add_effect":
        ops.push({
          type: "ADD_EFFECT",
          clipId,
          effect: {
            id: uid("fx"),
            type: intent.effectType,
            params: { ...(intent.params ?? {}) },
          },
        });
        break;
      case "set_transition":
        ops.push({
          type: "SET_TRANSITION",
          clipId,
          transition: {
            type: intent.transitionType,
            durationSec: intent.durationSec ?? 0.5,
          },
        });
        break;
      case "noise_reduction":
        ops.push({
          type: "UPDATE_CLIP",
          clipId,
          patch: { audio: { noiseReduction: Math.min(1, Math.max(0, intent.amount)) } },
        });
        break;
      case "change_speed":
        ops.push({ type: "CHANGE_SPEED", clipId, speed: intent.speed });
        break;
      case "add_text_overlay": {
        const assetId = uid("ai_txt");
        const duration = intent.durationSec ?? 3;
        ops.push({
          type: "ADD_ASSET",
          asset: {
            id: assetId,
            name: "Texte IA",
            kind: "caption",
            uri: `builtin://ai/text/${assetId}`,
            durationSec: duration,
          },
        });
        const textClip = createDefaultClip({
          id: uid("clip"),
          assetId,
          trackId: "t1",
          start: clip.start,
          duration,
          label: intent.content,
        });
        textClip.effects = [
          {
            id: uid("meta"),
            type: "text-style",
            params: { content: intent.content, fontSize: 32, weight: 600 },
          },
        ];
        ops.push({ type: "ADD_CLIP", clip: textClip });
        break;
      }
      case "add_broll_placeholder": {
        const assetId = uid("ai_broll");
        const duration = intent.durationSec ?? 3;
        const start = clip.start + (intent.startOffsetSec ?? 0);
        ops.push({
          type: "ADD_ASSET",
          asset: {
            id: assetId,
            name: intent.label,
            kind: "video",
            uri: `builtin://ai/broll/${assetId}`,
            durationSec: duration,
          },
        });
        ops.push({
          type: "ADD_CLIP",
          clip: createDefaultClip({
            id: uid("clip"),
            assetId,
            trackId: "v2",
            start,
            duration,
            label: intent.label,
          }),
        });
        break;
      }
      default:
        break;
    }
  }

  return ops;
}

export type { GenerativeEditIntent };
