import {
  computeWaveformFromArrayBuffer,
  deserializeWaveformPeaks,
  serializeWaveformPeaks,
  type WaveformPeaks,
} from "@hybridator/media-engine";
import { opfsMediaBlobStore } from "./opfs-media";

const memory = new Map<string, WaveformPeaks>();
const PEAKS_PER_SEC = 80;

function cacheKey(projectId: string, assetId: string): string {
  return `${projectId}::${assetId}::${PEAKS_PER_SEC}`;
}

function peaksAssetId(assetId: string): string {
  return `${assetId}__waveform_peaks`;
}

/** Extrait l'assetId depuis une URI opfs://project/id ou retourne l'id brut. */
export function assetIdFromUri(uri: string, fallbackId: string): string {
  if (uri.startsWith("opfs://")) {
    const parts = uri.slice("opfs://".length).split("/");
    return parts[1] ?? fallbackId;
  }
  return fallbackId;
}

/** Charge ou calcule les peaks waveform pour un asset (OPFS + mémoire). */
export async function getAssetWaveform(
  projectId: string,
  assetId: string,
  assetUri: string,
): Promise<WaveformPeaks | null> {
  const key = cacheKey(projectId, assetId);
  const hit = memory.get(key);
  if (hit) return hit;

  const peaksId = peaksAssetId(assetId);
  try {
    const cached = await opfsMediaBlobStore.get(projectId, peaksId);
    if (cached) {
      const peaks = deserializeWaveformPeaks(await cached.arrayBuffer());
      memory.set(key, peaks);
      return peaks;
    }
  } catch {
    /* miss */
  }

  if (assetUri.startsWith("demo://") || assetUri.startsWith("builtin://")) {
    // Peaks déterministes (pas aléatoires) pour projets démo sans OPFS média.
    const peaks = syntheticDemoPeaks(assetId, 12);
    memory.set(key, peaks);
    return peaks;
  }

  try {
    const mediaId = assetIdFromUri(assetUri, assetId);
    const blob = await opfsMediaBlobStore.get(projectId, mediaId);
    if (!blob) return null;
    const peaks = await computeWaveformFromArrayBuffer(await blob.arrayBuffer(), {
      peaksPerSec: PEAKS_PER_SEC,
    });
    memory.set(key, peaks);
    try {
      await opfsMediaBlobStore.put(
        projectId,
        peaksId,
        new Blob([new Uint8Array(serializeWaveformPeaks(peaks))], {
          type: "application/octet-stream",
        }),
      );
    } catch {
      /* cache write best-effort */
    }
    return peaks;
  } catch {
    return null;
  }
}

export function clearWaveformMemoryCache(): void {
  memory.clear();
}

/** Forme d'onde stable dérivée de l'id (démo) — min/max réels, non aléatoires. */
function syntheticDemoPeaks(assetId: string, durationSec: number): WaveformPeaks {
  const peaksPerSec = PEAKS_PER_SEC;
  const buckets = Math.max(1, Math.ceil(durationSec * peaksPerSec));
  const peaks = new Float32Array(buckets * 2);
  let seed = 0;
  for (let i = 0; i < assetId.length; i++) seed = (seed * 31 + assetId.charCodeAt(i)) >>> 0;
  for (let b = 0; b < buckets; b++) {
    const t = b / peaksPerSec;
    const amp = 0.35 + 0.25 * Math.sin(t * 4.2 + (seed % 97) * 0.1);
    const wobble = 0.15 * Math.sin(t * 11 + seed * 0.001);
    peaks[b * 2] = -(amp + wobble);
    peaks[b * 2 + 1] = amp + wobble;
  }
  return {
    peaks,
    sampleRate: 48000,
    durationSec,
    peaksPerSec,
    channels: 1,
  };
}
