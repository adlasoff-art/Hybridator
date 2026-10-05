import type { Asset, EditorDoc } from "@hybridator/core-model";

export interface ProxyFrame {
  time: number;
  assetId: string;
  /** Couleur de proxy déterministe (fallback sans décodeur). */
  color: string;
  label: string;
  width: number;
  height: number;
}

/** Génère une couleur stable par asset pour les proxys de scrubbing. */
export function proxyColor(assetId: string): string {
  let h = 0;
  for (let i = 0; i < assetId.length; i++) h = (h * 31 + assetId.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 45% 35%)`;
}

export function activeAngleAsset(doc: EditorDoc, time: number): Asset | undefined {
  const track = doc.timeline.tracks.find((t) => t.role === "angles" || t.role === "main");
  if (!track) return undefined;
  const clip = track.clips.find((c) => time >= c.start && time < c.start + c.duration);
  if (!clip) return undefined;
  return doc.assets.find((a) => a.id === clip.assetId);
}

/** Frame proxy légère pour scrubbing fluide (sans décoder la 4K source). */
export function buildProxyFrame(
  doc: EditorDoc,
  time: number,
  size: { width: number; height: number },
): ProxyFrame {
  const asset = activeAngleAsset(doc, time);
  return {
    time,
    assetId: asset?.id ?? "none",
    color: asset ? proxyColor(asset.id) : "#1a1d21",
    label: asset ? (asset.angle != null ? `CAM ${asset.angle}` : asset.name) : "—",
    width: size.width,
    height: size.height,
  };
}
