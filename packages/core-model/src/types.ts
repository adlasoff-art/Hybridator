/**
 * Modèle de projet — TypeScript pur, aucune dépendance à React.
 */

export type TrackKind = "video" | "audio" | "caption" | "text" | "overlay" | "effect";
export type TrackRole = "main" | "angles" | "broll" | "voice" | "music" | "captions" | "titles";

export interface Effect {
  id: string;
  type: string;
  params: Record<string, number | string | boolean>;
}

/** Transition en sortie du clip (vers le suivant). */
export interface ClipTransition {
  type: string;
  durationSec: number;
}

export interface ClipTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}

export interface ClipAudio {
  volume: number;
  pan: number;
  muted: boolean;
  noiseReduction: number;
}

export interface Clip {
  id: string;
  assetId: string;
  trackId: string;
  start: number;
  duration: number;
  sourceIn: number;
  sourceOut: number;
  transform: ClipTransform;
  audio: ClipAudio;
  speed: number;
  enabled: boolean;
  effects: Effect[];
  /** Transition appliquée en fin de clip. */
  transition?: ClipTransition | undefined;
  label?: string | undefined;
}

export interface Track {
  id: string;
  kind: TrackKind;
  role: TrackRole;
  name: string;
  muted: boolean;
  locked: boolean;
  clips: Clip[];
}

export interface Timeline {
  tracks: Track[];
}

export interface ClipPatch {
  transform?: Partial<ClipTransform> | undefined;
  audio?: Partial<ClipAudio> | undefined;
  enabled?: boolean | undefined;
  label?: string | undefined;
  effects?: Effect[] | undefined;
  /** `null` retire la transition. */
  transition?: ClipTransition | null | undefined;
}

export type EditOperation =
  | { type: "REMOVE_RANGE"; trackId: string; start: number; end: number; reason: string }
  | { type: "SPLIT_CLIP"; clipId: string; position: number }
  | { type: "CHANGE_SPEED"; clipId: string; speed: number }
  | { type: "SWITCH_CAMERA_ANGLE"; time: number; angleId: string }
  | { type: "UPDATE_CLIP"; clipId: string; patch: ClipPatch }
  | {
      type: "SET_TRACK";
      trackId: string;
      patch: { muted?: boolean | undefined; locked?: boolean | undefined };
    }
  /** Déplace un clip sur sa piste (début timeline). */
  | { type: "MOVE_CLIP"; clipId: string; start: number }
  /** Redimensionne un clip (in/out) en temps source + timeline. */
  | {
      type: "RESIZE_CLIP";
      clipId: string;
      start: number;
      duration: number;
      sourceIn: number;
      sourceOut: number;
    }
  /** Enregistre un média dans le chutier (sans le placer sur la timeline). */
  | { type: "ADD_ASSET"; asset: Asset }
  /** Retire un asset non référencé par aucun clip. */
  | { type: "REMOVE_ASSET"; assetId: string }
  /** Place un clip sur une piste existante. */
  | { type: "ADD_CLIP"; clip: Clip }
  /** Supprime un clip ; `ripple` décale les clips suivants sur la même piste. */
  | { type: "DELETE_CLIP"; clipId: string; ripple?: boolean | undefined }
  /** Ajoute une piste vide. */
  | { type: "ADD_TRACK"; track: Track }
  /** Ajoute un effet sur un clip. */
  | { type: "ADD_EFFECT"; clipId: string; effect: Effect }
  /** Retire un effet d'un clip. */
  | { type: "REMOVE_EFFECT"; clipId: string; effectId: string }
  /** Définit ou retire la transition de sortie d'un clip. */
  | { type: "SET_TRANSITION"; clipId: string; transition: ClipTransition | null };

/** trackId spécial : l'opération s'applique à toutes les pistes (ripple global) */
export const ALL_TRACKS = "*";

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

export interface TranscriptSegment {
  id: string;
  speaker: string;
  text: string;
  start: number;
  end: number;
  words: TranscriptWord[];
}

export interface NormalizedTranscript {
  language: string;
  duration: number;
  segments: TranscriptSegment[];
  detections: {
    silences: { start: number; end: number; duration: number }[];
    fillers: { word: string; start: number; end: number }[];
    repetitions: { phrase: string; occurrences: { start: number; end: number }[] }[];
    speechTics: { word: string; count: number; timestamps: { start: number; end: number }[] }[];
  };
  metrics: { totalPotentiallySavedTime: number };
}

export interface Asset {
  id: string;
  name: string;
  kind: "video" | "audio" | "image" | "caption";
  uri: string;
  durationSec: number;
  /** Numéro d'angle multi-caméras, si applicable */
  angle?: number | undefined;
  sha256?: string | undefined;
}

export interface ProjectSettings {
  name: string;
  width: number;
  height: number;
  fps: number;
  aspectRatio: string;
  sampleRate: number;
}

export interface SourceRange {
  start: number;
  end: number;
  reason: string;
}

/** Document complet d'un projet en cours d'édition */
export interface EditorDoc {
  id: string;
  createdAt: string;
  updatedAt: string;
  settings: ProjectSettings;
  assets: Asset[];
  timeline: Timeline;
  transcript: NormalizedTranscript;
  /** Plages supprimées, exprimées en temps source (non destructif) */
  removedRanges: SourceRange[];
  operations: EditOperation[];
}
