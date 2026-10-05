import { strToU8 } from "fflate";
import { z } from "zod";
import type { EditorDoc } from "../types";
import { HybParseError } from "./errors";
import {
  docToParts,
  hashParts,
  partsToDoc,
  verifyPartsIntegrity,
  type HybParts,
  type IntegrityMap,
} from "./parts";
import { sha256Bytes } from "./sha256";
import { isZipBytes, readZipJson, unzipFiltered, zipBinaryFiles } from "./zip";

export const HYBX_FORMAT_VERSION = 1;

export type HybxMediaKind = "media" | "proxy" | "waveform" | "thumbnail";

export interface HybxMediaEntry {
  assetId: string;
  path: string;
  sha256: string;
  kind: HybxMediaKind;
  byteLength: number;
}

export interface HybxManifest {
  format: "hybx";
  formatVersion: number;
  generator: string;
  integrity: IntegrityMap;
  media: HybxMediaEntry[];
}

export interface HybxMediaInput {
  assetId: string;
  data: Uint8Array;
  kind?: HybxMediaKind;
  /** Nom de fichier relatif ; défaut media/<assetId>.bin */
  path?: string;
}

export interface HybxReader {
  readonly manifest: HybxManifest;
  /** Liste des chemins déclarés (JSON + médias) sans décompression complète. */
  listEntries(): string[];
  /** Charge uniquement les parts JSON du projet — pas les médias. */
  readDocument(): Promise<EditorDoc>;
  /** Décompresse une seule entrée à la demande et vérifie son SHA-256 si déclarée. */
  readEntry(path: string): Promise<Uint8Array>;
  readMedia(assetId: string, kind?: HybxMediaKind): Promise<Uint8Array>;
}

const manifestSchema = z.object({
  format: z.literal("hybx"),
  formatVersion: z.number().int().positive(),
  generator: z.string(),
  integrity: z.record(z.string(), z.string()),
  media: z.array(
    z.object({
      assetId: z.string(),
      path: z.string(),
      sha256: z.string(),
      kind: z.enum(["media", "proxy", "waveform", "thumbnail"]),
      byteLength: z.number().int().nonnegative(),
    }),
  ),
});

const JSON_PART_FILES = [
  "manifest.json",
  "project.json",
  "timeline.json",
  "transcript.json",
  "assets_manifest.json",
] as const;

export async function serializeHybx(
  doc: EditorDoc,
  options: { generator: string; media?: HybxMediaInput[] },
): Promise<Uint8Array> {
  const parts = await docToParts(doc);
  const integrity = await hashParts(parts);
  const mediaEntries: HybxMediaEntry[] = [];
  const files: Record<string, Uint8Array> = {
    "project.json": strToU8(JSON.stringify(parts.project)),
    "timeline.json": strToU8(JSON.stringify(parts.timeline)),
    "transcript.json": strToU8(JSON.stringify(parts.transcript)),
    "assets_manifest.json": strToU8(JSON.stringify(parts.assets_manifest)),
  };

  for (const m of options.media ?? []) {
    const kind = m.kind ?? "proxy";
    const path = m.path ?? `media/${m.assetId}.bin`;
    const hash = await sha256Bytes(m.data);
    mediaEntries.push({
      assetId: m.assetId,
      path,
      sha256: hash,
      kind,
      byteLength: m.data.byteLength,
    });
    files[path] = m.data;
  }

  const manifest: HybxManifest = {
    format: "hybx",
    formatVersion: HYBX_FORMAT_VERSION,
    generator: options.generator,
    integrity,
    media: mediaEntries,
  };
  files["manifest.json"] = strToU8(JSON.stringify(manifest));
  return zipBinaryFiles(files);
}

class HybxReaderImpl implements HybxReader {
  constructor(
    private readonly zipBytes: Uint8Array,
    readonly manifest: HybxManifest,
  ) {}

  listEntries(): string[] {
    return [...JSON_PART_FILES, ...this.manifest.media.map((m) => m.path)];
  }

  async readDocument(): Promise<EditorDoc> {
    const files = await unzipFiltered(this.zipBytes, (name) =>
      (JSON_PART_FILES as readonly string[]).includes(name),
    );
    let parts: HybParts;
    try {
      parts = {
        project: readZipJson(files, "project.json"),
        timeline: readZipJson(files, "timeline.json"),
        transcript: readZipJson(files, "transcript.json"),
        assets_manifest: readZipJson(files, "assets_manifest.json"),
      };
    } catch (e) {
      throw new HybParseError(
        e instanceof Error ? e.message : "Parts JSON manquantes dans le bundle.",
      );
    }
    await verifyPartsIntegrity(parts, this.manifest.integrity);
    return partsToDoc(parts);
  }

  async readEntry(path: string): Promise<Uint8Array> {
    const files = await unzipFiltered(this.zipBytes, (name) => name === path);
    const data = files[path];
    if (!data) throw new HybParseError(`Entrée introuvable dans le bundle : ${path}`);

    const declared = this.manifest.media.find((m) => m.path === path);
    if (declared) {
      const actual = await sha256Bytes(data);
      if (actual !== declared.sha256) {
        throw new HybParseError(
          `Fichier altéré : empreinte SHA-256 invalide pour ${path}. Le média a été refusé.`,
        );
      }
    }
    return data;
  }

  async readMedia(assetId: string, kind: HybxMediaKind = "proxy"): Promise<Uint8Array> {
    const entry = this.manifest.media.find((m) => m.assetId === assetId && m.kind === kind);
    if (!entry) throw new HybParseError(`Média introuvable dans le bundle : ${assetId} (${kind}).`);
    return this.readEntry(entry.path);
  }
}

/**
 * Ouvre un bundle .hybx. Seul `manifest.json` est décompressé au départ ;
 * les médias sont lus à la demande via `readEntry` / `readMedia`.
 */
export async function openHybx(input: Uint8Array | ArrayBuffer): Promise<HybxReader> {
  const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  if (!isZipBytes(bytes)) {
    throw new HybParseError("Bundle illisible : archive Zip attendue.");
  }

  let files: Record<string, Uint8Array>;
  try {
    files = await unzipFiltered(bytes, (name) => name === "manifest.json");
  } catch {
    throw new HybParseError("Bundle illisible ou corrompu.");
  }

  let manifest: HybxManifest;
  try {
    manifest = readZipJson<HybxManifest>(files, "manifest.json");
  } catch {
    throw new HybParseError("manifest.json manquant dans le bundle.");
  }

  const checked = manifestSchema.safeParse(manifest);
  if (!checked.success) throw new HybParseError("Structure de manifeste .hybx invalide.");
  if (checked.data.formatVersion > HYBX_FORMAT_VERSION) {
    throw new HybParseError("Ce bundle a été créé avec une version plus récente de l'application.");
  }

  return new HybxReaderImpl(bytes, checked.data as HybxManifest);
}
