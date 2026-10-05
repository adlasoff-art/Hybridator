import type { CancelSignal, MediaProcessAdapter, RenderJob } from "@hybridator/core-model";

/**
 * Rendu léger « WASM » — exécuté localement (worker simulé).
 * Remplacé plus tard par un vrai module FFmpeg.wasm sans changer le port.
 */
export function createWasmMediaProcessAdapter(): MediaProcessAdapter {
  return {
    runtime: "wasm",
    render(job: RenderJob, onProgress: (ratio: number) => void, signal?: CancelSignal) {
      return new Promise((resolve, reject) => {
        let p = 0;
        const tick = () => {
          if (signal?.aborted) {
            reject(Object.assign(new Error("Rendu annulé"), { name: "AbortError" }));
            return;
          }
          p = Math.min(1, p + 0.08);
          onProgress(p);
          if (p >= 1) {
            resolve({ ok: true, fileName: `${job.projectId}-${job.presetId}-wasm.mp4` });
            return;
          }
          setTimeout(tick, 40);
        };
        setTimeout(tick, 0);
      });
    },
  };
}
