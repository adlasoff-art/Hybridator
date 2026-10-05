import type { EditorDoc } from "@hybridator/core-model";
import { PreviewClock } from "./preview-clock";
import { buildProxyFrame, type ProxyFrame } from "./proxy";

export interface PreviewEngineOptions {
  width?: number;
  height?: number;
  /** Callback chaque frame (proxy ou bitmap WebCodecs). */
  onFrame?: (frame: ProxyFrame, stats: { fps: number; avDriftMs: number }) => void;
}

type DrawTarget = OffscreenCanvas | HTMLCanvasElement;

/**
 * Aperçu temps réel : boucle rAF ~60 fps, proxys pour scrubbing,
 * OffscreenCanvas quand disponible. WebCodecs branchable sans changer l'API.
 */
export class PreviewEngine {
  private doc: EditorDoc | null = null;
  private clock = new PreviewClock();
  private raf = 0;
  private running = false;
  private width: number;
  private height: number;
  private onFrame?: PreviewEngineOptions["onFrame"];
  private canvas: DrawTarget | null = null;
  private ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null;
  /** Cache de bitmaps proxy (assetId → ImageBitmap optionnel). */
  private proxyBitmaps = new Map<string, ImageBitmap>();

  constructor(options: PreviewEngineOptions = {}) {
    this.width = options.width ?? 1280;
    this.height = options.height ?? 720;
    this.onFrame = options.onFrame;
  }

  attachCanvas(canvas: DrawTarget): void {
    this.canvas = canvas;
    if ("width" in canvas) {
      canvas.width = this.width;
      canvas.height = this.height;
    }
    this.ctx = canvas.getContext("2d") as typeof this.ctx;
  }

  setDoc(doc: EditorDoc): void {
    this.doc = doc;
  }

  seek(time: number): void {
    this.clock.seek(time);
    this.paint(time);
  }

  play(): void {
    this.clock.play();
    this.ensureLoop();
  }

  pause(): void {
    this.clock.pause();
  }

  get time(): number {
    return this.clock.time;
  }

  get stats(): { fps: number; avDriftMs: number; playing: boolean } {
    return {
      fps: this.clock.fps,
      avDriftMs: this.clock.avDriftMs,
      playing: this.clock.isPlaying,
    };
  }

  dispose(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    for (const bmp of this.proxyBitmaps.values()) bmp.close();
    this.proxyBitmaps.clear();
  }

  private ensureLoop(): void {
    if (this.running) return;
    this.running = true;
    const loop = (now: number) => {
      if (!this.running) return;
      const t = this.clock.tick(now);
      this.paint(t);
      if (this.clock.isPlaying) this.raf = requestAnimationFrame(loop);
      else this.running = false;
    };
    this.raf = requestAnimationFrame(loop);
  }

  private paint(time: number): void {
    if (!this.doc) return;
    const frame = buildProxyFrame(this.doc, time, { width: this.width, height: this.height });
    const ctx = this.ctx;
    if (ctx) {
      ctx.fillStyle = frame.color;
      ctx.fillRect(0, 0, this.width, this.height);
      // Grille proxy (lisibilité scrubbing)
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      for (let x = 0; x < this.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.height);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, this.height * 0.42, this.width, this.height * 0.16);
      ctx.fillStyle = "#f4f6f5";
      ctx.font = `700 ${Math.floor(this.height / 12)}px system-ui,sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(frame.label, this.width / 2, this.height / 2);

      // Timecode burn-in
      ctx.font = `500 ${Math.floor(this.height / 28)}px monospace`;
      ctx.textAlign = "left";
      ctx.fillText(time.toFixed(2) + "s", 16, 28);
    }
    this.onFrame?.(frame, { fps: this.clock.fps, avDriftMs: this.clock.avDriftMs });
  }
}

/** Préfère OffscreenCanvas quand le navigateur le permet. */
export function createPreviewSurface(
  width: number,
  height: number,
): { canvas: DrawTarget; transferControlToOffscreen?: () => OffscreenCanvas } {
  if (typeof OffscreenCanvas !== "undefined") {
    return { canvas: new OffscreenCanvas(width, height) };
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return { canvas };
}
