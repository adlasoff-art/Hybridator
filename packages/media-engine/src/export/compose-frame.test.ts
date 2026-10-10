import { describe, expect, it } from "vitest";
import { createEmptyNleDoc, createDefaultClip } from "@hybridator/core-model";
import { frameTimestamps, sourceTimeAt } from "./compose-frame";

describe("compose-frame", () => {
  it("builds frame timestamps", () => {
    const t = frameTimestamps(1, 10);
    expect(t).toHaveLength(10);
    expect(t[0]).toBe(0);
    expect(t[9]).toBeCloseTo(0.9);
  });

  it("maps reverse source time", () => {
    const clip = {
      start: 0,
      duration: 4,
      sourceIn: 0,
      sourceOut: 4,
      speed: 1,
      reversed: true as const,
    };
    expect(sourceTimeAt(clip, 0)).toBeCloseTo(4);
    expect(sourceTimeAt(clip, 2)).toBeCloseTo(2);
    expect(sourceTimeAt({ ...clip, reversed: false }, 2)).toBeCloseTo(2);
  });

  it("empty doc still yields export duration helpers", () => {
    const doc = createEmptyNleDoc({ id: "e", now: "2026-01-01T00:00:00.000Z" });
    expect(doc.timeline.tracks.length).toBeGreaterThan(0);
    const clip = createDefaultClip({
      id: "c",
      assetId: "a",
      trackId: "v1",
      start: 0,
      duration: 2,
    });
    expect(sourceTimeAt(clip, 1)).toBeCloseTo(1);
  });
});
