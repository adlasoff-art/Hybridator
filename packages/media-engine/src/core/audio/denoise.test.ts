import { describe, expect, it } from "vitest";
import { createStubDenoiseAdapter, pcmRms } from "./denoise";

describe("denoise stub", () => {
  it("reduces low-level noise energy", () => {
    const sr = 48_000;
    const samples = new Float32Array(sr);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = (Math.random() * 2 - 1) * 0.01;
    }
    const adapter = createStubDenoiseAdapter();
    const out = adapter.processPcm(samples, sr, 0.9);
    expect(adapter.runtime).toBe("stub");
    expect(pcmRms(out)).toBeLessThan(pcmRms(samples));
  });

  it("is near-identity at amount 0", () => {
    const samples = new Float32Array([0.5, -0.5, 0.25]);
    const out = createStubDenoiseAdapter().processPcm(samples, 48_000, 0);
    expect([...out]).toEqual([...samples]);
  });
});
