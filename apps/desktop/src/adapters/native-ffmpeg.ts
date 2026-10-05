import type { CancelSignal, MediaProcessAdapter, RenderJob } from "@hybridator/core-model";

export type TauriInvoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

/**
 * Rendu natif FFmpeg derrière MediaProcessAdapter.
 * Stub Phase 6 : progresse localement si invoke absent ; prêt pour commande Tauri `ffmpeg_render`.
 */
export function createNativeFfmpegAdapter(invoke?: TauriInvoke): MediaProcessAdapter {
  if (!invoke) {
    return {
      runtime: "native-ffmpeg",
      render(job: RenderJob, onProgress: (ratio: number) => void, signal?: CancelSignal) {
        return new Promise((resolve, reject) => {
          let p = 0;
          const tick = () => {
            if (signal?.aborted) {
              reject(Object.assign(new Error("Rendu annulé"), { name: "AbortError" }));
              return;
            }
            p = Math.min(1, p + 0.05);
            onProgress(p);
            if (p >= 1) {
              resolve({ ok: true, fileName: `${job.projectId}-${job.presetId}-native.mp4` });
              return;
            }
            setTimeout(tick, 30);
          };
          setTimeout(tick, 0);
        });
      },
    };
  }
  const call = invoke;
  return {
    runtime: "native-ffmpeg",
    async render(job, onProgress, signal) {
      if (signal?.aborted) {
        throw Object.assign(new Error("Rendu annulé"), { name: "AbortError" });
      }
      onProgress(0.1);
      const result = await call<{ ok: true; fileName: string }>("ffmpeg_render", { job });
      onProgress(1);
      return result;
    },
  };
}
