/**
 * Extraction de formes d'onde à partir d'un AudioBuffer (pur TS navigateur / Node avec polyfill).
 * Pas de peaks aléatoires — downsample min/max réels.
 */

export interface WaveformPeaks {
  /** Alternance min, max par bucket, plage [-1, 1]. */
  peaks: Float32Array;
  sampleRate: number;
  durationSec: number;
  peaksPerSec: number;
  channels: number;
}

export interface ComputeWaveformOptions {
  peaksPerSec?: number;
  /** Canal à visualiser ; -1 = mix down. */
  channel?: number;
}

/** Downsample un AudioBuffer vers des pics min/max. */
export function computeWaveformPeaks(
  buffer: AudioBuffer,
  options: ComputeWaveformOptions = {},
): WaveformPeaks {
  const peaksPerSec = Math.max(10, Math.min(400, options.peaksPerSec ?? 100));
  const channelOpt = options.channel ?? -1;
  const durationSec = buffer.duration;
  const bucketCount = Math.max(1, Math.ceil(durationSec * peaksPerSec));
  const peaks = new Float32Array(bucketCount * 2);
  const channels =
    channelOpt >= 0 && channelOpt < buffer.numberOfChannels
      ? [buffer.getChannelData(channelOpt)]
      : Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));

  const totalSamples = buffer.length;
  const samplesPerBucket = totalSamples / bucketCount;

  for (let b = 0; b < bucketCount; b++) {
    const start = Math.floor(b * samplesPerBucket);
    const end = Math.min(totalSamples, Math.floor((b + 1) * samplesPerBucket));
    let min = 1;
    let max = -1;
    for (let i = start; i < end; i++) {
      let sample = 0;
      for (const ch of channels) sample += ch[i] ?? 0;
      sample /= channels.length || 1;
      if (sample < min) min = sample;
      if (sample > max) max = sample;
    }
    if (end <= start) {
      min = 0;
      max = 0;
    }
    peaks[b * 2] = min;
    peaks[b * 2 + 1] = max;
  }

  return {
    peaks,
    sampleRate: buffer.sampleRate,
    durationSec,
    peaksPerSec,
    channels: buffer.numberOfChannels,
  };
}

/** Décode un ArrayBuffer média via AudioContext.decodeAudioData. */
export async function decodeAudioBuffer(
  arrayBuffer: ArrayBuffer,
  audioContext?: BaseAudioContext,
): Promise<AudioBuffer> {
  if (audioContext) {
    return audioContext.decodeAudioData(arrayBuffer.slice(0));
  }
  if (typeof AudioContext === "undefined") {
    throw new Error("AudioContext indisponible pour le décodage waveform.");
  }
  const ctx = new AudioContext();
  try {
    return await ctx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    void ctx.close?.();
  }
}

export async function computeWaveformFromArrayBuffer(
  arrayBuffer: ArrayBuffer,
  options?: ComputeWaveformOptions,
): Promise<WaveformPeaks> {
  const buffer = await decodeAudioBuffer(arrayBuffer);
  return computeWaveformPeaks(buffer, options);
}

/** Sérialisation pour cache OPFS / IDB. */
export function serializeWaveformPeaks(w: WaveformPeaks): ArrayBuffer {
  const header = new Float64Array([
    w.sampleRate,
    w.durationSec,
    w.peaksPerSec,
    w.channels,
    w.peaks.length,
  ]);
  const out = new Uint8Array(header.byteLength + w.peaks.byteLength);
  out.set(new Uint8Array(header.buffer), 0);
  out.set(
    new Uint8Array(w.peaks.buffer, w.peaks.byteOffset, w.peaks.byteLength),
    header.byteLength,
  );
  return out.buffer;
}

export function deserializeWaveformPeaks(buf: ArrayBuffer): WaveformPeaks {
  const header = new Float64Array(buf, 0, 5);
  const len = header[4] ?? 0;
  const peaks = new Float32Array(buf, 5 * 8, len);
  return {
    sampleRate: header[0] ?? 48000,
    durationSec: header[1] ?? 0,
    peaksPerSec: header[2] ?? 100,
    channels: header[3] ?? 1,
    peaks: peaks.slice(),
  };
}

/** Dessine les peaks dans un canvas 2D (utilitaire pur coordonnées). */
export function drawWaveformPeaks(
  ctx: CanvasRenderingContext2D,
  peaks: Float32Array,
  width: number,
  height: number,
  color = "rgba(163, 230, 53, 0.85)",
): void {
  const mid = height / 2;
  const buckets = peaks.length / 2;
  if (buckets <= 0 || width <= 0) return;
  ctx.fillStyle = color;
  const barW = Math.max(1, width / buckets);
  for (let b = 0; b < buckets; b++) {
    const min = peaks[b * 2] ?? 0;
    const max = peaks[b * 2 + 1] ?? 0;
    const y1 = mid + min * mid;
    const y2 = mid + max * mid;
    const top = Math.min(y1, y2);
    const h = Math.max(1, Math.abs(y2 - y1));
    ctx.fillRect(b * barW, top, Math.ceil(barW), h);
  }
}

/** Volume effectif à t (relatif clip) avec fades. */
export function volumeAtTime(
  volume: number,
  durationSec: number,
  timeInClip: number,
  fadeInSec = 0,
  fadeOutSec = 0,
): number {
  if (durationSec <= 0) return 0;
  let g = volume;
  if (fadeInSec > 0 && timeInClip < fadeInSec) {
    g *= timeInClip / fadeInSec;
  }
  if (fadeOutSec > 0 && timeInClip > durationSec - fadeOutSec) {
    g *= Math.max(0, (durationSec - timeInClip) / fadeOutSec);
  }
  return Math.max(0, Math.min(1, g));
}

/** Interpolation linéaire de keyframes. */
export function sampleKeyframeValue(
  keys: { timeSec: number; value: number }[],
  timeSec: number,
  fallback: number,
): number {
  if (!keys.length) return fallback;
  const sorted = [...keys].sort((a, b) => a.timeSec - b.timeSec);
  if (timeSec <= (sorted[0]?.timeSec ?? 0)) return sorted[0]?.value ?? fallback;
  const last = sorted[sorted.length - 1]!;
  if (timeSec >= last.timeSec) return last.value;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    if (timeSec >= a.timeSec && timeSec <= b.timeSec) {
      const t = (timeSec - a.timeSec) / Math.max(1e-9, b.timeSec - a.timeSec);
      return a.value + (b.value - a.value) * t;
    }
  }
  return fallback;
}
