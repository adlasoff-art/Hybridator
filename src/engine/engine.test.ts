import { describe, expect, it } from "vitest";
import { defaultProductConfig } from "@/config/product";
import { createDemoDoc } from "./demo";
import { createHistory, commit, undo, redo } from "./history";
import { applyOperation, applyOperations, opsForSourceRanges, sourceToTimeline, timelineDuration, findClip } from "./timeline";
import { serializeHyb, parseHyb } from "./serializer";
import { ALL_TRACKS } from "./types";

const doc = () => createDemoDoc(defaultProductConfig.transcript);

describe("timeline engine", () => {
  it("detects fillers and silences from config rules", () => {
    const d = doc();
    expect(d.transcript.detections.fillers.length).toBeGreaterThan(0);
    expect(d.transcript.detections.silences.length).toBeGreaterThan(0);
    expect(d.transcript.detections.repetitions.length).toBeGreaterThan(0);
  });

  it("REMOVE_RANGE ripples all tracks and records source range without touching assets", () => {
    const d = doc();
    const before = timelineDuration(d.timeline);
    const assetsBefore = JSON.stringify(d.assets);
    const next = applyOperation(d, { type: "REMOVE_RANGE", trackId: ALL_TRACKS, start: 2, end: 3, reason: "test" });
    expect(timelineDuration(next.timeline)).toBeCloseTo(before - 1);
    expect(next.removedRanges).toEqual([{ start: 2, end: 3, reason: "test" }]);
    expect(JSON.stringify(next.assets)).toBe(assetsBefore);
    expect(d.removedRanges).toEqual([]); // immutabilité
  });

  it("text-to-edit removes all fillers with correct source mapping", () => {
    const d = doc();
    const ranges = d.transcript.detections.fillers.map((f) => ({ start: f.start, end: f.end, reason: "filler" }));
    const next = applyOperations(d, opsForSourceRanges(d, ranges));
    for (const f of d.transcript.detections.fillers) {
      expect(sourceToTimeline((f.start + f.end) / 2, next.removedRanges)).toBeNull();
    }
    const total = ranges.reduce((a, r) => a + r.end - r.start, 0);
    expect(timelineDuration(next.timeline)).toBeCloseTo(timelineDuration(d.timeline) - total);
  });

  it("split, speed and camera switch", () => {
    const d = doc();
    const s = applyOperation(d, { type: "SPLIT_CLIP", clipId: "a1-1", position: 5 });
    expect(s.timeline.tracks.find((t) => t.id === "a1")?.clips.length).toBe(2);
    const sp = applyOperation(d, { type: "CHANGE_SPEED", clipId: "v2-1", speed: 2 });
    expect(findClip(sp.timeline, "v2-1")?.duration).toBeCloseTo(2.5);
    const sw = applyOperation(d, { type: "SWITCH_CAMERA_ANGLE", time: 1, angleId: "cam-guest" });
    const v1 = sw.timeline.tracks.find((t) => t.id === "v1");
    expect(v1?.clips.some((c) => c.assetId === "cam-guest" && c.start === 1)).toBe(true);
  });

  it("undo / redo", () => {
    const d = doc();
    let h = createHistory(d);
    h = commit(h, applyOperation(d, { type: "SPLIT_CLIP", clipId: "a1-1", position: 5 }));
    h = undo(h);
    expect(h.present).toBe(d);
    h = redo(h);
    expect(h.present.operations.length).toBe(1);
  });

  it(".hyb round-trip with integrity check", async () => {
    const d = applyOperation(doc(), { type: "REMOVE_RANGE", trackId: ALL_TRACKS, start: 1, end: 2, reason: "x" });
    const text = await serializeHyb(d, "test");
    const back = await parseHyb(text);
    expect(back.timeline).toEqual(d.timeline);
    expect(back.removedRanges).toEqual(d.removedRanges);
    const tampered = text.replace('"reason":"x"', '"reason":"y"');
    await expect(parseHyb(tampered)).rejects.toThrow();
  });
});
