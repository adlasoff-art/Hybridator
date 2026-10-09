import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_KEYLEN = 64;
/** Paramètres scrypt explicites (N=2^14, r=8, p=1) — alignés OWASP pour auth interactive. */
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt ?? randomBytes(16).toString("hex");
  const hash = scryptSync(password, s, SCRYPT_KEYLEN, SCRYPT_OPTS).toString("hex");
  return { hash, salt: s };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const next = scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_OPTS);
    const prev = Buffer.from(hash, "hex");
    if (prev.length !== next.length) return false;
    return timingSafeEqual(prev, next);
  } catch {
    return false;
  }
}

/** Hash factice pour égaliser le temps de réponse login (anti-énumération). */
export function dummyPasswordVerify(password: string): void {
  try {
    scryptSync(password, "hybridator-dummy-salt", SCRYPT_KEYLEN, SCRYPT_OPTS);
  } catch {
    /* ignore */
  }
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}
