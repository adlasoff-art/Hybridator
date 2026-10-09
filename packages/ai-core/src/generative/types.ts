import type { EditOperation } from "@hybridator/core-model";

/** Élément planifié par l'IA pour placement timeline. */
export interface GenerativePlanClip {
  trackHint: "v1" | "v2" | "a1" | "a2" | "t1";
  kind: "video" | "audio" | "text" | "sticker" | "music";
  label: string;
  start: number;
  duration: number;
  content?: string;
  effectTypes?: string[];
  transitionType?: string;
}

/** Plan structuré prompt → timeline (scénario A). */
export interface GenerativePlan {
  title: string;
  durationSec: number;
  script?: string;
  voiceoverText?: string;
  clips: GenerativePlanClip[];
  providerId: string;
  mode: "demo" | "llm";
}

export interface GenerativeProjectRequest {
  projectId: string;
  prompt: string;
  /** Durée cible optionnelle (s). */
  durationSec?: number;
  /** Contexte / style (références textuelles). */
  referenceNotes?: string;
  language?: string;
}

/** Intentions d'édition contextuelle (scénario B) — pas d'ops brutes côté LLM. */
export type GenerativeEditIntent =
  | { type: "add_effect"; effectType: string; params?: Record<string, number | string | boolean> }
  | { type: "set_transition"; transitionType: string; durationSec?: number }
  | { type: "noise_reduction"; amount: number }
  | { type: "change_speed"; speed: number }
  | { type: "add_text_overlay"; content: string; durationSec?: number }
  | { type: "add_broll_placeholder"; label: string; startOffsetSec?: number; durationSec?: number };

export interface GenerativeEditRequest {
  projectId: string;
  clipId: string;
  instruction: string;
  clipSummary?: {
    label?: string;
    trackId?: string;
    start?: number;
    duration?: number;
    kind?: string;
  };
  language?: string;
}

export interface GenerativeEditResult {
  summary: string;
  intents: GenerativeEditIntent[];
  providerId: string;
  mode: "demo" | "llm";
}

/**
 * Port IA générative — aucun secret ici.
 * Les adaptateurs distants appellent un endpoint serveur.
 */
export interface GenerativeAiAdapter {
  readonly providerId: string;
  generateProject(req: GenerativeProjectRequest): Promise<GenerativePlan>;
  editClip(req: GenerativeEditRequest): Promise<GenerativeEditResult>;
}

/** Résultat après conversion plan → document (ops + titre). */
export interface AppliedGenerativePlan {
  title: string;
  operations: EditOperation[];
}
