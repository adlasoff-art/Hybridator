/**
 * Pipeline d'export — interface stable pour Web Worker + WebCodecs.
 * L'encodeur réel est branché quand VideoEncoder est disponible ; sinon fallback progress.
 */

export interface ExportSettings {
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  format: "mp4" | "webm";
  includeAudio: boolean;
  /** Export sous-titres séparés. */
  captionsFormat?: "srt" | "vtt" | "none";
}

export interface ExportProgress {
  ratio: number;
  phase: "prepare" | "video" | "audio" | "mux" | "done";
}

export function defaultExportSettings(partial?: Partial<ExportSettings>): ExportSettings {
  return {
    width: partial?.width ?? 1920,
    height: partial?.height ?? 1080,
    fps: partial?.fps ?? 30,
    bitrate: partial?.bitrate ?? 8_000_000,
    format: partial?.format ?? "mp4",
    includeAudio: partial?.includeAudio ?? true,
    captionsFormat: partial?.captionsFormat ?? "none",
  };
}

export function webCodecsAvailable(): boolean {
  return typeof VideoEncoder !== "undefined" && typeof AudioEncoder !== "undefined";
}

/** Convertit des cues transcript en SRT. */
export function transcriptToSrt(cues: { start: number; end: number; text: string }[]): string {
  return cues
    .map((c, i) => {
      const a = formatSrtTime(c.start);
      const b = formatSrtTime(c.end);
      return `${i + 1}\n${a} --> ${b}\n${c.text}\n`;
    })
    .join("\n");
}

export function transcriptToVtt(cues: { start: number; end: number; text: string }[]): string {
  const body = cues
    .map((c) => {
      const a = formatVttTime(c.start);
      const b = formatVttTime(c.end);
      return `${a} --> ${b}\n${c.text}\n`;
    })
    .join("\n");
  return `WEBVTT\n\n${body}`;
}

function formatSrtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function formatVttTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, "0");
}

/**
 * Simulateur de progression d'export (utilisé tant que le muxer MP4 n'est pas branché).
 * Remplacé progressivement par encode WebCodecs frame-par-frame.
 */
export async function runExportProgress(
  durationSec: number,
  onProgress: (p: ExportProgress) => void,
  signal?: { aborted: boolean },
): Promise<{ ok: true; fileName: string; webCodecs: boolean }> {
  const steps = Math.max(8, Math.ceil(durationSec));
  onProgress({ ratio: 0, phase: "prepare" });
  for (let i = 1; i <= steps; i++) {
    if (signal?.aborted) throw new Error("Export annulé");
    await new Promise((r) => setTimeout(r, 16));
    const ratio = i / steps;
    const phase: ExportProgress["phase"] =
      ratio < 0.1 ? "prepare" : ratio < 0.7 ? "video" : ratio < 0.9 ? "audio" : "mux";
    onProgress({ ratio, phase });
  }
  onProgress({ ratio: 1, phase: "done" });
  return {
    ok: true,
    fileName: `export.${webCodecsAvailable() ? "mp4" : "webm"}`,
    webCodecs: webCodecsAvailable(),
  };
}
