import type { CSSProperties } from "react";

/** Placeholder local dérivé du nom/id — pas d'URLs Unsplash. */

const PALETTES = [
  ["#4c5cff", "#7746ed"],
  ["#343ad1", "#1ed7a0"],
  ["#7746ed", "#4c5cff"],
  ["#1a6b5a", "#4c5cff"],
  ["#5b3cc4", "#2b8cff"],
] as const;

export function projectThumbStyle(id: string, name: string): CSSProperties {
  let hash = 0;
  const key = `${id}:${name}`;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  const [a, b] = PALETTES[hash % PALETTES.length]!;
  return {
    background: `linear-gradient(135deg, ${a}, ${b})`,
  };
}

export function projectInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "P";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}
