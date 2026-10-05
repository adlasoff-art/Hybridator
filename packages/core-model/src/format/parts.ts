import type { Asset, EditorDoc } from "../types";
import { HybParseError } from "./errors";
import { sha256Hex, stableJson } from "./sha256";

export const HYB_JSON_PARTS = ["project", "timeline", "transcript", "assets_manifest"] as const;
export type HybPartKey = (typeof HYB_JSON_PARTS)[number];

export interface ProjectPart {
  id: string;
  createdAt: string;
  updatedAt: string;
  settings: EditorDoc["settings"];
}

export interface TimelinePart {
  tracks: EditorDoc["timeline"]["tracks"];
  removedRanges: EditorDoc["removedRanges"];
  operations: EditorDoc["operations"];
}

export interface AssetsManifestPart {
  assets: Asset[];
}

export interface HybParts {
  project: ProjectPart;
  timeline: TimelinePart;
  transcript: EditorDoc["transcript"];
  assets_manifest: AssetsManifestPart;
}

export type IntegrityMap = Record<HybPartKey, string>;

export async function docToParts(doc: EditorDoc): Promise<HybParts> {
  const assets = await Promise.all(
    doc.assets.map(async (a) => ({ ...a, sha256: a.sha256 ?? (await sha256Hex(a.uri)) })),
  );
  return {
    project: {
      id: doc.id,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      settings: doc.settings,
    },
    timeline: {
      tracks: doc.timeline.tracks,
      removedRanges: doc.removedRanges,
      operations: doc.operations,
    },
    transcript: doc.transcript,
    assets_manifest: { assets },
  };
}

export function partsToDoc(parts: HybParts): EditorDoc {
  return {
    id: parts.project.id,
    createdAt: parts.project.createdAt,
    updatedAt: parts.project.updatedAt,
    settings: parts.project.settings,
    assets: parts.assets_manifest.assets,
    timeline: { tracks: parts.timeline.tracks },
    transcript: parts.transcript,
    removedRanges: parts.timeline.removedRanges,
    operations: parts.timeline.operations,
  };
}

export async function hashParts(parts: HybParts): Promise<IntegrityMap> {
  const integrity = {} as IntegrityMap;
  for (const key of HYB_JSON_PARTS) {
    integrity[key] = await sha256Hex(stableJson(parts[key]));
  }
  return integrity;
}

export async function verifyPartsIntegrity(
  parts: HybParts,
  integrity: IntegrityMap,
): Promise<void> {
  for (const key of HYB_JSON_PARTS) {
    const expected = integrity[key];
    const actual = await sha256Hex(stableJson(parts[key]));
    if (!expected || expected !== actual) {
      throw new HybParseError(
        `Fichier altéré : empreinte SHA-256 invalide (${key}). Le projet a été refusé.`,
      );
    }
  }
}
