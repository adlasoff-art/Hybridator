import type { Clip, Timeline, Track } from "@hybridator/core-model";
import { clipEnd } from "./mapping";

const EPS = 1e-6;

export interface SnapOptions {
  /** Seuil en secondes. */
  thresholdSec: number;
  playhead?: number | undefined;
  /** Accrocher aux bords des autres clips (même piste + autres pistes). */
  edges?: boolean | undefined;
  /** Mode magnétique : coller au clip précédent sur la même piste. */
  magnetic?: boolean | undefined;
}

function findClip(timeline: Timeline, clipId: string): Clip | undefined {
  for (const tr of timeline.tracks) {
    const c = tr.clips.find((x) => x.id === clipId);
    if (c) return c;
  }
  return undefined;
}

/**
 * Accroche un début de clip proposé aux bords / playhead / voisin précédent.
 */
export function snapClipStart(
  timeline: Timeline,
  clipId: string,
  proposedStart: number,
  opts: SnapOptions,
): number {
  const clip = findClip(timeline, clipId);
  if (!clip) return Math.max(0, proposedStart);

  const start = Math.max(0, proposedStart);
  const thr = Math.max(0, opts.thresholdSec);
  if (thr <= EPS && !opts.magnetic) return start;

  const candidates: number[] = [0];
  if (typeof opts.playhead === "number") candidates.push(opts.playhead);

  if (opts.edges !== false) {
    for (const tr of timeline.tracks) {
      for (const c of tr.clips) {
        if (c.id === clipId) continue;
        candidates.push(c.start, clipEnd(c));
      }
    }
  }

  if (opts.magnetic) {
    const track = timeline.tracks.find((t) => t.id === clip.trackId);
    if (track) {
      const prev = previousClipOnTrack(track, clipId, start);
      if (prev) candidates.push(clipEnd(prev));
    }
  }

  let best = start;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = Math.abs(start - c);
    if (d <= thr + EPS && d < bestDist) {
      bestDist = d;
      best = Math.max(0, c);
    }
  }
  return best;
}

function previousClipOnTrack(track: Track, clipId: string, beforeStart: number): Clip | undefined {
  return track.clips
    .filter((c) => c.id !== clipId && clipEnd(c) <= beforeStart + EPS)
    .sort((a, b) => clipEnd(b) - clipEnd(a))[0];
}

/** Points d'accroche utiles pour l’UI (playhead + bords). */
export function collectSnapPoints(
  timeline: Timeline,
  excludeClipId?: string,
  playhead?: number,
): number[] {
  const pts = new Set<number>([0]);
  if (typeof playhead === "number") pts.add(playhead);
  for (const tr of timeline.tracks) {
    for (const c of tr.clips) {
      if (excludeClipId && c.id === excludeClipId) continue;
      pts.add(c.start);
      pts.add(clipEnd(c));
    }
  }
  return [...pts].sort((a, b) => a - b);
}
