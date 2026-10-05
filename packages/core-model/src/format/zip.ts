import { strFromU8, strToU8, unzip, zipSync } from "fflate";

export function isZipBytes(data: Uint8Array): boolean {
  return data.length >= 2 && data[0] === 0x50 && data[1] === 0x4b;
}

export function zipJsonFiles(files: Record<string, unknown>): Uint8Array {
  const encoded: Record<string, Uint8Array> = {};
  for (const [name, value] of Object.entries(files)) {
    encoded[name] = strToU8(JSON.stringify(value));
  }
  return zipSync(encoded, { level: 6 });
}

export function zipBinaryFiles(files: Record<string, Uint8Array>): Uint8Array {
  return zipSync(files, { level: 6 });
}

/** Décompresse uniquement les entrées acceptées par `filter` (les autres restent intactes). */
export function unzipFiltered(
  data: Uint8Array,
  filter: (name: string) => boolean,
): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    unzip(data, { filter: (file) => filter(file.name) }, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

export function readZipJson<T>(files: Record<string, Uint8Array>, name: string): T {
  const raw = files[name];
  if (!raw) throw new Error(`Entrée manquante dans l'archive : ${name}`);
  return JSON.parse(strFromU8(raw)) as T;
}
