/**
 * Horloge d'aperçu 60 fps avec dérive A/V mesurée.
 * L'audio (si présent) est la référence ; sinon performance.now().
 */
export class PreviewClock {
  private playing = false;
  private mediaTime = 0;
  private anchorPerf = 0;
  private audioCtx: { currentTime: number } | null = null;
  private audioAnchor = 0;
  private lastFramePerf = 0;
  private fpsEma = 60;
  private driftMs = 0;

  attachAudioContext(ctx: { currentTime: number } | null): void {
    this.audioCtx = ctx;
  }

  get time(): number {
    return this.mediaTime;
  }

  get fps(): number {
    return this.fpsEma;
  }

  get avDriftMs(): number {
    return this.driftMs;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  seek(t: number): void {
    this.mediaTime = Math.max(0, t);
    this.anchorPerf = performance.now();
    if (this.audioCtx) this.audioAnchor = this.audioCtx.currentTime;
  }

  play(): void {
    if (this.playing) return;
    this.playing = true;
    this.anchorPerf = performance.now();
    if (this.audioCtx) this.audioAnchor = this.audioCtx.currentTime;
  }

  pause(): void {
    this.playing = false;
  }

  /** À appeler chaque frame (rAF). Retourne le temps média mis à jour. */
  tick(nowPerf: number): number {
    if (this.playing) {
      if (this.audioCtx) {
        const audioElapsed = this.audioCtx.currentTime - this.audioAnchor;
        const wallElapsed = (nowPerf - this.anchorPerf) / 1000;
        this.driftMs = (wallElapsed - audioElapsed) * 1000;
        this.mediaTime += audioElapsed;
        this.audioAnchor = this.audioCtx.currentTime;
        this.anchorPerf = nowPerf;
      } else {
        const dt = (nowPerf - this.anchorPerf) / 1000;
        this.mediaTime += dt;
        this.anchorPerf = nowPerf;
        this.driftMs = 0;
      }
    }

    if (this.lastFramePerf > 0) {
      const inst = 1000 / Math.max(1, nowPerf - this.lastFramePerf);
      this.fpsEma = this.fpsEma * 0.9 + inst * 0.1;
    }
    this.lastFramePerf = nowPerf;
    return this.mediaTime;
  }
}
