import { extensionForMime, kindFromRecorderMime, pickRecorderMimeType } from "./mime";

export interface IsoRecording {
  blob: Blob;
  mimeType: string;
  durationSec: number;
  kind: "video" | "audio";
  fileName: string;
}

export interface CaptureRecorder {
  start: () => void;
  stop: () => Promise<IsoRecording>;
  readonly recording: boolean;
}

/**
 * Enregistrement ISO via MediaRecorder sur le flux fourni (prévisualisation / gain).
 */
export function createCaptureRecorder(stream: MediaStream): CaptureRecorder {
  const hasVideo = stream.getVideoTracks().length > 0;
  const mimeType = pickRecorderMimeType({ preferVideo: hasVideo });
  const chunks: BlobPart[] = [];
  let recorder: MediaRecorder | null = null;
  let startedAt = 0;
  let recording = false;

  return {
    get recording() {
      return recording;
    },
    start() {
      if (recording) return;
      chunks.length = 0;
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      startedAt = performance.now();
      recorder.start(250);
      recording = true;
    },
    stop() {
      return new Promise<IsoRecording>((resolve, reject) => {
        if (!recorder || !recording) {
          reject(new Error("Aucun enregistrement en cours."));
          return;
        }
        const rec = recorder;
        rec.onstop = () => {
          recording = false;
          const type = rec.mimeType || mimeType || "video/webm";
          const blob = new Blob(chunks, { type });
          const durationSec = Math.max(0.1, (performance.now() - startedAt) / 1000);
          const kind = kindFromRecorderMime(type);
          const ext = extensionForMime(type);
          const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
          resolve({
            blob,
            mimeType: type,
            durationSec,
            kind,
            fileName: `capture-${stamp}.${ext}`,
          });
        };
        rec.onerror = () => {
          recording = false;
          reject(new Error("Échec MediaRecorder."));
        };
        rec.stop();
      });
    },
  };
}
