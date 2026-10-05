import { describe, expect, it } from "vitest";
import { ALL_TRACKS, type EditorDoc } from "./types";
import {
  createMemoryFileSystemAdapter,
  createMemoryMediaProcessAdapter,
  createMemorySyncAdapter,
} from "./fakes";

function sampleDoc(id = "proj-1"): EditorDoc {
  return {
    id,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    settings: {
      name: "Sample",
      width: 1920,
      height: 1080,
      fps: 30,
      aspectRatio: "16:9",
      sampleRate: 48000,
    },
    assets: [],
    timeline: { tracks: [] },
    transcript: {
      language: "fr",
      duration: 0,
      segments: [],
      detections: { silences: [], fillers: [], repetitions: [], speechTics: [] },
      metrics: { totalPotentiallySavedTime: 0 },
    },
    removedRanges: [],
    operations: [],
  };
}

describe("core-model EditorDoc", () => {
  it("round-trips through JSON without losing contract fields", () => {
    const doc = sampleDoc();
    doc.operations.push({
      type: "REMOVE_RANGE",
      trackId: ALL_TRACKS,
      start: 0,
      end: 1,
      reason: "silence",
    });
    const restored = JSON.parse(JSON.stringify(doc)) as EditorDoc;
    expect(restored).toEqual(doc);
    expect(restored.operations[0]?.type).toBe("REMOVE_RANGE");
  });
});

describe("memory adapters", () => {
  it("persists projects in memory", async () => {
    const fs = createMemoryFileSystemAdapter();
    const doc = sampleDoc();
    await fs.writeProject(doc);
    expect(await fs.listProjects()).toEqual([
      { id: doc.id, name: "Sample", updatedAt: doc.updatedAt },
    ]);
    expect(await fs.readProject(doc.id)).toEqual(doc);
    await fs.deleteProject(doc.id);
    expect(await fs.readProject(doc.id)).toBeNull();
  });

  it("renders immediately and reports sync status", async () => {
    const media = createMemoryMediaProcessAdapter();
    const sync = createMemorySyncAdapter("local-only");
    const ratios: number[] = [];
    const result = await media.render(
      { projectId: "p", presetId: "youtube", durationSec: 10, watermark: false },
      (r) => ratios.push(r),
    );
    expect(result.ok).toBe(true);
    expect(ratios).toEqual([1]);
    expect(sync.status()).toBe("local-only");
  });
});
