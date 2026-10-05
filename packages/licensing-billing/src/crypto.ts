/** Utilitaires crypto portables (Web Crypto) — pas de secrets fournisseurs. */

const enc = new TextEncoder();
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    out += B64[a >> 2];
    out += B64[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < bytes.length ? B64[((b & 15) << 2) | (c >> 6)] : "=";
    out += i + 2 < bytes.length ? B64[c & 63] : "=";
  }
  return out;
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, "");
  const len = clean.length;
  const out = new Uint8Array(((len * 3) / 4) | 0);
  let j = 0;
  for (let i = 0; i < len; i += 4) {
    const a = B64.indexOf(clean[i]!);
    const b = B64.indexOf(clean[i + 1]!);
    const c = B64.indexOf(clean[i + 2]!);
    const d = B64.indexOf(clean[i + 3]!);
    out[j++] = (a << 2) | (b >> 4);
    if (clean[i + 2] !== undefined && clean[i + 2] !== "=") out[j++] = ((b & 15) << 4) | (c >> 2);
    if (clean[i + 3] !== undefined && clean[i + 3] !== "=") out[j++] = ((c & 3) << 6) | d;
  }
  return out.slice(0, j);
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64UrlToBytes(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  return base64ToBytes((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
}

export function utf8ToBase64Url(text: string): string {
  return bytesToBase64Url(enc.encode(text));
}

export function base64UrlToUtf8(s: string): string {
  return new TextDecoder().decode(base64UrlToBytes(s));
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hmacSha256Base64Url(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return bytesToBase64Url(new Uint8Array(sig));
}

export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  if (a.length !== b.length) return false;
  const aa = enc.encode(a);
  const bb = enc.encode(b);
  let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa[i]! ^ bb[i]!;
  return diff === 0;
}
