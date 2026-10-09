import { createDefaultClip, type Clip, type EditorDoc, type Track } from "@hybridator/core-model";
import { findClip } from "./timeline";

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** True si le clip vidéo a déjà un sibling audio avec le même linkGroupId. */
export function hasUnlinkedAudioSibling(doc: EditorDoc, clip: Clip): boolean {
  if (!clip.linkGroupId) return false;
  if (clip.mediaRole === "audio") return false;
  for (const tr of doc.timeline.tracks) {
    if (tr.kind !== "audio") continue;
    if (tr.clips.some((c) => c.linkGroupId === clip.linkGroupId && c.id !== clip.id)) {
      return true;
    }
  }
  return false;
}

export function pickAudioTrack(tracks: Track[], preferredId?: string): Track | undefined {
  if (preferredId) {
    const t = tracks.find((tr) => tr.id === preferredId && tr.kind === "audio" && !tr.locked);
    if (t) return t;
  }
  return tracks.find((tr) => tr.kind === "audio" && !tr.locked);
}

export interface UnlinkPlan {
  linkGroupId: string;
  videoClipId: string;
  audioClip: Clip;
}

/**
 * Calcule le plan d'extraction audio (pur). Retourne null si impossible.
 */
export function planUnlinkAudio(
  doc: EditorDoc,
  clipId: string,
  audioTrackId?: string,
): UnlinkPlan | null {
  const clip = findClip(doc.timeline, clipId);
  if (!clip) return null;
  const track = doc.timeline.tracks.find((tr) => tr.id === clip.trackId);
  if (!track || track.kind !== "video" || track.locked) return null;
  const asset = doc.assets.find((a) => a.id === clip.assetId);
  if (!asset || asset.kind !== "video") return null;
  if (clip.mediaRole === "video" && hasUnlinkedAudioSibling(doc, clip)) return null;
  if (clip.mediaRole === "audio") return null;

  const audioTrack = pickAudioTrack(doc.timeline.tracks, audioTrackId);
  if (!audioTrack) return null;

  const linkGroupId = clip.linkGroupId ?? newId("lnk");
  const audioClip = createDefaultClip({
    id: newId("aclip"),
    assetId: clip.assetId,
    trackId: audioTrack.id,
    start: clip.start,
    duration: clip.duration,
    sourceIn: clip.sourceIn,
    sourceOut: clip.sourceOut,
    speed: clip.speed,
    ...(clip.label ? { label: `${clip.label} (audio)` } : { label: "Audio extrait" }),
  });
  audioClip.mediaRole = "audio";
  audioClip.linkGroupId = linkGroupId;
  audioClip.audio = { ...clip.audio, muted: false };

  return { linkGroupId, videoClipId: clip.id, audioClip };
}
