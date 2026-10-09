/** Choisit un MIME MediaRecorder supporté pour l’ISO web. */
export function pickRecorderMimeType(opts?: {
  preferVideo?: boolean;
  isTypeSupported?: (mime: string) => boolean;
}): string | undefined {
  const preferVideo = opts?.preferVideo !== false;
  const supported =
    opts?.isTypeSupported ??
    ((mime: string) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime));

  const video = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  const audio = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  const list = preferVideo ? [...video, ...audio] : [...audio, ...video];
  return list.find((m) => supported(m));
}

export function extensionForMime(mime: string | undefined): string {
  if (!mime) return "webm";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

export function kindFromRecorderMime(mime: string | undefined): "video" | "audio" {
  if (mime?.startsWith("audio/")) return "audio";
  return "video";
}

export function formatCaptureDeviceLabel(
  label: string,
  kind: "video" | "audio",
  index: number,
): string {
  const trimmed = label.trim();
  if (trimmed) return trimmed;
  return kind === "video" ? `Caméra ${index + 1}` : `Micro ${index + 1}`;
}
