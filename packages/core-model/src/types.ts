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
  /** Fade-in / fade-out en secondes (enveloppe volume). */
  fadeInSec?: number | undefined;
  fadeOutSec?: number | undefined;
  /** EQ preset id (Jalon 2). */
  eqPreset?: string | undefined;
}

/** Rôle média CapCut : AV combiné, vidéo seule, ou audio extrait. */
export type ClipMediaRole = "av" | "video" | "audio";

/** Image-clé sur un paramètre clip (temps relatif au début du clip). */
export interface Keyframe {
  id: string;
  timeSec: number;
  value: number;
}

export interface KeyframeTrack {
  property:
    | "opacity"
    | "volume"
    | "scale"
    | "x"
    | "y"
    | "rotation"
    | "exposure"
    | "contrast"
    | "saturation";
  keys: Keyframe[];
}

/** Masque géométrique (Jalon 3). */
export interface ClipMask {
  shape: "rect" | "circle" | "line" | "filmstrip";
  feather: number;
  invert: boolean;
  /** Normalisé 0–1 dans le frame. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Rogage CapCut — marges normalisées 0–1 depuis chaque bord. */
export interface ClipCrop {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const DEFAULT_CLIP_CROP: ClipCrop = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

/** Étalonnage basique stocké sur le clip. */
export interface ColorGrade {
  temperature: number;
  tint: number;
  saturation: number;
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  vibrance: number;
  sharpen: number;
  vignette: number;
  grain: number;
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
  /** Groupe de liaison A/V (même id sur paire V+A). */
  linkGroupId?: string | undefined;
  /** Sémantique CapCut du flux. Absent = `av` implicite sur piste vidéo. */
  mediaRole?: ClipMediaRole | undefined;
  keyframes?: KeyframeTrack[] | undefined;
  mask?: ClipMask | undefined;
  colorGrade?: ColorGrade | undefined;
  /** Miroir horizontal / vertical. */
  flipX?: boolean | undefined;
  flipY?: boolean | undefined;
  /** Blend mode composite (Jalon 3). */
  blendMode?: string | undefined;
  /** Rogage (crop) du frame. */
  crop?: ClipCrop | undefined;
}

export interface Track {
  id: string;
  kind: TrackKind;
  role: TrackRole;
  name: string;
  muted: boolean;
  locked: boolean;
  /** Masquer la piste vidéo dans le preview (Hide). */
  hidden?: boolean | undefined;
  /** Solo — les autres pistes audio sont ignorées à la lecture. */
  solo?: boolean | undefined;
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
  mediaRole?: ClipMediaRole | undefined;
  linkGroupId?: string | undefined;
  keyframes?: KeyframeTrack[] | undefined;
  mask?: ClipMask | null | undefined;
  colorGrade?: Partial<ColorGrade> | undefined;
  flipX?: boolean | undefined;
  flipY?: boolean | undefined;
  blendMode?: string | undefined;
  crop?: Partial<ClipCrop> | null | undefined;
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
      patch: {
        muted?: boolean | undefined;
        locked?: boolean | undefined;
        hidden?: boolean | undefined;
        solo?: boolean | undefined;
      };
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
  | { type: "SET_TRANSITION"; clipId: string; transition: ClipTransition | null }
  /**
   * Extrait l'audio d'un clip vidéo vers une piste audio (CapCut « Extraire l'audio »).
   * Atomique : mute V + ADD clip A, même linkGroupId — une entrée d'historique.
   */
  | { type: "UNLINK_AUDIO"; clipId: string; audioTrackId?: string | undefined }
  /** Relie des clips sélectionnés sous un même linkGroupId. */
  | { type: "LINK_CLIPS"; clipIds: string[] };

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
