import type { Asset, Track } from "@/engine";

const CAM = ["bg-cam-1", "bg-cam-2", "bg-cam-3", "bg-cam-4"];

export function camClass(asset: Asset | undefined): string {
  return CAM[((asset?.angle ?? 1) - 1) % CAM.length] ?? "bg-cam-1";
}

export function trackClipClass(track: Track): string {
  switch (track.role) {
    case "broll":
      return "bg-track-broll";
    case "captions":
      return "bg-track-caption text-warning-foreground";
    case "voice":
    case "music":
      return "bg-track-audio";
    default:
      return "bg-track-video";
  }
}

export function trackCode(track: Track, index: number, all: Track[]): string {
  const prefix = track.kind === "audio" ? "A" : track.kind === "caption" ? "C" : track.kind === "text" ? "T" : "V";
  const same = all.filter((t) => (t.kind === "audio" ? "A" : t.kind === "caption" ? "C" : t.kind === "text" ? "T" : "V") === prefix);
  const pos = same.indexOf(track);
  return prefix === "V" ? `${prefix}${same.length - pos}` : `${prefix}${pos + 1}`;
}
