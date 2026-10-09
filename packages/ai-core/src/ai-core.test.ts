import { describe, expect, it } from "vitest";
import { analyzeTranscript } from "./analyze";
import { alignAngleOffsets, crossCorrelate } from "./audio/cross-correlate";
import { buildAutoCutOperations } from "./autocut/auto-cut";
import { detectVoiceActivity } from "./autocut/vad";
import { runAiJob } from "./job";
import { createDemoSttAdapter } from "./stt/demo-adapter";
import { createEmptyNleDoc, createDefaultClip } from "@hybridator/core-model";
import { createDemoGenerativeAiAdapter } from "./generative/demo-adapter";
import { intentsToOperations, planToOperations } from "./generative/apply-plan";

describe("analyzeTranscript", () => {
  it("detects fillers silences and repetitions from config rules", () => {
    const t = analyzeTranscript(
      {
        language: "fr",
        segments: [
          {
            id: "s1",
            speaker: "host",
            text: "bonjour euh euh monde",
            start: 0,
            end: 3,
            words: [
              { word: "bonjour", start: 0, end: 0.5, confidence: 1 },
              { word: "euh", start: 1.2, end: 1.4, confidence: 0.7 },
              { word: "euh", start: 1.5, end: 1.7, confidence: 0.7 },
              { word: "monde", start: 1.8, end: 2.3, confidence: 1 },
            ],
          },
        ],
      },
      { fillerWords: ["euh"], silenceThresholdSec: 0.5 },
    );
    expect(t.detections.fillers.length).toBe(2);
    expect(t.detections.silences.length).toBeGreaterThan(0);
    expect(t.detections.repetitions.length).toBeGreaterThan(0);
  });
});

describe("STT adapters", () => {
  it("demo adapter returns NormalizedTranscript without network", async () => {
    const stt = createDemoSttAdapter();
    const out = await stt.transcribe(
      { projectId: "p", mediaUri: "demo://a", durationSec: 20 },
      { fillerWords: ["euh", "um", "uh"], silenceThresholdSec: 0.5 },
    );
    expect(out.segments.length).toBeGreaterThan(0);
    expect(out.detections).toBeDefined();
    expect(stt.providerId).toBe("demo");
  });
});

describe("waveform sync", () => {
  it("recovers a known lag via cross-correlation", () => {
    const n = 2000;
    const a = new Float32Array(n);
    for (let i = 0; i < n; i++) a[i] = Math.sin(i / 17);
    const lag = 40;
    const b = new Float32Array(n);
    for (let i = 0; i < n; i++) b[i] = i >= lag ? a[i - lag]! : 0;
    const result = crossCorrelate(a, b, 100);
    expect(result.lag).toBe(lag);
    const offsets = alignAngleOffsets(
      [
        { angleId: "wide", samples: a },
        { angleId: "host", samples: b },
      ],
      100,
    );
    expect(offsets.find((o) => o.angleId === "host")?.offsetSec).toBeCloseTo(-lag / 100, 3);
  });
});

describe("auto-cut", () => {
  it("cuts to speaker and uses wide angle on overlap with minShot", () => {
    const ops = buildAutoCutOperations({
      wideAngleId: "wide",
      minShotSec: 1,
      timelineEnd: 10,
      angles: [
        { angleId: "host", ranges: [{ start: 0, end: 3 }] },
        { angleId: "guest", ranges: [{ start: 2.5, end: 6 }] },
        { angleId: "wide", ranges: [] },
      ],
    });
    expect(ops.some((o) => o.type === "SWITCH_CAMERA_ANGLE" && o.angleId === "host")).toBe(true);
    expect(ops.some((o) => o.type === "SWITCH_CAMERA_ANGLE" && o.angleId === "wide")).toBe(true);
  });

  it("detects voice activity on loud frames", () => {
    const sr = 1000;
    const samples = new Float32Array(sr * 2);
    for (let i = 500; i < 1200; i++) samples[i] = 0.5;
    const ranges = detectVoiceActivity(samples, sr, { threshold: 0.1, frameMs: 20 });
    expect(ranges.length).toBeGreaterThan(0);
    expect(ranges[0]!.start).toBeGreaterThan(0.4);
  });
});

describe("runAiJob", () => {
  it("keeps failure isolated and still records after()", async () => {
    const calls: string[] = [];
    const result = await runAiJob({
      before: () => {
        calls.push("before");
      },
      run: async () => {
        throw new Error("boom");
      },
      after: (r) => {
        calls.push(r.ok ? "ok" : "fail");
      },
    });
    expect(result.ok).toBe(false);
    expect(calls).toEqual(["before", "fail"]);
  });
});

describe("generative AI", () => {
  it("demo plan includes video voice and captions for a 30s prompt", async () => {
    const ai = createDemoGenerativeAiAdapter();
    const plan = await ai.generateProject({
      projectId: "p1",
      prompt: "Crée une vidéo explicative de 30 secondes avec voix off et musique épique",
    });
    expect(plan.durationSec).toBe(30);
    expect(plan.clips.some((c) => c.trackHint === "v1")).toBe(true);
    expect(plan.clips.some((c) => c.trackHint === "a1")).toBe(true);
    expect(plan.clips.some((c) => c.trackHint === "a2")).toBe(true);
    expect(plan.clips.some((c) => c.trackHint === "t1")).toBe(true);
    const applied = planToOperations(plan);
    expect(applied.operations.length).toBeGreaterThan(4);
    expect(applied.operations.filter((o) => o.type === "ADD_CLIP").length).toBe(plan.clips.length);
  });

  it("contextual edit maps instruction to intents and ops", async () => {
    const ai = createDemoGenerativeAiAdapter();
    const edit = await ai.editClip({
      projectId: "p1",
      clipId: "c1",
      instruction: "Applique un flou et une transition fondu, isole ma voix",
    });
    expect(edit.intents.some((i) => i.type === "add_effect")).toBe(true);
    expect(edit.intents.some((i) => i.type === "set_transition")).toBe(true);
    expect(edit.intents.some((i) => i.type === "noise_reduction")).toBe(true);

    const doc = createEmptyNleDoc({ id: "p1" });
    const clip = createDefaultClip({
      id: "c1",
      assetId: "a",
      trackId: "v1",
      start: 0,
      duration: 5,
    });
    doc.assets.push({
      id: "a",
      name: "clip",
      kind: "video",
      uri: "demo://a",
      durationSec: 5,
    });
    doc.timeline.tracks = doc.timeline.tracks.map((t) =>
      t.id === "v1" ? { ...t, clips: [clip] } : t,
    );
    const ops = intentsToOperations(doc, "c1", edit);
    expect(ops.some((o) => o.type === "ADD_EFFECT")).toBe(true);
    expect(ops.some((o) => o.type === "SET_TRANSITION")).toBe(true);
    expect(ops.some((o) => o.type === "UPDATE_CLIP")).toBe(true);
  });
});
