function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getSubtle(): {
  digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer>;
} {
  const subtle = globalThis.crypto?.subtle as
    { digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer> } | undefined;
  if (!subtle) throw new Error("Web Crypto API indisponible (crypto.subtle).");
  return subtle;
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await getSubtle().digest("SHA-256", new TextEncoder().encode(text));
  return toHex(buf);
}

export async function sha256Bytes(data: Uint8Array): Promise<string> {
  // Copie pour garantir un ArrayBuffer (évite SharedArrayBuffer / offset)
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  const buf = await getSubtle().digest("SHA-256", copy);
  return toHex(buf);
}

/** JSON stable pour empreintes (clés dans l'ordre d'insertion de l'objet fourni). */
export function stableJson(value: unknown): string {
  return JSON.stringify(value);
}
