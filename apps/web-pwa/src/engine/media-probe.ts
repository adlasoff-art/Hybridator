/** Probe navigateur pour durée / kind d'un fichier média. */

export type ProbedMediaKind = "video" | "audio" | "image";

export interface ProbedMedia {
  kind: ProbedMediaKind;
  durationSec: number;
  objectUrl: string;
}

function kindFromMime(file: File): ProbedMediaKind | null {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("image/")) return "image";
  const n = file.name.toLowerCase();
  if (/\.(mp4|webm|mov|mkv|m4v)$/.test(n)) return "video";
  if (/\.(mp3|wav|ogg|m4a|aac|flac)$/.test(n)) return "audio";
  if (/\.(png|jpe?g|gif|webp|bmp)$/.test(n)) return "image";
  return null;
}

const DEFAULT_IMAGE_DURATION = 3;

export async function probeMediaFile(file: File): Promise<ProbedMedia> {
  const kind = kindFromMime(file);
  if (!kind) throw new Error(`Type non supporté : ${file.name}`);
  const objectUrl = URL.createObjectURL(file);

  if (kind === "image") {
    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Image illisible : ${file.name}`));
      img.src = objectUrl;
    });
    return { kind, durationSec: DEFAULT_IMAGE_DURATION, objectUrl };
  }

  const durationSec = await new Promise<number>((resolve, reject) => {
    const el = document.createElement(kind === "video" ? "video" : "audio");
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      const d = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 1;
      resolve(d);
    };
    el.onerror = () => reject(new Error(`Média illisible : ${file.name}`));
    el.src = objectUrl;
  });

  return { kind, durationSec, objectUrl };
}
