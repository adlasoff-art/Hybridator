import type { EditOperation } from "@hybridator/core-model";
import type { TimeRange } from "./vad";

export interface AngleVad {
  angleId: string;
  ranges: TimeRange[];
}

export interface AutoCutOptions {
  angles: AngleVad[];
  /** Plan large utilisé en cas de chevauchement de voix. */
  wideAngleId: string;
  /** Durée minimale d'un plan (config produit `multicam.minShotSec`). */
  minShotSec: number;
  timelineEnd: number;
  timelineStart?: number;
}

interface SpeakerSlice {
  start: number;
  end: number;
  active: string[];
}

function collectBoundaries(angles: AngleVad[], start: number, end: number): number[] {
  const set = new Set<number>([start, end]);
  for (const a of angles) {
    for (const r of a.ranges) {
      if (r.end > start && r.start < end) {
        set.add(Math.max(start, r.start));
        set.add(Math.min(end, r.end));
      }
    }
  }
  return [...set].sort((a, b) => a - b);
}

function activeAt(angles: AngleVad[], t: number): string[] {
  const mid = t;
  return angles
    .filter((a) => a.ranges.some((r) => mid >= r.start && mid < r.end))
    .map((a) => a.angleId);
}

function chooseAngle(active: string[], wideAngleId: string): string | null {
  if (active.length === 0) return null;
  if (active.length >= 2) return wideAngleId;
  return active[0] ?? null;
}

/**
 * Produit une séquence de SWITCH_CAMERA_ANGLE à partir de VAD multipiste.
 * - 1 voix active → angle correspondant
 * - chevauchement → plan large
 * - respecte minShotSec (pas de coupe plus courte)
 */
export function buildAutoCutOperations(options: AutoCutOptions): EditOperation[] {
  const start = options.timelineStart ?? 0;
  const end = options.timelineEnd;
  if (end - start <= 1e-6) return [];

  const bounds = collectBoundaries(options.angles, start, end);
  const slices: SpeakerSlice[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const s = bounds[i]!;
    const e = bounds[i + 1]!;
    if (e - s <= 1e-6) continue;
    const mid = (s + e) / 2;
    slices.push({ start: s, end: e, active: activeAt(options.angles, mid) });
  }

  // Fusion + contrainte minShot
  const ops: EditOperation[] = [];
  let cursor = start;
  let current: string | null = null;

  for (const slice of slices) {
    const desired = chooseAngle(slice.active, options.wideAngleId);
    if (desired === null) continue;
    if (desired === current) continue;

    const switchAt = Math.max(slice.start, cursor);
    if (current !== null && switchAt - cursor < options.minShotSec) {
      // Prolonge le plan courant jusqu'à satisfaire minShot, puis bascule
      const forced = cursor + options.minShotSec;
      if (forced >= end) break;
      if (forced > switchAt) {
        // sauter les slices jusqu'à forced
        cursor = forced;
        current = desired;
        ops.push({ type: "SWITCH_CAMERA_ANGLE", time: forced, angleId: desired });
        continue;
      }
    }

    ops.push({ type: "SWITCH_CAMERA_ANGLE", time: switchAt, angleId: desired });
    current = desired;
    cursor = switchAt;
  }

  // Dédupliquer temps identiques
  const dedup: EditOperation[] = [];
  for (const op of ops) {
    if (op.type !== "SWITCH_CAMERA_ANGLE") continue;
    const prev = dedup[dedup.length - 1];
    if (
      prev &&
      prev.type === "SWITCH_CAMERA_ANGLE" &&
      Math.abs(prev.time - op.time) < 1e-6 &&
      prev.angleId === op.angleId
    ) {
      continue;
    }
    dedup.push(op);
  }
  return dedup;
}
