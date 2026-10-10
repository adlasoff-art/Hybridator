import type { EditorDoc } from "@hybridator/core-model";
import { buildProxyFrame } from "../proxy";
import { cssFilterFromColorGrade } from "../core/compose/blend";

/** Instants de frame pour un export à `fps` sur `[0, durationSec]`. */
export function frameTimestamps(durationSec: number, fps: number): number[] {
  const safeFps = Math.max(1, fps);
  const n = Math.max(1, Math.ceil(Math.max(0, durationSec) * safeFps));
  const times: number[] = [];
  for (let i = 0; i < n; i++) {
    times.push(Math.min(durationSec, i / safeFps));
  }
  return times;
}

export interface ComposeFrameOptions {
  width: number;
  height: number;
  watermark?: boolean;
  brandName?: string;
  /** Image/vidéo déjà seekée pour l'instant courant (sinon proxy coloré). */
  media?: CanvasImageSource | null;
}

/**
 * Peint une frame d'export sur un canvas 2D (proxy ou média fourni).
 * Pure côté logique timeline ; côté DOM via CanvasRenderingContext2D.
 */
export function paintExportFrame(
  ctx: CanvasRenderingContext2D,
  doc: EditorDoc,
  time: number,
  opts: ComposeFrameOptions,
): void {
  const { width, height } = opts;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, width, height);

  const proxy = buildProxyFrame(doc, time, { width, height });
  const vTracks = doc.timeline.tracks.filter((t) => t.kind === "video" && !t.hidden);
  const track = vTracks.find((t) => t.id === "v1") ?? vTracks[vTracks.length - 1];
  const clip = track?.clips.find(
    (c) => time >= c.start && time < c.start + c.duration && c.enabled,
  );

  if (opts.media) {
    ctx.save();
    if (clip?.colorGrade) {
      ctx.filter = cssFilterFromColorGrade(clip.colorGrade) ?? "none";
    }
    const opacity = clip?.transform.opacity ?? 1;
    ctx.globalAlpha = opacity;
    drawCover(ctx, opts.media, width, height, clip?.crop);
    ctx.restore();
  } else {
    ctx.fillStyle = proxy.color;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `${Math.max(14, Math.round(height / 18))}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText(proxy.label, width / 2, height / 2);
  }

  const t1 = doc.timeline.tracks.find((t) => t.id === "t1" || t.role === "captions");
  const textClip = t1?.clips.find(
    (c) => time >= c.start && time < c.start + c.duration && c.enabled,
  );
  if (textClip) {
    const content =
      textClip.label ??
      (textClip.effects.find((e) => e.type === "text-style")?.params["content"] as
        string | undefined);
    if (content) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(width * 0.1, height * 0.78, width * 0.8, height * 0.12);
      ctx.fillStyle = "#fff";
      ctx.font = `600 ${Math.max(16, Math.round(height / 22))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(content, width / 2, height * 0.86, width * 0.75);
    }
  }

  if (opts.watermark && opts.brandName) {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = `${Math.max(10, Math.round(height / 40))}px monospace`;
    ctx.textAlign = "right";
    ctx.fillText(opts.brandName.toUpperCase(), width - 16, height - 16);
  }
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  media: CanvasImageSource,
  width: number,
  height: number,
  crop?: { top: number; right: number; bottom: number; left: number },
): void {
  const mw =
    "videoWidth" in media && typeof media.videoWidth === "number" && media.videoWidth > 0
      ? media.videoWidth
      : "naturalWidth" in media && typeof media.naturalWidth === "number" && media.naturalWidth > 0
        ? media.naturalWidth
        : "width" in media && typeof media.width === "number"
          ? media.width
          : width;
  const mh =
    "videoHeight" in media && typeof media.videoHeight === "number" && media.videoHeight > 0
      ? media.videoHeight
      : "naturalHeight" in media &&
          typeof media.naturalHeight === "number" &&
          media.naturalHeight > 0
        ? media.naturalHeight
        : "height" in media && typeof media.height === "number"
          ? media.height
          : height;

  const sx = (crop?.left ?? 0) * mw;
  const sy = (crop?.top ?? 0) * mh;
  const sw = Math.max(1, mw * (1 - (crop?.left ?? 0) - (crop?.right ?? 0)));
  const sh = Math.max(1, mh * (1 - (crop?.top ?? 0) - (crop?.bottom ?? 0)));
  const scale = Math.max(width / sw, height / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  const dx = (width - dw) / 2;
  const dy = (height - dh) / 2;
  ctx.drawImage(media, sx, sy, sw, sh, dx, dy, dw, dh);
}

/** Temps source à lire pour un clip (prend en charge reverse). */
export function sourceTimeAt(
  clip: {
    start: number;
    duration: number;
    sourceIn: number;
    sourceOut: number;
    speed: number;
    reversed?: boolean | undefined;
  },
  time: number,
): number {
  const local = Math.max(0, Math.min(clip.duration, time - clip.start));
  if (clip.reversed) {
    return clip.sourceOut - local * clip.speed;
  }
  return clip.sourceIn + local * clip.speed;
}
