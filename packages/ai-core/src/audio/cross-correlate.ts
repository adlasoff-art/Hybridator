/**
 * Intercorrélation normalisée entre deux formes d'onde (mono).
 * Retourne le lag (en samples) qui maximise la similarité : positif = `b` est en retard sur `a`.
 */
export function crossCorrelate(
  a: Float32Array,
  b: Float32Array,
  maxLagSamples: number,
): { lag: number; score: number } {
  const n = Math.min(a.length, b.length);
  if (n < 8) return { lag: 0, score: 0 };

  let bestLag = 0;
  let bestScore = -Infinity;
  const lagMax = Math.min(maxLagSamples, n - 1);

  for (let lag = -lagMax; lag <= lagMax; lag++) {
    let num = 0;
    let denA = 0;
    let denB = 0;
    let count = 0;
    for (let i = 0; i < n; i++) {
      const j = i + lag;
      if (j < 0 || j >= n) continue;
      const av = a[i]!;
      const bv = b[j]!;
      num += av * bv;
      denA += av * av;
      denB += bv * bv;
      count++;
    }
    if (count < 8) continue;
    const den = Math.sqrt(denA * denB) || 1;
    const score = num / den;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  return { lag: bestLag, score: bestScore === -Infinity ? 0 : bestScore };
}

export interface AngleWaveform {
  angleId: string;
  samples: Float32Array;
}

export interface AngleOffset {
  angleId: string;
  /** Décalage à appliquer à l'angle (secondes). Positif = retarder l'angle. */
  offsetSec: number;
  score: number;
}

/**
 * Aligne les angles sur la piste de référence (premier élément) par intercorrélation.
 */
export function alignAngleOffsets(
  waveforms: AngleWaveform[],
  sampleRate: number,
  maxLagSec = 2,
): AngleOffset[] {
  if (waveforms.length === 0) return [];
  const ref = waveforms[0]!;
  const maxLag = Math.floor(maxLagSec * sampleRate);
  return waveforms.map((w) => {
    if (w.angleId === ref.angleId) return { angleId: w.angleId, offsetSec: 0, score: 1 };
    const { lag, score } = crossCorrelate(ref.samples, w.samples, maxLag);
    // lag > 0 ⇒ b est en retard dans la fenêtre → avancer b = offset négatif sur timeline
    // Convention produit : offsetSec = décalage à ajouter au début des clips de l'angle
    return { angleId: w.angleId, offsetSec: -lag / sampleRate, score };
  });
}
