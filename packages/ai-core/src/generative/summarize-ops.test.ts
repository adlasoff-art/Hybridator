import { describe, expect, it } from "vitest";
import { createDefaultClip, createEmptyNleDoc } from "@hybridator/core-model";
import { summarizeEditOperation, summarizeEditOperations } from "./summarize-ops";

describe("summarizeEditOperations", () => {
  it("labels ADD_ASSET / ADD_CLIP / SWITCH_CAMERA_ANGLE", () => {
    const doc = createEmptyNleDoc({ id: "d", now: "2026-01-01T00:00:00.000Z" });
    const clip = createDefaultClip({
      id: "c1",
      assetId: "a1",
      trackId: "v1",
      start: 1.5,
      duration: 2,
      label: "Intro",
    });
    expect(
      summarizeEditOperation({
        type: "ADD_ASSET",
        asset: {
          id: "a1",
          name: "Plan IA",
          kind: "video",
          uri: "builtin://x",
          durationSec: 2,
        },
      }),
    ).toContain("Plan IA");
    expect(summarizeEditOperation({ type: "ADD_CLIP", clip })).toContain("Intro");
    expect(
      summarizeEditOperation({ type: "SWITCH_CAMERA_ANGLE", time: 3, angleId: "wide" }),
    ).toContain("wide");
    void doc;
  });

  it("truncates long lists", () => {
    const ops = Array.from({ length: 15 }, (_, i) => ({
      type: "SWITCH_CAMERA_ANGLE" as const,
      time: i,
      angleId: `a${i}`,
    }));
    const lines = summarizeEditOperations(ops, 3);
    expect(lines).toHaveLength(4);
    expect(lines.at(-1)).toMatch(/\+12/);
  });
});
