import type { EditorDoc } from "@hybridator/core-model";
import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import {
  defaultExportSettings,
  type ExportProgress,
  type ExportSettings,
  webCodecsAvailable,
} from "./pipeline";
import { frameTimestamps, paintExportFrame } from "./compose-frame";

export type EncodeMode = "mp4" | "webm" | "simulated";

export type EncodeResult =
  | { ok: true; mode: "mp4" | "webm"; blob: Blob; fileName: string }
  | { ok: false; mode: "simulated"; reason: string };

export interface EncodeTimelineOptions {
  doc: EditorDoc;
  settings?: Partial<ExportSettings>;
  watermark?: boolean;
  brandName?: string;
  /**
   * Fournit une image/vidéo pour l'instant `time` (déjà seekée).
   * Absent → paint proxy coloré (toujours disponible).
   */
  resolveMedia?: (time: number) => Promise<CanvasImageSource | null>;
  onProgress?: (p: ExportProgress) => void;
  signal?: AbortSignal;
  fileBaseName?: string;
}

function safeName(base: string, ext: string): string {
  const clean = base.replace(/[^\p{L}\p{N}._-]+/gu, "-") || "export";
  return `${clean}.${ext}`;
}

/** True si VideoEncoder + codec AVC sont utilisables. */
export async function canEncodeMp4(): Promise<boolean> {
  if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") return false;
  try {
    const probe = await VideoEncoder.isConfigSupported({
      codec: "avc1.42001f",
      width: 640,
      height: 360,
      bitrate: 1_000_000,
      framerate: 30,
    });
    return Boolean(probe.supported);
  } catch {
    return false;
  }
}

export function canEncodeWebm(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof document !== "undefined" &&
    (MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ||
      MediaRecorder.isTypeSupported("video/webm;codecs=vp8") ||
      MediaRecorder.isTypeSupported("video/webm"))
  );
}

/**
 * Encode la timeline en MP4 (WebCodecs + mp4-muxer) ou WebM (MediaRecorder).
 * Sans API navigateur → `{ ok: false, mode: "simulated" }` pour repli UI.
 */
export async function encodeTimelineExport(options: EncodeTimelineOptions): Promise<EncodeResult> {
  const settings = defaultExportSettings(options.settings);
  let durationSec = 0;
  for (const t of options.doc.timeline.tracks) {
    for (const c of t.clips) durationSec = Math.max(durationSec, c.start + c.duration);
  }
  durationSec = Math.max(0.2, durationSec);
  const base = options.fileBaseName ?? options.doc.settings.name ?? "export";
  options.onProgress?.({ ratio: 0, phase: "prepare" });

  if (options.signal?.aborted) {
    return { ok: false, mode: "simulated", reason: "annulé" };
  }

  if (await canEncodeMp4()) {
    try {
      const blob = await encodeMp4(options, settings, durationSec);
      options.onProgress?.({ ratio: 1, phase: "done" });
      return { ok: true, mode: "mp4", blob, fileName: safeName(base, "mp4") };
    } catch (e) {
      if (options.signal?.aborted) {
        return { ok: false, mode: "simulated", reason: "annulé" };
      }
      // tombe sur WebM
      void e;
    }
  }

  if (canEncodeWebm()) {
    try {
      const blob = await encodeWebm(options, settings, durationSec);
      options.onProgress?.({ ratio: 1, phase: "done" });
      return { ok: true, mode: "webm", blob, fileName: safeName(base, "webm") };
    } catch (e) {
      if (options.signal?.aborted) {
        return { ok: false, mode: "simulated", reason: "annulé" };
      }
      void e;
    }
  }

  return {
    ok: false,
    mode: "simulated",
    reason: webCodecsAvailable()
      ? "encodeur indisponible pour cette config"
      : "WebCodecs / MediaRecorder indisponibles",
  };
}

async function encodeMp4(
  options: EncodeTimelineOptions,
  settings: ExportSettings,
  durationSec: number,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = settings.width;
  canvas.height = settings.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponible");

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: "avc",
      width: settings.width,
      height: settings.height,
      frameRate: settings.fps,
    },
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      throw e;
    },
  });
  encoder.configure({
    codec: "avc1.42001f",
    width: settings.width,
    height: settings.height,
    bitrate: settings.bitrate,
    framerate: settings.fps,
    latencyMode: "quality",
  });

  const times = frameTimestamps(durationSec, settings.fps);
  for (let i = 0; i < times.length; i++) {
    if (options.signal?.aborted) {
      encoder.close();
      throw new Error("annulé");
    }
    const time = times[i]!;
    const media = options.resolveMedia ? await options.resolveMedia(time) : null;
    paintExportFrame(ctx, options.doc, time, {
      width: settings.width,
      height: settings.height,
      ...(options.watermark !== undefined ? { watermark: options.watermark } : {}),
      ...(options.brandName !== undefined ? { brandName: options.brandName } : {}),
      media,
    });
    const frame = new VideoFrame(canvas, {
      timestamp: Math.round((i * 1_000_000) / settings.fps),
      duration: Math.round(1_000_000 / settings.fps),
    });
    const keyFrame = i % Math.max(1, Math.round(settings.fps)) === 0;
    encoder.encode(frame, { keyFrame });
    frame.close();
    options.onProgress?.({
      ratio: (i + 1) / (times.length + 2),
      phase: "video",
    });
    // Laisse le browser respirer
    if (i % 4 === 0) await new Promise((r) => setTimeout(r, 0));
  }

  options.onProgress?.({ ratio: 0.92, phase: "mux" });
  await encoder.flush();
  encoder.close();
  muxer.finalize();
  return new Blob([target.buffer], { type: "video/mp4" });
}

async function encodeWebm(
  options: EncodeTimelineOptions,
  settings: ExportSettings,
  durationSec: number,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = settings.width;
  canvas.height = settings.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponible");

  const stream = canvas.captureStream(settings.fps);
  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
      ? "video/webm;codecs=vp8"
      : "video/webm";
  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: settings.bitrate,
  });
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = () => reject(new Error("MediaRecorder error"));
  });
  recorder.start(100);

  const times = frameTimestamps(durationSec, settings.fps);
  const frameMs = 1000 / settings.fps;
  for (let i = 0; i < times.length; i++) {
    if (options.signal?.aborted) {
      recorder.stop();
      stream.getTracks().forEach((t) => t.stop());
      throw new Error("annulé");
    }
    const time = times[i]!;
    const media = options.resolveMedia ? await options.resolveMedia(time) : null;
    paintExportFrame(ctx, options.doc, time, {
      width: settings.width,
      height: settings.height,
      ...(options.watermark !== undefined ? { watermark: options.watermark } : {}),
      ...(options.brandName !== undefined ? { brandName: options.brandName } : {}),
      media,
    });
    options.onProgress?.({
      ratio: (i + 1) / (times.length + 2),
      phase: "video",
    });
    await new Promise((r) => setTimeout(r, frameMs));
  }

  options.onProgress?.({ ratio: 0.95, phase: "mux" });
  recorder.stop();
  stream.getTracks().forEach((t) => t.stop());
  await stopped;
  return new Blob(chunks, { type: "video/webm" });
}
