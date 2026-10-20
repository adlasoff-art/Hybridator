/** Chroma key CapCut — suppression d'une teinte (fond vert/bleu) sur buffer RGBA. */

export interface ChromaKeyParams {
  /** Teinte cible en degrés 0–360 (vert ≈ 120). */
  hue: number;
  /** Tolérance 0–1. */
  tolerance: number;
  /** Adoucissement du bord 0–1. */
  softness?: number;
  /** Ombre / spill reduction 0–1. */
  spill?: number;
}

/** Applique un chroma key in-place (alpha). */
export function applyChromaKeyToRgba(
  pixels: Uint8ClampedArray | Uint8Array,
  params: ChromaKeyParams,
): void {
  const tol = Math.max(0.02, Math.min(1, params.tolerance));
  const soft = Math.max(0.01, params.softness ?? tol * 0.5);
  const spill = Math.max(0, Math.min(1, params.spill ?? 0.15));
  const target = ((params.hue % 360) + 360) % 360;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i]! / 255;
    const g = pixels[i + 1]! / 255;
    const b = pixels[i + 2]! / 255;
    const { h, s } = rgbToHsv(r, g, b);
    if (s < 0.12) continue;
    const dh = hueDistance(h, target) / 180;
    let alpha = 1;
    if (dh < tol) {
      alpha = 0;
    } else if (dh < tol + soft) {
      alpha = (dh - tol) / soft;
    }
    pixels[i + 3] = Math.round(pixels[i + 3]! * alpha);
    if (alpha < 1 && spill > 0) {
      // Réduit le spill vert/bleu restant
      const spillAmt = (1 - alpha) * spill;
      if (target > 80 && target < 160) {
        pixels[i + 1] = Math.round(pixels[i + 1]! * (1 - spillAmt * 0.6));
      } else if (target > 200 && target < 260) {
        pixels[i + 2] = Math.round(pixels[i + 2]! * (1 - spillAmt * 0.6));
      }
    }
  }
}

/** Filtre CSS approximatif pour le preview (pas de vrai trou alpha). */
export function cssApproxChromaKey(params: ChromaKeyParams): string {
  const hueShift = params.hue - 120;
  const sat = 1 + params.tolerance * 0.4;
  return `hue-rotate(${hueShift}deg) saturate(${sat}) contrast(1.05)`;
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 1e-6) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}
