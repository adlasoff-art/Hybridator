import { z } from "zod";
import type { EditorDoc } from "../types";
import { HybParseError } from "./errors";
import { parseHybV1, serializeHybV1 } from "./hyb-v1";
import {
  docToParts,
  hashParts,
  partsToDoc,
  verifyPartsIntegrity,
  type HybParts,
  type IntegrityMap,
} from "./parts";
import { isZipBytes, readZipJson, unzipFiltered, zipJsonFiles } from "./zip";

/** Format courant : archive Zip multi-fichiers. */
export const HYB_FORMAT_VERSION = 2;

export interface HybManifestV2 {
  format: "hyb";
  formatVersion: 2;
  generator: string;
  integrity: IntegrityMap;
}

const manifestSchema = z.object({
  format: z.literal("hyb"),
  formatVersion: z.number().int().positive(),
  generator: z.string(),
  integrity: z.record(z.string(), z.string()),
});

export async function serializeHybZip(doc: EditorDoc, generator: string): Promise<Uint8Array> {
  const parts = await docToParts(doc);
  const integrity = await hashParts(parts);
  const manifest: HybManifestV2 = {
    format: "hyb",
    formatVersion: HYB_FORMAT_VERSION,
    generator,
    integrity,
  };
  return zipJsonFiles({
    "manifest.json": manifest,
    "project.json": parts.project,
    "timeline.json": parts.timeline,
    "transcript.json": parts.transcript,
    "assets_manifest.json": parts.assets_manifest,
  });
}

/** Sérialise au format Zip v2 (binaire). */
export async function serializeHyb(doc: EditorDoc, generator: string): Promise<Uint8Array> {
  return serializeHybZip(doc, generator);
}

/** @deprecated Conservé pour tests / migration explicite. */
export { serializeHybV1 };

export async function parseHybZip(data: Uint8Array): Promise<EditorDoc> {
  let files: Record<string, Uint8Array>;
  try {
    files = await unzipFiltered(data, (name) => name.endsWith(".json"));
  } catch {
    throw new HybParseError("Archive projet illisible ou corrompue.");
  }

  let manifest: HybManifestV2;
  try {
    manifest = readZipJson<HybManifestV2>(files, "manifest.json");
  } catch {
    throw new HybParseError("manifest.json manquant ou invalide.");
  }

  const checked = manifestSchema.safeParse(manifest);
  if (!checked.success) throw new HybParseError("Structure de manifeste invalide.");
  if (checked.data.formatVersion > HYB_FORMAT_VERSION) {
    throw new HybParseError("Ce projet a été créé avec une version plus récente de l'application.");
  }
  if (checked.data.formatVersion < 2) {
    throw new HybParseError("Version de manifeste Zip non supportée.");
  }

  let parts: HybParts;
  try {
    parts = {
      project: readZipJson(files, "project.json"),
      timeline: readZipJson(files, "timeline.json"),
      transcript: readZipJson(files, "transcript.json"),
      assets_manifest: readZipJson(files, "assets_manifest.json"),
    };
  } catch (e) {
    throw new HybParseError(e instanceof Error ? e.message : "Parts JSON manquantes.");
  }

  await verifyPartsIntegrity(parts, manifest.integrity as IntegrityMap);

  for (const asset of parts.assets_manifest.assets) {
    if (asset.sha256 !== undefined && !/^[0-9a-f]{64}$/i.test(asset.sha256)) {
      throw new HybParseError(`Empreinte d'asset invalide (${asset.id}).`);
    }
  }

  return partsToDoc(parts);
}

function looksLikeJsonText(text: string): boolean {
  const t = text.trimStart();
  return t.startsWith("{") || t.startsWith("[");
}

/**
 * Lit un projet .hyb (Zip v2 ou JSON v1 legacy) et migre vers le modèle courant.
 * Accepte string (v1), Uint8Array / ArrayBuffer (v1 UTF-8 ou Zip v2).
 */
export async function parseHyb(input: string | Uint8Array | ArrayBuffer): Promise<EditorDoc> {
  if (typeof input === "string") {
    if (!looksLikeJsonText(input)) {
      throw new HybParseError("Fichier illisible : ce n'est pas un projet valide.");
    }
    return parseHybV1(input);
  }

  const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  if (isZipBytes(bytes)) return parseHybZip(bytes);

  // Tentative UTF-8 JSON v1
  const text = new TextDecoder().decode(bytes);
  if (looksLikeJsonText(text)) return parseHybV1(text);
  throw new HybParseError("Fichier illisible : format de projet non reconnu.");
}
