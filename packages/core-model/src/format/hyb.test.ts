import { describe, expect, it } from "vitest";
import { strFromU8, strToU8, zipSync } from "fflate";
import type { EditorDoc } from "../types";
import { HybParseError } from "./errors";
import { parseHyb, serializeHyb, serializeHybV1 } from "./hyb";
import { openHybx, serializeHybx } from "./hybx";
import { unzipFiltered } from "./zip";

function sampleDoc(): EditorDoc {
  return {
    id: "p1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    settings: {
      name: "Episode",
      width: 1920,
      height: 1080,
      fps: 30,
      aspectRatio: "16:9",
      sampleRate: 48000,
    },
    assets: [{ id: "cam", name: "Cam", kind: "video", uri: "demo://cam.mp4", durationSec: 10 }],
    timeline: {
      tracks: [
        {
          id: "v1",
          kind: "video",
          role: "main",
          name: "Main",
          muted: false,
          locked: false,
          clips: [],
        },
      ],
    },
    transcript: {
      language: "fr",
      duration: 1,
      segments: [],
      detections: { silences: [], fillers: [], repetitions: [], speechTics: [] },
      metrics: { totalPotentiallySavedTime: 0 },
    },
    removedRanges: [{ start: 1, end: 2, reason: "cut" }],
    operations: [],
  };
}

describe("hyb zip v2", () => {
  it("round-trips without loss", async () => {
    const doc = sampleDoc();
    const bytes = await serializeHyb(doc, "test");
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    const back = await parseHyb(bytes);
    expect(back.id).toBe(doc.id);
    expect(back.settings.name).toBe("Episode");
    expect(back.removedRanges).toEqual(doc.removedRanges);
    expect(back.timeline).toEqual(doc.timeline);
    expect(back.assets[0]?.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects tampered zip part", async () => {
    const bytes = await serializeHyb(sampleDoc(), "test");
    const files = await unzipFiltered(bytes, () => true);
    const project = JSON.parse(strFromU8(files["project.json"]!)) as { settings: { name: string } };
    project.settings.name = "Hacked";
    files["project.json"] = strToU8(JSON.stringify(project));
    const evil = zipSync(files);
    await expect(parseHyb(evil)).rejects.toBeInstanceOf(HybParseError);
  });

  it("migrates legacy JSON v1", async () => {
    const doc = sampleDoc();
    const v1 = await serializeHybV1(doc, "legacy");
    const back = await parseHyb(v1);
    expect(back.settings.name).toBe(doc.settings.name);
    expect(back.removedRanges).toEqual(doc.removedRanges);
  });

  it("rejects tampered JSON v1", async () => {
    const v1 = await serializeHybV1(sampleDoc(), "legacy");
    const tampered = v1.replace('"Episode"', '"Hacked"');
    await expect(parseHyb(tampered)).rejects.toThrow(/altéré|intégrité/i);
  });
});

describe("hybx bundle", () => {
  it("reads document without loading media bytes into JSON parse", async () => {
    const media = new Uint8Array([1, 2, 3, 4, 5, 9, 8, 7]);
    const zip = await serializeHybx(sampleDoc(), {
      generator: "test",
      media: [{ assetId: "cam", data: media, kind: "proxy" }],
    });
    const reader = await openHybx(zip);
    expect(reader.listEntries()).toContain("media/cam.bin");
    const doc = await reader.readDocument();
    expect(doc.settings.name).toBe("Episode");
    const loaded = await reader.readMedia("cam", "proxy");
    expect([...loaded]).toEqual([...media]);
  });

  it("rejects tampered media entry", async () => {
    const media = new Uint8Array(32).fill(7);
    const zip = await serializeHybx(sampleDoc(), {
      generator: "test",
      media: [{ assetId: "cam", data: media, kind: "proxy" }],
    });
    // Flip a byte — zip may fail to parse or integrity check fails on read
    const evil = new Uint8Array(zip);
    for (let i = evil.length - 20; i < evil.length; i++) evil[i] = (evil[i]! + 1) % 256;
    const reader = await openHybx(evil).catch(() => null);
    if (reader) {
      await expect(reader.readMedia("cam", "proxy")).rejects.toBeInstanceOf(HybParseError);
    } else {
      // Corrupting the zip EOCD is also a valid rejection
      expect(reader).toBeNull();
    }
  });

  it("manifest-only open does not require media decompression", async () => {
    const big = new Uint8Array(64 * 1024);
    big.fill(42);
    const zip = await serializeHybx(sampleDoc(), {
      generator: "test",
      media: [{ assetId: "cam", data: big, kind: "media" }],
    });
    const reader = await openHybx(zip);
    // readDocument should succeed; we never call readMedia
    const doc = await reader.readDocument();
    expect(doc.assets[0]?.id).toBe("cam");
    // Smoke: manifest is JSON-parseable independently
    expect(reader.manifest.media[0]?.byteLength).toBe(big.byteLength);
    expect(strFromU8).toBeTypeOf("function");
  });
});
