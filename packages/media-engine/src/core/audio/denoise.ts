/**
 * Port denoise audio — stub déterministe, prêt pour RNNoise WASM.
 * L'UI branche `noiseReduction` (0–1) sur cet adaptateur.
 */

export interface DenoiseAdapter {
  readonly runtime: "stub" | "rnnoise-wasm";
  /**
   * Traite un buffer PCM mono/interleaved.
   * `amount` 0 = identité, 1 = réduction max.
   */
  processPcm(samples: Float32Array, sampleRate: number, amount: number): Float32Array;
}

/** Stub : high-pass léger + noise gate soft (pas de WASM). */
export function createStubDenoiseAdapter(): DenoiseAdapter {
  return {
    runtime: "stub",
    processPcm(samples, sampleRate, amount) {
      const a = Math.max(0, Math.min(1, amount));
      if (a < 0.001) return samples.slice();
      const out = new Float32Array(samples.length);
      // One-pole high-pass ~80–280 Hz selon amount
      const cutoff = 80 + a * 200;
      const rc = 1 / (2 * Math.PI * cutoff);
      const dt = 1 / Math.max(1, sampleRate);
      const alpha = rc / (rc + dt);
      let prevX = 0;
      let prevY = 0;
      const threshold = 0.002 + (1 - a) * 0.02;
      for (let i = 0; i < samples.length; i++) {
        const x = samples[i]!;
        const y = alpha * (prevY + x - prevX);
        prevX = x;
        prevY = y;
        const abs = Math.abs(y);
        const gate = abs < threshold ? abs / threshold : 1;
        out[i] = y * (1 - a * 0.35) * (0.35 + 0.65 * gate);
      }
      return out;
    },
  };
}

/** Mesure simple de l'énergie RMS (tests / UI). */
export function pcmRms(samples: Float32Array): number {
  if (!samples.length) return 0;
  let s = 0;
  for (let i = 0; i < samples.length; i++) s += samples[i]! * samples[i]!;
  return Math.sqrt(s / samples.length);
}
