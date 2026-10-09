import { describe, expect, it } from "vitest";
import { buildToneWav, handleTts, wavDurationSec } from "./ai-tts.server";

describe("TTS server", () => {
  it("builds a valid WAV header with parseable duration", () => {
    const { bytes, durationSec } = buildToneWav(1.5);
    expect(durationSec).toBeGreaterThan(1);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe("WAVE");
    expect(wavDurationSec(bytes)).toBeCloseTo(durationSec, 1);
  });

  it("returns audio without API key", async () => {
    const out = await handleTts({ text: "Bonjour Hybridator", language: "fr" });
    expect(out.contentType).toBe("audio/wav");
    expect(out.bytes.length).toBeGreaterThan(44);
    expect(out.durationSec).toBeGreaterThan(1);
    expect(wavDurationSec(out.bytes)).toBeCloseTo(out.durationSec, 1);
  });
});
