import { base64UrlToUtf8, hmacSha256Base64Url, timingSafeEqual, utf8ToBase64Url } from "./crypto";
import type { DeviceFingerprint } from "./device";
import { verifyDeviceFingerprint } from "./device";
import { findPlan } from "./helpers";
import type { Plan, ProductConfig } from "./schema";

export interface LicenseClaims {
  /** Compte opaque. */
  sub: string;
  planId: string;
  deviceId: string;
  /** Issued at (unix sec). */
  iat: number;
  /** Expiry (unix sec). */
  exp: number;
}

export interface LicenseToken {
  jwt: string;
  claims: LicenseClaims;
}

export interface Entitlement {
  activePlan: Plan;
  trialDaysLeft: number;
  inTrial: boolean;
  /** Filigrane imposé par le plan effectif. */
  watermark: boolean;
  /** Sync cloud autorisée (plan + interrupteur + licence). */
  cloudSyncAllowed: boolean;
  licenseValid: boolean;
  reason?: string;
}

export interface AccountState {
  accountId: string;
  /** null = déduit de l'essai. */
  planId: string | null;
  /** ISO date de début d'essai. */
  trialStartedAt: string;
}

const HEADER = utf8ToBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));

export async function issueLicenseJwt(
  claims: LicenseClaims,
  signingSecret: string,
): Promise<LicenseToken> {
  const body = utf8ToBase64Url(JSON.stringify(claims));
  const signingInput = `${HEADER}.${body}`;
  const sig = await hmacSha256Base64Url(signingSecret, signingInput);
  return { jwt: `${signingInput}.${sig}`, claims };
}

export async function verifyLicenseJwt(
  jwt: string,
  signingSecret: string,
  nowSec = Math.floor(Date.now() / 1000),
): Promise<{ ok: true; claims: LicenseClaims } | { ok: false; reason: string }> {
  const parts = jwt.split(".");
  if (parts.length !== 3) return { ok: false, reason: "JWT malformé." };
  const [h, b, s] = parts as [string, string, string];
  const signingInput = `${h}.${b}`;
  const expected = await hmacSha256Base64Url(signingSecret, signingInput);
  if (!(await timingSafeEqual(expected, s)))
    return { ok: false, reason: "Signature JWT invalide." };
  let claims: LicenseClaims;
  try {
    claims = JSON.parse(base64UrlToUtf8(b)) as LicenseClaims;
  } catch {
    return { ok: false, reason: "Claims JWT illisibles." };
  }
  if (typeof claims.exp !== "number" || claims.exp < nowSec) {
    return { ok: false, reason: "Licence expirée." };
  }
  if (typeof claims.iat !== "number" || !claims.sub || !claims.deviceId || !claims.planId) {
    return { ok: false, reason: "Claims JWT incomplets." };
  }
  return { ok: true, claims };
}

export function trialDaysLeft(
  config: ProductConfig,
  trialStartedAt: string,
  now = new Date(),
): number {
  const start = Date.parse(trialStartedAt);
  if (Number.isNaN(start)) return 0;
  const elapsedDays = Math.floor((now.getTime() - start) / 86_400_000);
  return Math.max(0, config.trial.days - elapsedDays);
}

/**
 * Plan effectif + droits selon essai et config produit.
 * Fin d'essai sans abonnement → plan de repli (filigrane, sync off via plan).
 */
export function resolveEntitlement(
  config: ProductConfig,
  account: AccountState,
  opts?: { licenseValid?: boolean; featureCloudSync?: boolean; now?: Date },
): Entitlement {
  const now = opts?.now ?? new Date();
  const left = trialDaysLeft(config, account.trialStartedAt, now);
  const inTrial = left > 0 && account.planId === null;
  const planId =
    account.planId ?? (inTrial ? config.trial.planIdDuringTrial : config.trial.fallbackPlanId);
  const activePlan = findPlan(config, planId);
  const featureCloudSync =
    opts?.featureCloudSync ?? config.featureFlags["enable_cloud_sync"] === true;
  const licenseValid = opts?.licenseValid ?? true;
  const cloudSyncAllowed = licenseValid && featureCloudSync && activePlan.cloudSync;

  const result: Entitlement = {
    activePlan,
    trialDaysLeft: left,
    inTrial,
    watermark: activePlan.watermark,
    cloudSyncAllowed,
    licenseValid,
  };
  if (!licenseValid) result.reason = "Licence invalide ou révoquée.";
  return result;
}

/** Vérifie empreinte + JWT au démarrage. */
export async function verifyLicenseAtStartup(options: {
  fingerprint: DeviceFingerprint;
  deviceSecret: string;
  jwt: string;
  signingSecret: string;
  expectedDeviceId: string;
}): Promise<{ ok: true; claims: LicenseClaims } | { ok: false; reason: string }> {
  const fpOk = await verifyDeviceFingerprint(options.fingerprint, options.deviceSecret);
  if (!fpOk) return { ok: false, reason: "Empreinte d'appareil invalide." };
  if (options.fingerprint.deviceId !== options.expectedDeviceId) {
    return { ok: false, reason: "Empreinte / appareil courant incohérents." };
  }
  const verified = await verifyLicenseJwt(options.jwt, options.signingSecret);
  if (!verified.ok) return verified;
  if (verified.claims.deviceId !== options.fingerprint.deviceId) {
    return { ok: false, reason: "JWT lié à un autre appareil." };
  }
  return verified;
}

export function defaultLicenseTtlSec(): number {
  return 60 * 60 * 12;
}
