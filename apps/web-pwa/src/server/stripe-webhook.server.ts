/**
 * Vérification Stripe-Signature (HMAC-SHA256) — secret uniquement serveur.
 * Format : t=<unix>,v1=<hex>[,v1=<hex>…]
 */

const enc = new TextEncoder();

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return toHex(sig);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aa = enc.encode(a.toLowerCase());
  const bb = enc.encode(b.toLowerCase());
  let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa[i]! ^ bb[i]!;
  return diff === 0;
}

export function parseStripeSignatureHeader(header: string): { t: number; v1: string[] } | null {
  let t: number | undefined;
  const v1: string[] = [];
  for (const part of header.split(",")) {
    const [k, ...rest] = part.trim().split("=");
    const v = rest.join("=");
    if (k === "t") {
      const n = Number(v);
      if (Number.isFinite(n)) t = n;
    } else if (k === "v1" && v) v1.push(v);
  }
  if (t === undefined || v1.length === 0) return null;
  return { t, v1 };
}

/** Construit un en-tête de test (jamais utilisé en prod). */
export async function signStripeWebhookPayload(
  payload: string,
  secret: string,
  timestampSec = Math.floor(Date.now() / 1000),
): Promise<string> {
  const v1 = await hmacSha256Hex(secret, `${timestampSec}.${payload}`);
  return `t=${timestampSec},v1=${v1}`;
}

export async function verifyStripeWebhookSignature(options: {
  payload: string;
  header: string | null;
  secret: string;
  /** Tolérance d'horloge (sec). Défaut Stripe : 300. */
  toleranceSec?: number;
  nowSec?: number;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!options.header) return { ok: false, reason: "En-tête Stripe-Signature manquant." };
  const parsed = parseStripeSignatureHeader(options.header);
  if (!parsed) return { ok: false, reason: "En-tête Stripe-Signature malformé." };
  const now = options.nowSec ?? Math.floor(Date.now() / 1000);
  const tolerance = options.toleranceSec ?? 300;
  if (Math.abs(now - parsed.t) > tolerance) {
    return { ok: false, reason: "Horodatage webhook Stripe hors tolérance." };
  }
  const expected = await hmacSha256Hex(options.secret, `${parsed.t}.${options.payload}`);
  const match = parsed.v1.some((sig) => timingSafeEqualHex(sig, expected));
  if (!match) return { ok: false, reason: "Signature webhook Stripe invalide." };
  return { ok: true };
}
