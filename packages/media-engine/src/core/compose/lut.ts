import type { ClipLut } from "@hybridator/core-model";

export type { ClipLut };

/** Parse un fichier Adobe/Resolve `.cube` (LUT 3D). */
export function parseCubeLut(text: string, fallbackName = "LUT"): ClipLut {
  const lines = text.split(/\r?\n/);
  let size = 0;
  let title = fallbackName;
  const data: number[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const upper = line.toUpperCase();
    if (upper.startsWith("TITLE")) {
      const m = line.match(/TITLE\s+"?([^"]+)"?/i);
      if (m?.[1]) title = m[1].trim();
      continue;
    }
    if (upper.startsWith("LUT_3D_SIZE")) {
      const n = Number(line.split(/\s+/)[1]);
      if (Number.isFinite(n) && n >= 2 && n <= 65) size = Math.floor(n);
      continue;
    }
    if (/^[A-Z_]/.test(line)) continue; // DOMAIN_MIN, etc.
    const parts = line.split(/\s+/).map(Number);
    if (parts.length >= 3 && parts.every((x) => Number.isFinite(x))) {
      data.push(clamp01(parts[0]!), clamp01(parts[1]!), clamp01(parts[2]!));
    }
  }
  if (size < 2) {
    const n = Math.round(Math.cbrt(data.length / 3));
    size = n >= 2 ? n : 0;
  }
  const expected = size * size * size * 3;
  if (size < 2 || data.length < expected) {
    throw new Error("LUT .cube invalide ou incomplète");
  }
  return { name: title, size, data: data.slice(0, expected) };
}

/** LUT procédurale warm/cool/contrast (tests + presets UI). */
export function buildPresetLut(kind: "warm" | "cool" | "contrast", size = 8): ClipLut {
  const data: number[] = [];
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        let R = r / (size - 1);
        let G = g / (size - 1);
        let B = b / (size - 1);
        if (kind === "warm") {
          R = clamp01(R * 1.08 + 0.04);
          B = clamp01(B * 0.9);
        } else if (kind === "cool") {
          B = clamp01(B * 1.08 + 0.04);
          R = clamp01(R * 0.92);
        } else {
          R = clamp01((R - 0.5) * 1.25 + 0.5);
          G = clamp01((G - 0.5) * 1.25 + 0.5);
          B = clamp01((B - 0.5) * 1.25 + 0.5);
        }
        data.push(R, G, B);
      }
    }
  }
  return { name: kind, size, data };
}

/** Applique une LUT 3D (trilinear) sur un buffer RGBA. */
export function applyLutToRgba(pixels: Uint8ClampedArray | Uint8Array, lut: ClipLut): void {
  const n = lut.size;
  const max = n - 1;
  for (let i = 0; i < pixels.length; i += 4) {
    const r = (pixels[i]! / 255) * max;
    const g = (pixels[i + 1]! / 255) * max;
    const b = (pixels[i + 2]! / 255) * max;
    const rgb = sampleLutTrilinear(lut, r, g, b);
    pixels[i] = Math.round(rgb[0]! * 255);
    pixels[i + 1] = Math.round(rgb[1]! * 255);
    pixels[i + 2] = Math.round(rgb[2]! * 255);
  }
}

function sampleLutTrilinear(
  lut: ClipLut,
  r: number,
  g: number,
  b: number,
): [number, number, number] {
  const n = lut.size;
  const max = n - 1;
  const r0 = Math.floor(r);
  const g0 = Math.floor(g);
  const b0 = Math.floor(b);
  const r1 = Math.min(max, r0 + 1);
  const g1 = Math.min(max, g0 + 1);
  const b1 = Math.min(max, b0 + 1);
  const fr = r - r0;
  const fg = g - g0;
  const fb = b - b0;

  const c000 = lutAt(lut, r0, g0, b0);
  const c100 = lutAt(lut, r1, g0, b0);
  const c010 = lutAt(lut, r0, g1, b0);
  const c110 = lutAt(lut, r1, g1, b0);
  const c001 = lutAt(lut, r0, g0, b1);
  const c101 = lutAt(lut, r1, g0, b1);
  const c011 = lutAt(lut, r0, g1, b1);
  const c111 = lutAt(lut, r1, g1, b1);

  const c00 = lerp3(c000, c100, fr);
  const c10 = lerp3(c010, c110, fr);
  const c01 = lerp3(c001, c101, fr);
  const c11 = lerp3(c011, c111, fr);
  const c0 = lerp3(c00, c10, fg);
  const c1 = lerp3(c01, c11, fg);
  return lerp3(c0, c1, fb);
}

function lutAt(lut: ClipLut, r: number, g: number, b: number): [number, number, number] {
  const n = lut.size;
  const idx = (b * n * n + g * n + r) * 3;
  return [lut.data[idx] ?? 0, lut.data[idx + 1] ?? 0, lut.data[idx + 2] ?? 0];
}

function lerp3(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
