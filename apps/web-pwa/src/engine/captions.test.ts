import { describe, expect, it } from "vitest";
import { createEmptyNleDoc } from "@hybridator/core-model";
import { opsForAutoCaptions } from "./captions";

describe("opsForAutoCaptions", () => {
  it("builds T1 clips from transcript words", () => {
    const doc = createEmptyNleDoc({ id: "c1", now: "2026-01-01T00:00:00.000Z" });
    doc.transcript.segments = [
      {
        id: "s1",
        speaker: "A",
        text: "Bonjour monde",
        start: 0,
        end: 2,
        words: [
          { word: "Bonjour", start: 0, end: 0.8, confidence: 1 },
          { word: "monde", start: 0.9, end: 1.6, confidence: 1 },
        ],
      },
    ];
    const ops = opsForAutoCaptions(doc, { style: "block" });
    expect(ops.some((o) => o.type === "ADD_ASSET")).toBe(true);
    expect(ops.filter((o) => o.type === "ADD_CLIP").length).toBeGreaterThan(0);
    const karaoke = opsForAutoCaptions(doc, { style: "karaoke" });
    expect(karaoke.filter((o) => o.type === "ADD_CLIP")).toHaveLength(2);
  });
});
