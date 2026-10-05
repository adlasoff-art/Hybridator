import { describe, expect, it } from "vitest";
import { createNativeFfmpegAdapter } from "./adapters/native-ffmpeg";
import { createTauriFileSystemAdapter } from "./adapters/tauri-fs";
import type { EditorDoc } from "@hybridator/core-model";

function sampleDoc(id = "p1"): EditorDoc {
  return {
    id,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    settings: {
      name: "Projet natif",
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

describe("native adapters (Phase 6 stubs)", () => {
  it("tauri-fs memory fallback lists and stores projects", async () => {
    const fs = createTauriFileSystemAdapter();
    expect(fs.runtime).toBe("tauri-fs");
    await fs.writeProject(sampleDoc());
    const list = await fs.listProjects();
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe("Projet natif");
    expect(await fs.readProject("p1")).not.toBeNull();
  });

  it("native-ffmpeg stub completes a render job", async () => {
    const media = createNativeFfmpegAdapter();
    expect(media.runtime).toBe("native-ffmpeg");
    const ratios: number[] = [];
    const result = await media.render(
      { projectId: "p", presetId: "youtube", durationSec: 3, watermark: false },
      (r) => ratios.push(r),
    );
    expect(result.ok).toBe(true);
    expect(result.fileName).toContain("native");
    expect(ratios.at(-1)).toBe(1);
  });
});
