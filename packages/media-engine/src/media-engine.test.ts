import { describe, expect, it } from "vitest";
import type { EditorDoc } from "@hybridator/core-model";
import { createHybridMediaProcessAdapter } from "./adapters/cloud-render";
import { createWasmMediaProcessAdapter } from "./adapters/wasm-render";
import { PreviewClock } from "./preview-clock";
import { buildProxyFrame, proxyColor } from "./proxy";

function sampleDoc(): EditorDoc {
  return {
    id: "p",
    createdAt: "",
    updatedAt: "",
    settings: {
      name: "t",
      width: 1920,
      height: 1080,
      fps: 30,
      aspectRatio: "16:9",
      sampleRate: 48000,
    },
    assets: [
      { id: "cam", name: "Cam 1", kind: "video", uri: "demo://c", durationSec: 10, angle: 1 },
    ],
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
              id: "c1",
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

describe("proxy frames", () => {
  it("builds a deterministic proxy for scrubbing", () => {
    const f = buildProxyFrame(sampleDoc(), 1.5, { width: 640, height: 360 });
    expect(f.label).toContain("CAM");
    expect(f.color).toBe(proxyColor("cam"));
  });
});

describe("PreviewClock", () => {
  it("advances while playing and reports fps ema", () => {
    const c = new PreviewClock();
    c.seek(0);
    c.play();
    c.tick(1000);
    c.tick(1016);
    expect(c.time).toBeGreaterThan(0);
    expect(c.fps).toBeGreaterThan(0);
    c.pause();
    const t = c.time;
    c.tick(1100);
    expect(c.time).toBeCloseTo(t);
  });
});

describe("wasm render adapter", () => {
  it("completes a light job with progress", async () => {
    const adapter = createWasmMediaProcessAdapter();
    const ratios: number[] = [];
    const result = await adapter.render(
      { projectId: "p", presetId: "youtube", durationSec: 5, watermark: false },
      (r) => ratios.push(r),
    );
    expect(result.ok).toBe(true);
    expect(ratios.at(-1)).toBe(1);
  });
});

describe("hybrid media adapter", () => {
  it("routes short jobs to wasm and long jobs to cloud", async () => {
    const calls: string[] = [];
    const wasm = createWasmMediaProcessAdapter();
    const cloud = {
      runtime: "cloud" as const,
      async render(
        job: { projectId: string; presetId: string; durationSec: number; watermark: boolean },
        onProgress: (r: number) => void,
      ) {
        calls.push("cloud");
        onProgress(1);
        return { ok: true as const, fileName: `${job.projectId}-cloud.mp4` };
      },
    };
    const hybrid = createHybridMediaProcessAdapter(
      {
        ...wasm,
        async render(job, onProgress, signal) {
          calls.push("wasm");
          return wasm.render(job, onProgress, signal);
        },
      },
      cloud,
      60,
    );
    await hybrid.render(
      { projectId: "p", presetId: "yt", durationSec: 10, watermark: false },
      () => undefined,
    );
    await hybrid.render(
      { projectId: "p", presetId: "yt", durationSec: 90, watermark: false },
      () => undefined,
    );
    expect(calls).toEqual(["wasm", "cloud"]);
  });
});
