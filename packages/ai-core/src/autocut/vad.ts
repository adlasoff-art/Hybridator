export interface TimeRange {
  start: number;
  end: number;
}

/**
 * VAD énergie simple (RMS par trame). Suffisant pour l'auto-cut Phase 3 ;
 * remplacé plus tard par un modèle plus robuste sans changer l'API.
 */
export function detectVoiceActivity(
  samples: Float32Array,
  sampleRate: number,
  options: { frameMs?: number; threshold?: number; minSpeechSec?: number } = {},
): TimeRange[] {
  const frameMs = options.frameMs ?? 30;
  const threshold = options.threshold ?? 0.02;
  const minSpeechSec = options.minSpeechSec ?? 0.12;
  const frameSize = Math.max(1, Math.floor((sampleRate * frameMs) / 1000));
  const active: boolean[] = [];

  for (let i = 0; i + frameSize <= samples.length; i += frameSize) {
    let sum = 0;
    for (let j = 0; j < frameSize; j++) {
      const v = samples[i + j]!;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / frameSize);
    active.push(rms >= threshold);
  }

  const ranges: TimeRange[] = [];
  let startFrame: number | null = null;
  for (let f = 0; f <= active.length; f++) {
    const on = f < active.length ? active[f]! : false;
    if (on && startFrame === null) startFrame = f;
    if (!on && startFrame !== null) {
      const start = (startFrame * frameSize) / sampleRate;
      const end = (f * frameSize) / sampleRate;
      if (end - start >= minSpeechSec) ranges.push({ start, end });
      startFrame = null;
    }
  }
  return ranges;
}
