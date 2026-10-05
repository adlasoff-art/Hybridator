import type { CancelSignal, MediaProcessAdapter, RenderJob } from "@hybridator/core-model";

export interface CloudRenderOptions {
  /** Endpoint worker cloud (clés / auth uniquement serveur). */
  endpoint: string;
  fetchImpl?: typeof fetch;
}

/**
 * Rendu lourd via workers cloud, derrière MediaProcessAdapter.
 * Le client n'envoie jamais de secrets fournisseurs.
 */
export function createCloudMediaProcessAdapter(options: CloudRenderOptions): MediaProcessAdapter {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  return {
    runtime: "cloud",
    async render(job: RenderJob, onProgress: (ratio: number) => void, signal?: CancelSignal) {
      if (typeof fetchImpl !== "function") {
        throw new Error("fetch indisponible pour le rendu cloud.");
      }
      onProgress(0.05);
      const init: RequestInit = {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(job),
      };
      if (signal) init.signal = signal as AbortSignal;
      const res = await fetchImpl(options.endpoint, init);
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(`Rendu cloud échoué (${res.status}): ${msg || "erreur"}`);
      }
      onProgress(1);
      const json = (await res.json().catch(() => ({}))) as { fileName?: string };
      return { ok: true, fileName: json.fileName ?? `${job.projectId}-${job.presetId}-cloud.mp4` };
    },
  };
}

/**
 * Choisit WASM pour les jobs courts, cloud pour les jobs lourds.
 */
export function createHybridMediaProcessAdapter(
  wasm: MediaProcessAdapter,
  cloud: MediaProcessAdapter,
  heavyThresholdSec = 120,
): MediaProcessAdapter {
  return {
    runtime: "wasm",
    render(job, onProgress, signal) {
      const adapter = job.durationSec >= heavyThresholdSec ? cloud : wasm;
      return adapter.render(job, onProgress, signal);
    },
  };
}
