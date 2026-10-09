import type { ClipMask } from "@hybridator/core-model";

/** Applique un masque géométrique sur un contexte 2D (clip path). */
export function applyClipMask(
  ctx: CanvasRenderingContext2D,
  mask: ClipMask,
  width: number,
  height: number,
): void {
  const x = mask.x * width;
  const y = mask.y * height;
  const w = mask.width * width;
  const h = mask.height * height;
  ctx.beginPath();
  if (mask.shape === "circle") {
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  } else if (mask.shape === "line") {
    ctx.rect(x, y + h * 0.45, w, h * 0.1);
  } else if (mask.shape === "filmstrip") {
    const slits = 6;
    for (let i = 0; i < slits; i++) {
      const sx = x + (i / slits) * w;
      ctx.rect(sx + 2, y, w / slits - 4, h);
    }
  } else {
    ctx.rect(x, y, w, h);
  }
  if (mask.invert) {
    ctx.rect(0, 0, width, height);
    ctx.clip("evenodd");
  } else {
    ctx.clip();
  }
}

export function defaultMask(shape: ClipMask["shape"] = "rect"): ClipMask {
  return {
    shape,
    feather: 0.05,
    invert: false,
    x: 0.1,
    y: 0.1,
    width: 0.8,
    height: 0.8,
  };
}
