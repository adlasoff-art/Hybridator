/**
 * Catalogues NLE CapCut-like — TypeScript pur (pas de React).
 */

export type CatalogKind = "text" | "sticker" | "effect" | "transition";

export interface CatalogItem {
  id: string;
  kind: CatalogKind;
  label: string;
  /** Pour texte / sticker : contenu affiché. */
  content?: string;
  /** Type d'effet ou de transition stocké sur le clip. */
  effectType?: string;
  /** Durée défaut (s) pour titres / stickers / transitions. */
  defaultDurationSec: number;
  /** Paramètres initialisés sur l'effet. */
  params?: Record<string, number | string | boolean>;
}

export const TEXT_CATALOG: CatalogItem[] = [
  {
    id: "text-title",
    kind: "text",
    label: "Titre",
    content: "Titre",
    defaultDurationSec: 3,
    params: { fontSize: 48, weight: 700 },
  },
  {
    id: "text-subtitle",
    kind: "text",
    label: "Sous-titre",
    content: "Sous-titre",
    defaultDurationSec: 3,
    params: { fontSize: 28, weight: 500 },
  },
  {
    id: "text-lower",
    kind: "text",
    label: "Bas de page",
    content: "Bas de page",
    defaultDurationSec: 4,
    params: { fontSize: 22, weight: 400, y: 200 },
  },
  {
    id: "text-callout",
    kind: "text",
    label: "Encart",
    content: "Point clé",
    defaultDurationSec: 2.5,
    params: { fontSize: 32, weight: 600 },
  },
];

export const STICKER_CATALOG: CatalogItem[] = [
  { id: "stk-fire", kind: "sticker", label: "Feu", content: "🔥", defaultDurationSec: 2 },
  { id: "stk-star", kind: "sticker", label: "Étoile", content: "⭐", defaultDurationSec: 2 },
  {
    id: "stk-clap",
    kind: "sticker",
    label: "Applaudissements",
    content: "👏",
    defaultDurationSec: 2,
  },
  { id: "stk-heart", kind: "sticker", label: "Cœur", content: "❤️", defaultDurationSec: 2 },
  { id: "stk-laugh", kind: "sticker", label: "Rire", content: "😂", defaultDurationSec: 2 },
  { id: "stk-arrow", kind: "sticker", label: "Flèche", content: "➡️", defaultDurationSec: 2 },
];

export const EFFECT_CATALOG: CatalogItem[] = [
  {
    id: "fx-fade",
    kind: "effect",
    label: "Fondu",
    effectType: "fade",
    defaultDurationSec: 0.5,
    params: { amount: 1 },
  },
  {
    id: "fx-blur",
    kind: "effect",
    label: "Flou",
    effectType: "blur",
    defaultDurationSec: 0,
    params: { radius: 6 },
  },
  {
    id: "fx-bw",
    kind: "effect",
    label: "N&B",
    effectType: "grayscale",
    defaultDurationSec: 0,
    params: { amount: 1 },
  },
  {
    id: "fx-vignette",
    kind: "effect",
    label: "Vignette",
    effectType: "vignette",
    defaultDurationSec: 0,
    params: { strength: 0.45 },
  },
  {
    id: "fx-cinema",
    kind: "effect",
    label: "Cinéma",
    effectType: "cinema",
    defaultDurationSec: 0,
    params: { contrast: 1.15, saturation: 0.9 },
  },
  {
    id: "fx-glow",
    kind: "effect",
    label: "Lueur",
    effectType: "glow",
    defaultDurationSec: 0,
    params: { intensity: 0.6 },
  },
  {
    id: "fx-chroma",
    kind: "effect",
    label: "Fond vert",
    effectType: "chroma-key",
    defaultDurationSec: 0,
    params: { hue: 120, tolerance: 0.35, shadow: 0.1 },
  },
  {
    id: "fx-cutout",
    kind: "effect",
    label: "Découpe IA",
    effectType: "auto-cutout",
    defaultDurationSec: 0,
    params: { strength: 0.85 },
  },
  {
    id: "fx-voice-iso",
    kind: "effect",
    label: "Isolation voix",
    effectType: "voice-isolation",
    defaultDurationSec: 0,
    params: { amount: 0.7 },
  },
];

export const TRANSITION_CATALOG: CatalogItem[] = [
  {
    id: "tr-fade",
    kind: "transition",
    label: "Fondu",
    effectType: "fade",
    defaultDurationSec: 0.5,
  },
  {
    id: "tr-dissolve",
    kind: "transition",
    label: "Dissoudre",
    effectType: "dissolve",
    defaultDurationSec: 0.6,
  },
  {
    id: "tr-wipe-left",
    kind: "transition",
    label: "Balayage ←",
    effectType: "wipe-left",
    defaultDurationSec: 0.4,
  },
  {
    id: "tr-wipe-right",
    kind: "transition",
    label: "Balayage →",
    effectType: "wipe-right",
    defaultDurationSec: 0.4,
  },
  {
    id: "tr-slide-up",
    kind: "transition",
    label: "Glisser ↑",
    effectType: "slide-up",
    defaultDurationSec: 0.45,
  },
  {
    id: "tr-zoom",
    kind: "transition",
    label: "Zoom",
    effectType: "zoom",
    defaultDurationSec: 0.5,
  },
];
