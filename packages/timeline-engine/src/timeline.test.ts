import { describe, expect, it } from "vitest";
import { ALL_TRACKS } from "@hybridator/core-model";
import { commit, createHistory, redo, undo } from "./history";
import { sourceSpanToTimelineRange, sourceToTimeline } from "./mapping";
import { snapClipStart } from "./snap";
import {
  applyOperation,
  applyOperations,
  findClip,
  opsForSourceRanges,
  timelineDuration,
} from "./timeline";
import {
  sourceRangeForWord,
  sourceRangeFromCharSpan,
  sourceRangeWithinWord,
} from "./transcript-edit";
import { makeDoc, makeHeavyDoc } from "./fixtures";

describe("applyOperation", () => {
  it("REMOVE_RANGE ripples without mutating assets", () => {
    const d = makeDoc();
    const before = timelineDuration(d.timeline);
    const assetsBefore = JSON.stringify(d.assets);
    const next = applyOperation(d, {
      type: "REMOVE_RANGE",
      trackId: ALL_TRACKS,
      start: 2,
      end: 3,
      reason: "test",
    });
    expect(timelineDuration(next.timeline)).toBeCloseTo(before - 1);
    expect(next.removedRanges).toEqual([{ start: 2, end: 3, reason: "test" }]);
    expect(JSON.stringify(next.assets)).toBe(assetsBefore);
    expect(d.removedRanges).toEqual([]);
  });

  it("MOVE_CLIP and RESIZE_CLIP", () => {
    const d = makeDoc();
    const moved = applyOperation(d, { type: "MOVE_CLIP", clipId: "v1-1", start: 3 });
    expect(findClip(moved.timeline, "v1-1")?.start).toBe(3);
    const resized = applyOperation(d, {
      type: "RESIZE_CLIP",
      clipId: "v1-1",
      start: 0,
      duration: 8,
      sourceIn: 0,
      sourceOut: 8,
    });
    expect(findClip(resized.timeline, "v1-1")?.duration).toBe(8);
    expect(findClip(resized.timeline, "v1-1")?.sourceOut).toBe(8);
  });

  it("blocks edits on locked tracks and no-ops missing effect targets", () => {
    const d = makeDoc();
    const locked = applyOperation(d, {
      type: "SET_TRACK",
      trackId: "v1",
      patch: { locked: true },
    });
    const moved = applyOperation(locked, { type: "MOVE_CLIP", clipId: "v1-1", start: 9 });
    expect(findClip(moved.timeline, "v1-1")?.start).toBe(findClip(locked.timeline, "v1-1")?.start);
    const deleted = applyOperation(locked, { type: "DELETE_CLIP", clipId: "v1-1" });
    expect(findClip(deleted.timeline, "v1-1")).toBeDefined();
    const missingFx = applyOperation(d, {
      type: "ADD_EFFECT",
      clipId: "missing",
      effect: { id: "e-x", type: "blur", params: {} },
    });
    expect(missingFx.operations.length).toBe(d.operations.length);
  });

  it("ADD_EFFECT, SET_TRANSITION, DELETE_CLIP ripple", () => {
    const d = makeDoc();
    const withFx = applyOperation(d, {
      type: "ADD_EFFECT",
      clipId: "v1-1",
      effect: { id: "e1", type: "blur", params: { radius: 4 } },
    });
    expect(findClip(withFx.timeline, "v1-1")?.effects).toHaveLength(1);

    const withTr = applyOperation(withFx, {
      type: "SET_TRANSITION",
      clipId: "v1-1",
      transition: { type: "fade", durationSec: 0.5 },
    });
    expect(findClip(withTr.timeline, "v1-1")?.transition?.type).toBe("fade");

    const cleared = applyOperation(withTr, {
      type: "SET_TRANSITION",
      clipId: "v1-1",
      transition: null,
    });
    expect(findClip(cleared.timeline, "v1-1")?.transition).toBeUndefined();

    let doc = applyOperation(d, {
      type: "ADD_CLIP",
      clip: {
        id: "v1-2",
        assetId: "cam",
        trackId: "v1",
        start: 20,
        duration: 5,
        sourceIn: 0,
        sourceOut: 5,
        speed: 1,
        enabled: true,
        effects: [],
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
        audio: { volume: 1, pan: 0, muted: false, noiseReduction: 0 },
      },
    });
    doc = applyOperation(doc, { type: "DELETE_CLIP", clipId: "v1-1", ripple: true });
    expect(findClip(doc.timeline, "v1-1")).toBeUndefined();
    expect(findClip(doc.timeline, "v1-2")?.start).toBeCloseTo(0);
  });

  it("ADD_ASSET, ADD_CLIP, DELETE_CLIP, REMOVE_ASSET", () => {
    const d = makeDoc();
    const withAsset = applyOperation(d, {
      type: "ADD_ASSET",
      asset: {
        id: "broll",
        name: "Broll",
        kind: "video",
        uri: "opfs://test/broll",
        durationSec: 5,
      },
    });
    expect(withAsset.assets.some((a) => a.id === "broll")).toBe(true);

    const clip = {
      id: "v1-new",
      assetId: "broll",
      trackId: "v1",
      start: 20,
      duration: 5,
      sourceIn: 0,
      sourceOut: 5,
      speed: 1,
      enabled: true,
      effects: [],
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      audio: { volume: 1, pan: 0, muted: false, noiseReduction: 0 },
    };
    const withClip = applyOperation(withAsset, { type: "ADD_CLIP", clip });
    expect(findClip(withClip.timeline, "v1-new")?.duration).toBe(5);

    const split = applyOperation(withClip, {
      type: "SPLIT_CLIP",
      clipId: "v1-new",
      position: 22.5,
    });
    expect(split.timeline.tracks.find((t) => t.id === "v1")?.clips.length).toBeGreaterThan(
      withClip.timeline.tracks.find((t) => t.id === "v1")!.clips.length,
    );

    const deleted = applyOperation(withClip, { type: "DELETE_CLIP", clipId: "v1-new" });
    expect(findClip(deleted.timeline, "v1-new")).toBeUndefined();

    const blocked = applyOperation(withClip, { type: "REMOVE_ASSET", assetId: "broll" });
    expect(blocked.assets.some((a) => a.id === "broll")).toBe(true);

    const removed = applyOperation(deleted, { type: "REMOVE_ASSET", assetId: "broll" });
    expect(removed.assets.some((a) => a.id === "broll")).toBe(false);
  });

  it("SPLIT_CLIP, CHANGE_SPEED, SWITCH_CAMERA_ANGLE, UPDATE_CLIP, SET_TRACK", () => {
    const d = makeDoc({
      timeline: {
        tracks: [
          {
            id: "v1",
            kind: "video",
            role: "angles",
            name: "Angles",
            muted: false,
            locked: false,
            clips: [
              {
                id: "a1-1",
                assetId: "cam",
                trackId: "v1",
                start: 0,
                duration: 10,
                sourceIn: 0,
                sourceOut: 10,
                speed: 1,
                enabled: true,
                effects: [],
                transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
                audio: { volume: 1, pan: 0, muted: false, noiseReduction: 0 },
              },
            ],
          },
        ],
      },
    });
    const split = applyOperation(d, { type: "SPLIT_CLIP", clipId: "a1-1", position: 5 });
    expect(split.timeline.tracks[0]?.clips).toHaveLength(2);

    const sped = applyOperation(d, { type: "CHANGE_SPEED", clipId: "a1-1", speed: 2 });
    expect(findClip(sped.timeline, "a1-1")?.duration).toBeCloseTo(5);

    const sw = applyOperation(d, {
      type: "SWITCH_CAMERA_ANGLE",
      time: 1,
      angleId: "cam-b",
    });
    expect(sw.timeline.tracks[0]?.clips.some((c) => c.assetId === "cam-b" && c.start === 1)).toBe(
      true,
    );

    const upd = applyOperation(d, {
      type: "UPDATE_CLIP",
      clipId: "a1-1",
      patch: { label: "x", audio: { muted: true } },
    });
    expect(findClip(upd.timeline, "a1-1")?.label).toBe("x");
    expect(findClip(upd.timeline, "a1-1")?.audio.muted).toBe(true);

    const tr = applyOperation(d, { type: "SET_TRACK", trackId: "v1", patch: { muted: true } });
    expect(tr.timeline.tracks[0]?.muted).toBe(true);
  });

  it("speed-aware source→timeline duration", () => {
    const d = makeDoc();
    const sped = applyOperation(d, { type: "CHANGE_SPEED", clipId: "v1-1", speed: 2 });
    // Also speed the audio reference? reference is main video
    const span = sourceSpanToTimelineRange(sped, 0, 4);
    expect(span).not.toBeNull();
    // 4s source at 2x => 2s timeline
    expect(span!.end - span!.start).toBeCloseTo(2);
  });
});

describe("transcript free delete → timeline", () => {
  it("removes an arbitrary word (not only fillers)", () => {
    const d = makeDoc();
    const word = d.transcript.segments[0]!.words[2]!; // "monde"
    const ops = opsForSourceRanges(d, [sourceRangeForWord(word)]);
    const next = applyOperations(d, ops);
    expect(sourceToTimeline((word.start + word.end) / 2, next.removedRanges)).toBeNull();
    expect(timelineDuration(next.timeline)).toBeCloseTo(
      timelineDuration(d.timeline) - (word.end - word.start),
    );
  });

  it("removes a character span inside a word", () => {
    const d = makeDoc();
    const word = d.transcript.segments[0]!.words[0]!; // "Bonjour" 0..1s
    const partial = sourceRangeWithinWord(word, 0, 3); // "Bon"
    expect(partial.end - partial.start).toBeCloseTo(3 / 7);
    const next = applyOperations(d, opsForSourceRanges(d, [partial]));
    expect(sourceToTimeline((partial.start + partial.end) / 2, next.removedRanges)).toBeNull();
    // Neighbour characters still present
    const rest = sourceRangeWithinWord(word, 3, 7);
    expect(sourceToTimeline((rest.start + rest.end) / 2, next.removedRanges)).not.toBeNull();
  });

  it("removes a multi-word character selection", () => {
    const d = makeDoc();
    const range = sourceRangeFromCharSpan(
      d.transcript,
      { segmentId: "s1", wordIndex: 0, charIndex: 3 }, // "jour" of Bonjour
      { segmentId: "s1", wordIndex: 2, charIndex: 1 }, // "mo" of monde
    );
    expect(range).not.toBeNull();
    const next = applyOperations(d, opsForSourceRanges(d, [range!]));
    expect(sourceToTimeline((range!.start + range!.end) / 2, next.removedRanges)).toBeNull();
  });
});

describe("history properties", () => {
  it("apply then undo restores exact previous state", () => {
    const d = makeDoc();
    let h = createHistory(d);
    const ops = [
      { type: "REMOVE_RANGE" as const, trackId: ALL_TRACKS, start: 1, end: 2, reason: "a" },
      { type: "SPLIT_CLIP" as const, clipId: "a1-1", position: 5 },
      { type: "CHANGE_SPEED" as const, clipId: "v1-1", speed: 1.5 },
    ];
    for (const op of ops) {
      const prev = h.present;
      h = commit(h, applyOperation(h.present, op));
      h = undo(h);
      expect(h.present).toEqual(prev);
      h = redo(h);
      expect(h.present.operations.at(-1)).toEqual(op);
    }
  });

  it("assets never change across edits", () => {
    const d = makeDoc();
    const assets = JSON.stringify(d.assets);
    const next = applyOperations(d, [
      { type: "REMOVE_RANGE", trackId: ALL_TRACKS, start: 0, end: 1, reason: "x" },
      { type: "CHANGE_SPEED", clipId: "v1-1", speed: 2 },
    ]);
    expect(JSON.stringify(next.assets)).toBe(assets);
  });
});

describe("snapClipStart", () => {
  it("snaps to neighbour edge within threshold", () => {
    const d = makeDoc();
    const snapped = snapClipStart(d.timeline, "v1-1", 0.08, {
      thresholdSec: 0.15,
      edges: true,
      playhead: 5,
    });
    // near 0
    expect(snapped).toBeCloseTo(0);
    const toPlayhead = snapClipStart(d.timeline, "v1-1", 5.05, {
      thresholdSec: 0.2,
      playhead: 5,
    });
    expect(toPlayhead).toBeCloseTo(5);
  });
});

describe("benchmarks", () => {
  it("handles 1000 clips / 10 tracks under thresholds", () => {
    const d = makeHeavyDoc(10, 100);
    expect(d.timeline.tracks).toHaveLength(10);
    expect(d.timeline.tracks.reduce((n, t) => n + t.clips.length, 0)).toBe(1000);

    const t0 = performance.now();
    let cur = d;
    for (let i = 0; i < 20; i++) {
      cur = applyOperation(cur, {
        type: "REMOVE_RANGE",
        trackId: ALL_TRACKS,
        start: 90 - i,
        end: 90 - i + 0.25,
        reason: "bench",
      });
    }
    let h = createHistory(d);
    h = commit(h, cur);
    for (let i = 0; i < 20; i++) h = undo(h);
    for (let i = 0; i < 20; i++) h = redo(h);
    const ms = performance.now() - t0;

    // Seuil Master Phase 1 : édition stress < 2s en CI
    expect(ms).toBeLessThan(2000);
    expect(h.present.operations.length).toBe(20);
    expect(JSON.stringify(h.present.assets)).toBe(JSON.stringify(d.assets));
  });
});
