import { describe, expect, it } from "vitest";
import { applyLutToRgba, buildPresetLut, parseCubeLut } from "./lut";
import { applyChromaKeyToRgba } from "./chroma";

describe("lut + chroma", () => {
  it("parses a minimal .cube and applies trilinear", () => {
    const size = 2;
    const lines = ['TITLE "Test"', `LUT_3D_SIZE ${size}`];
    for (let b = 0; b < size; b++) {
      for (let g = 0; g < size; g++) {
        for (let r = 0; r < size; r++) {
          lines.push(`${r} ${g} ${b}`);
        }
      }
    }
    const lut = parseCubeLut(lines.join("\n"));
    expect(lut.size).toBe(2);
    expect(lut.name).toBe("Test");
    expect(lut.data).toHaveLength(2 * 2 * 2 * 3);

    const px = new Uint8ClampedArray([255, 0, 0, 255]);
    applyLutToRgba(px, lut);
    expect(px[0]).toBeGreaterThan(200);
  });

  it("builds preset LUTs", () => {
    const warm = buildPresetLut("warm", 4);
    expect(warm.data.length).toBe(4 * 4 * 4 * 3);
  });

  it("keys out green pixels", () => {
    const px = new Uint8ClampedArray([
      0,
      255,
      0,
      255, // green
      255,
      0,
      0,
      255, // red
    ]);
    applyChromaKeyToRgba(px, { hue: 120, tolerance: 0.4, softness: 0.1 });
    expect(px[3]).toBe(0);
    expect(px[7]).toBe(255);
  });
});
