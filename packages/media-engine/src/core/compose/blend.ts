/** Modes de fusion CapCut-like pour compose WebGL / canvas 2D. */

export const BLEND_MODES = [
  "normal",
  "screen",
  "multiply",
  "overlay",
  "darken",
  "lighten",
  "add",
] as const;

export type BlendMode = (typeof BLEND_MODES)[number];

export function canvasCompositeForBlend(mode: string | undefined): GlobalCompositeOperation {
  switch (mode) {
    case "screen":
      return "screen";
    case "multiply":
      return "multiply";
    case "overlay":
      return "overlay";
    case "darken":
      return "darken";
    case "lighten":
      return "lighten";
    case "add":
      return "lighter";
    default:
      return "source-over";
  }
}

/** CSS filter approx pour étalonnage basique (preview). */
export function cssFilterFromColorGrade(
  g:
    | {
        temperature?: number;
        tint?: number;
        saturation?: number;
        exposure?: number;
        contrast?: number;
        vignette?: number;
        sharpen?: number;
      }
    | null
    | undefined,
): string | undefined {
  if (!g) return undefined;
  const parts: string[] = [];
  const exposure = g.exposure ?? 0;
  const contrast = 1 + (g.contrast ?? 0);
  const sat = 1 + (g.saturation ?? 0);
  if (exposure) parts.push(`brightness(${1 + exposure})`);
  if (contrast !== 1) parts.push(`contrast(${contrast})`);
  if (sat !== 1) parts.push(`saturate(${sat})`);
  const temp = g.temperature ?? 0;
  if (temp > 0.01) parts.push(`sepia(${Math.min(0.4, temp * 0.35)})`);
  if (temp < -0.01) parts.push(`hue-rotate(${temp * 40}deg)`);
  const tint = g.tint ?? 0;
  if (Math.abs(tint) > 0.01) parts.push(`hue-rotate(${tint * 25}deg)`);
  return parts.length ? parts.join(" ") : undefined;
}

/** Progression 0–1 d'une transition en fin de clip. */
export function transitionProgress(
  time: number,
  clipStart: number,
  clipDuration: number,
  transitionDurationSec: number,
): number {
  const end = clipStart + clipDuration;
  const start = end - transitionDurationSec;
  if (time < start) return 0;
  if (time >= end) return 1;
  return (time - start) / Math.max(1e-6, transitionDurationSec);
}
