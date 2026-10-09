import { describe, expect, it } from "vitest";
import { createEmptyNleDoc, createDefaultClip } from "@hybridator/core-model";
import { applyOperation, findClip, undo, commit, createHistory } from "./index";
import { hasUnlinkedAudioSibling, planUnlinkAudio } from "./unlink";

function videoDoc() {
  let doc = createEmptyNleDoc({ id: "p1", name: "T", now: "2026-01-01T00:00:00.000Z" });
  doc = applyOperation(doc, {
    type: "ADD_ASSET",
    asset: {
      id: "vid1",
      name: "Clip.mp4",
      kind: "video",
      uri: "opfs://p1/vid1",
      durationSec: 10,
    },
  });
  const clip = createDefaultClip({
    id: "vclip1",
    assetId: "vid1",
    trackId: "v1",
    start: 0,
    duration: 10,
    label: "Cam",
  });
  clip.mediaRole = "av";
  return applyOperation(doc, { type: "ADD_CLIP", clip });
}

describe("UNLINK_AUDIO", () => {
  it("extracts audio to A1 and mutes video clip", () => {
    const doc = videoDoc();
    const next = applyOperation(doc, { type: "UNLINK_AUDIO", clipId: "vclip1" });
    const v = findClip(next.timeline, "vclip1");
    expect(v?.audio.muted).toBe(true);
    expect(v?.mediaRole).toBe("video");
    expect(v?.linkGroupId).toBeTruthy();
    const aTrack = next.timeline.tracks.find((t) => t.id === "a1");
    expect(aTrack?.clips).toHaveLength(1);
    const a = aTrack!.clips[0]!;
    expect(a.mediaRole).toBe("audio");
    expect(a.linkGroupId).toBe(v?.linkGroupId);
    expect(a.assetId).toBe("vid1");
    expect(a.start).toBe(0);
    expect(a.duration).toBe(10);
    expect(hasUnlinkedAudioSibling(next, v!)).toBe(true);
  });

  it("is a single undoable history entry", () => {
    const doc = videoDoc();
    let h = createHistory(doc);
    h = commit(h, applyOperation(doc, { type: "UNLINK_AUDIO", clipId: "vclip1" }));
    expect(findClip(h.present.timeline, "vclip1")?.audio.muted).toBe(true);
    h = undo(h);
    expect(findClip(h.present.timeline, "vclip1")?.audio.muted).toBe(false);
    expect(h.present.timeline.tracks.find((t) => t.id === "a1")?.clips).toHaveLength(0);
  });

  it("refuses image assets and locked tracks", () => {
    let doc = createEmptyNleDoc({ id: "p2", now: "2026-01-01T00:00:00.000Z" });
    doc = applyOperation(doc, {
      type: "ADD_ASSET",
      asset: {
        id: "img",
        name: "x.png",
        kind: "image",
        uri: "opfs://p2/img",
        durationSec: 5,
      },
    });
    doc = applyOperation(doc, {
      type: "ADD_CLIP",
      clip: createDefaultClip({
        id: "ic",
        assetId: "img",
        trackId: "v1",
        start: 0,
        duration: 5,
      }),
    });
    expect(planUnlinkAudio(doc, "ic")).toBeNull();
    expect(applyOperation(doc, { type: "UNLINK_AUDIO", clipId: "ic" })).toBe(doc);

    const locked = applyOperation(videoDoc(), {
      type: "SET_TRACK",
      trackId: "v1",
      patch: { locked: true },
    });
    expect(applyOperation(locked, { type: "UNLINK_AUDIO", clipId: "vclip1" })).toBe(locked);
  });

  it("refuses double unlink", () => {
    const once = applyOperation(videoDoc(), { type: "UNLINK_AUDIO", clipId: "vclip1" });
    const twice = applyOperation(once, { type: "UNLINK_AUDIO", clipId: "vclip1" });
    expect(twice.timeline.tracks.find((t) => t.id === "a1")?.clips).toHaveLength(1);
  });
});
