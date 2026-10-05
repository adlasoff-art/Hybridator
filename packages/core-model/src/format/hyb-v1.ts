import { z } from "zod";
import type { EditorDoc } from "../types";
import { HybParseError } from "./errors";
import { docToParts, hashParts, partsToDoc, type HybParts, type IntegrityMap } from "./parts";
import { sha256Hex, stableJson } from "./sha256";

/** Version legacy : un seul JSON (V0). Toujours lisible pour migration. */
export const HYB_V1_FORMAT_VERSION = 1;

export interface HybV1File {
  format: "hyb";
  formatVersion: 1;
  generator: string;
  project: HybParts["project"];
  timeline: HybParts["timeline"];
  transcript: HybParts["transcript"];
  assets_manifest: HybParts["assets_manifest"];
  integrity: IntegrityMap;
}

const envelope = z.object({
  format: z.literal("hyb"),
  formatVersion: z.literal(1),
  generator: z.string().optional(),
  project: z.object({
    id: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    settings: z.object({ name: z.string() }).passthrough(),
  }),
  timeline: z.object({
    tracks: z.array(z.any()),
    removedRanges: z.array(z.any()),
    operations: z.array(z.any()),
  }),
  transcript: z.object({ segments: z.array(z.any()) }).passthrough(),
  assets_manifest: z.object({ assets: z.array(z.any()) }),
  integrity: z.record(z.string(), z.string()),
});

export async function serializeHybV1(doc: EditorDoc, generator: string): Promise<string> {
  const parts = await docToParts(doc);
  const file: HybV1File = {
    format: "hyb",
    formatVersion: HYB_V1_FORMAT_VERSION,
    generator,
    ...parts,
    integrity: await hashParts(parts),
  };
  return stableJson(file);
}

export async function parseHybV1(text: string): Promise<EditorDoc> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new HybParseError("Fichier illisible : ce n'est pas un projet valide.");
  }
  const r = envelope.safeParse(raw);
  if (!r.success) throw new HybParseError("Structure de projet invalide (format JSON v1).");

  // Utiliser l'objet JSON.parse d'origine pour les empreintes (ordre des clés intact).
  const file = raw as HybV1File;
  const parts: HybParts = {
    project: file.project,
    timeline: file.timeline,
    transcript: file.transcript,
    assets_manifest: file.assets_manifest,
  };
  for (const key of ["project", "timeline", "transcript", "assets_manifest"] as const) {
    const expected = file.integrity[key];
    if (expected && expected !== (await sha256Hex(stableJson(parts[key])))) {
      throw new HybParseError(
        `Fichier altéré : empreinte SHA-256 invalide (${key}). Le projet a été refusé.`,
      );
    }
  }
  return partsToDoc(parts);
}
