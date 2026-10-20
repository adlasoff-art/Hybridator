/**
 * Cache LRU de frames pour scrub CapCut-like.
 * Rempli via HTMLVideoElement / createImageBitmap (WebCodecs VideoDecoder optionnel plus tard).
 */

export interface FrameCacheStats {
  hits: number;
  misses: number;
  size: number;
}

export class ScrubFrameCache {
  private cache = new Map<string, ImageBitmap>();
  private order: string[] = [];
  private hits = 0;
  private misses = 0;

  constructor(
    private readonly maxEntries = 64,
    /** Quantification temporelle (s) — 0.1 ≈ 10 fps de cache. */
    private readonly quantizeSec = 0.1,
  ) {}

  key(assetId: string, timeSec: number): string {
    const q = Math.max(0.02, this.quantizeSec);
    const bucket = Math.round(Math.max(0, timeSec) / q);
    return `${assetId}@${bucket}`;
  }

  get(assetId: string, timeSec: number): ImageBitmap | undefined {
    const k = this.key(assetId, timeSec);
    const bmp = this.cache.get(k);
    if (bmp) {
      this.hits += 1;
      // LRU touch
      this.order = this.order.filter((x) => x !== k);
      this.order.push(k);
      return bmp;
    }
    this.misses += 1;
    return undefined;
  }

  has(assetId: string, timeSec: number): boolean {
    return this.cache.has(this.key(assetId, timeSec));
  }

  /** Enregistre un bitmap déjà créé. */
  put(assetId: string, timeSec: number, bitmap: ImageBitmap): void {
    const k = this.key(assetId, timeSec);
    const prev = this.cache.get(k);
    if (prev && prev !== bitmap) prev.close();
    this.cache.set(k, bitmap);
    this.order = this.order.filter((x) => x !== k);
    this.order.push(k);
    this.evict();
  }

  /**
   * Capture la frame courante d'une vidéo (déjà seekée) dans le cache.
   * Utilise createImageBitmap quand dispo.
   */
  async captureFromVideo(
    video: HTMLVideoElement,
    assetId: string,
    timeSec: number,
  ): Promise<ImageBitmap | null> {
    if (typeof createImageBitmap !== "function") return null;
    if (video.readyState < 2) return null;
    try {
      const bmp = await createImageBitmap(video);
      this.put(assetId, timeSec, bmp);
      return bmp;
    } catch {
      return null;
    }
  }

  /** Seek vidéo + capture (pour préchauffage scrub). */
  async seekAndCapture(
    video: HTMLVideoElement,
    assetId: string,
    timeSec: number,
  ): Promise<ImageBitmap | null> {
    const cached = this.get(assetId, timeSec);
    if (cached) return cached;
    // get() a compté un miss — on ne double-compte pas
    this.misses = Math.max(0, this.misses - 1);
    const target = Math.max(0, timeSec);
    if (Math.abs(video.currentTime - target) > 0.04) {
      await new Promise<void>((resolve) => {
        const done = () => {
          video.removeEventListener("seeked", done);
          resolve();
        };
        video.addEventListener("seeked", done);
        try {
          video.currentTime = target;
        } catch {
          resolve();
        }
        setTimeout(resolve, 200);
      });
    }
    return this.captureFromVideo(video, assetId, timeSec);
  }

  stats(): FrameCacheStats {
    return { hits: this.hits, misses: this.misses, size: this.cache.size };
  }

  clear(): void {
    for (const bmp of this.cache.values()) bmp.close();
    this.cache.clear();
    this.order = [];
    this.hits = 0;
    this.misses = 0;
  }

  private evict(): void {
    while (this.order.length > this.maxEntries) {
      const oldest = this.order.shift();
      if (!oldest) break;
      const bmp = this.cache.get(oldest);
      bmp?.close();
      this.cache.delete(oldest);
    }
  }
}

/** True si l'environnement peut peupler le cache (navigateur). */
export function frameCacheSupported(): boolean {
  return typeof createImageBitmap === "function" && typeof HTMLVideoElement !== "undefined";
}
