import { describe, expect, it } from "vitest";
import { createDefaultClip, createEmptyNleDoc } from "@hybridator/core-model";
import { applyOperations, findClip } from "./timeline";
import {
  opsForDuplicateClip,
  opsForPasteClip,
  removeKeyframeAt,
  upsertKeyframeTracks,
} from "./clip-tools";

describe("clip-tools", () => {
  it("duplicates a clip after the original", () => {
    let doc = createEmptyNleDoc({ id: "d1", now: "2026-01-01T00:00:00.000Z" });
    doc = applyOperations(doc, [
      {
        type: "ADD_ASSET",
        asset: {
          id: "a1",
          name: "v",
          kind: "video",
          uri: "opfs://d1/a1",
          durationSec: 5,
        },
      },
      {
        type: "ADD_CLIP",
        clip: createDefaultClip({
          id: "c1",
          assetId: "a1",
          trackId: "v1",
          start: 0,
          duration: 5,
        }),
      },
    ]);
    const ops = opsForDuplicateClip(doc, "c1");
    expect(ops).toHaveLength(1);
    const next = applyOperations(doc, ops);
    expect(next.timeline.tracks.find((t) => t.id === "v1")?.clips).toHaveLength(2);
    const copy = next.timeline.tracks.find((t) => t.id === "v1")!.clips.find((c) => c.id !== "c1")!;
    expect(copy.start).toBe(5);
  });

  it("pastes at playhead and upserts keyframes", () => {
    let doc = createEmptyNleDoc({ id: "d2", now: "2026-01-01T00:00:00.000Z" });
    const clip = createDefaultClip({
      id: "c1",
      assetId: "x",
      trackId: "v1",
      start: 0,
      duration: 2,
    });
    doc = applyOperations(doc, [
      {
        type: "ADD_ASSET",
        asset: { id: "x", name: "x", kind: "video", uri: "opfs://d2/x", durationSec: 2 },
      },
      { type: "ADD_CLIP", clip },
    ]);
    const paste = opsForPasteClip(doc, clip, 3);
    expect(paste).toHaveLength(1);
    expect(paste[0]?.type).toBe("ADD_CLIP");
    const next = applyOperations(doc, paste);
    const pastedId = paste[0]!.type === "ADD_CLIP" ? paste[0].clip.id : "";
    expect(findClip(next.timeline, pastedId)?.start).toBe(3);

    const kfs = upsertKeyframeTracks(undefined, "opacity", 0.5, 0.2);
    expect(kfs[0]?.keys).toHaveLength(1);
    const updated = upsertKeyframeTracks(kfs, "opacity", 0.5, 0.8);
    expect(updated[0]?.keys[0]?.value).toBe(0.8);
    expect(removeKeyframeAt(updated, "opacity", 0.5)).toHaveLength(0);
  });
});
