import { z } from "zod";
import type { EditorDoc } from "./types";

export const HYB_FORMAT_VERSION = 1;

export interface HybFile {
  format: "hyb";
  formatVersion: number;
  generator: string;
  project: { id: string; createdAt: string; updatedAt: string; settings: EditorDoc["settings"] };
  timeline: {
    tracks: EditorDoc["timeline"]["tracks"];
    removedRanges: EditorDoc["removedRanges"];
    operations: EditorDoc["operations"];
  };
  transcript: EditorDoc["transcript"];
  assets_manifest: { assets: EditorDoc["assets"] };
  integrity: Record<"project" | "timeline" | "transcript" | "assets_manifest", string>;
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function serializeHyb(doc: EditorDoc, generator: string): Promise<string> {
  const assets = await Promise.all(
    doc.assets.map(async (a) => ({ ...a, sha256: a.sha256 ?? (await sha256Hex(a.uri)) })),
  );
  const parts = {
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
  const file: HybFile = {
    format: "hyb",
    formatVersion: HYB_FORMAT_VERSION,
    generator,
    ...parts,
    integrity: {
      project: await sha256Hex(JSON.stringify(parts.project)),
      timeline: await sha256Hex(JSON.stringify(parts.timeline)),
      transcript: await sha256Hex(JSON.stringify(parts.transcript)),
      assets_manifest: await sha256Hex(JSON.stringify(parts.assets_manifest)),
    },
  };
  return JSON.stringify(file);
}

const envelope = z.object({
  format: z.literal("hyb"),
  formatVersion: z.number().int().positive(),
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

export class HybParseError extends Error {}

/** Lit un fichier .hyb, vérifie la version et les empreintes d'intégrité. */
export async function parseHyb(text: string): Promise<EditorDoc> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new HybParseError("Fichier illisible : ce n'est pas un projet valide.");
  }
  const r = envelope.safeParse(raw);
  if (!r.success) throw new HybParseError("Structure de projet invalide.");
  const f = r.data;
  if (f.formatVersion > HYB_FORMAT_VERSION) {
    throw new HybParseError("Ce projet a été créé avec une version plus récente de l'application.");
  }
  const file = raw as HybFile;
  for (const key of ["project", "timeline", "transcript", "assets_manifest"] as const) {
    const expected = f.integrity[key];
    if (expected && expected !== (await sha256Hex(JSON.stringify(file[key])))) {
      throw new HybParseError(`Empreinte d'intégrité invalide (${key}).`);
    }
  }
  return {
    id: file.project.id,
    createdAt: file.project.createdAt,
    updatedAt: file.project.updatedAt,
    settings: file.project.settings,
    assets: file.assets_manifest.assets,
    timeline: { tracks: file.timeline.tracks },
    transcript: file.transcript,
    removedRanges: file.timeline.removedRanges,
    operations: file.timeline.operations,
  };
}
