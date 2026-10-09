import { describe, expect, it } from "vitest";
import {
  computeWaveformPeaks,
  deserializeWaveformPeaks,
  serializeWaveformPeaks,
  volumeAtTime,
  sampleKeyframeValue,
} from "./waveform";

function fakeBuffer(samples: number[], sampleRate = 1000): AudioBuffer {
  const data = new Float32Array(samples);
  return {
    duration: samples.length / sampleRate,
    length: samples.length,
    numberOfChannels: 1,
    sampleRate,
    getChannelData: () => data,
  } as unknown as AudioBuffer;
}

describe("waveform peaks", () => {
  it("computes real min/max buckets from buffer", () => {
    const samples = Array.from({ length: 1000 }, (_, i) => Math.sin((i / 1000) * Math.PI * 2));
    const peaks = computeWaveformPeaks(fakeBuffer(samples), { peaksPerSec: 10 });
    expect(peaks.peaks.length).toBe(20);
    expect(Math.min(...peaks.peaks)).toBeLessThan(-0.5);
    expect(Math.max(...peaks.peaks)).toBeGreaterThan(0.5);
  });

  it("round-trips serialization", () => {
    const peaks = computeWaveformPeaks(
      fakeBuffer(Array.from({ length: 200 }, (_, i) => (i % 2 === 0 ? 0.5 : -0.5))),
      { peaksPerSec: 20 },
    );
    const again = deserializeWaveformPeaks(serializeWaveformPeaks(peaks));
    expect(again.peaksPerSec).toBe(peaks.peaksPerSec);
    expect(again.peaks.length).toBe(peaks.peaks.length);
    expect(again.peaks[0]).toBeCloseTo(peaks.peaks[0]!);
  });

  it("applies fade envelopes and keyframes", () => {
    expect(volumeAtTime(1, 4, 0, 1, 0)).toBeCloseTo(0);
    expect(volumeAtTime(1, 4, 0.5, 1, 0)).toBeCloseTo(0.5);
    expect(volumeAtTime(1, 4, 3.5, 0, 1)).toBeCloseTo(0.5);
    expect(
      sampleKeyframeValue(
        [
          { timeSec: 0, value: 0 },
          { timeSec: 2, value: 1 },
        ],
        1,
        0.5,
      ),
    ).toBeCloseTo(0.5);
  });
});
