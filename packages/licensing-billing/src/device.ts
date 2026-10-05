import { hmacSha256Base64Url, sha256Hex } from "./crypto";

export type DevicePlatform = "desktop" | "web" | "pwa" | "mobile" | "tablet";

export interface DeviceFingerprintInput {
  /** Identifiant stable local (UUID persisté). */
  deviceId: string;
  platform: DevicePlatform;
  label: string;
  userAgent: string;
  /** Secret d'appareil local — jamais une clé fournisseur. */
  deviceSecret: string;
}

export interface DeviceFingerprint {
  deviceId: string;
  platform: DevicePlatform;
  label: string;
  userAgentHash: string;
  signedAt: string;
  signature: string;
}

export interface DeviceSession {
  id: string;
  deviceId: string;
  name: string;
  platform: DevicePlatform;
  os: string;
  lastHeartbeatAt: string;
  revoked: boolean;
  current: boolean;
}

/** Empreinte d'appareil signée (HMAC local). */
export async function createDeviceFingerprint(
  input: DeviceFingerprintInput,
  now = new Date(),
): Promise<DeviceFingerprint> {
  const signedAt = now.toISOString();
  const userAgentHash = await sha256Hex(input.userAgent);
  const payload = `${input.deviceId}|${input.platform}|${input.label}|${userAgentHash}|${signedAt}`;
  const signature = await hmacSha256Base64Url(input.deviceSecret, payload);
  return {
    deviceId: input.deviceId,
    platform: input.platform,
    label: input.label,
    userAgentHash,
    signedAt,
    signature,
  };
}

export async function verifyDeviceFingerprint(
  fp: DeviceFingerprint,
  deviceSecret: string,
): Promise<boolean> {
  const payload = `${fp.deviceId}|${fp.platform}|${fp.label}|${fp.userAgentHash}|${fp.signedAt}`;
  const expected = await hmacSha256Base64Url(deviceSecret, payload);
  return expected === fp.signature;
}

export function upsertCurrentSession(
  sessions: DeviceSession[],
  fp: DeviceFingerprint,
  os: string,
  now = new Date(),
): DeviceSession[] {
  const at = now.toISOString();
  const others = sessions
    .filter((s) => s.deviceId !== fp.deviceId)
    .map((s) => ({ ...s, current: false }));
  const existing = sessions.find((s) => s.deviceId === fp.deviceId && !s.revoked);
  const current: DeviceSession = existing
    ? {
        ...existing,
        name: fp.label,
        platform: fp.platform,
        os,
        lastHeartbeatAt: at,
        revoked: false,
        current: true,
      }
    : {
        id: `sess_${fp.deviceId.slice(0, 8)}`,
        deviceId: fp.deviceId,
        name: fp.label,
        platform: fp.platform,
        os,
        lastHeartbeatAt: at,
        revoked: false,
        current: true,
      };
  return [current, ...others.filter((s) => s.id !== current.id)];
}

export function heartbeatSession(
  sessions: DeviceSession[],
  deviceId: string,
  now = new Date(),
): DeviceSession[] {
  const at = now.toISOString();
  return sessions.map((s) =>
    s.deviceId === deviceId && !s.revoked ? { ...s, lastHeartbeatAt: at } : s,
  );
}

/** Déconnexion à distance d'une session (non courante). */
export function revokeSession(sessions: DeviceSession[], sessionId: string): DeviceSession[] {
  return sessions.map((s) =>
    s.id === sessionId && !s.current ? { ...s, revoked: true, current: false } : s,
  );
}

/**
 * Si la limite d'appareils du plan est dépassée, révoque les sessions
 * les plus anciennes (hors appareil courant) jusqu'à rentrer dans le quota.
 */
export function enforceDeviceLimit(
  sessions: DeviceSession[],
  maxDevices: number | null,
): { sessions: DeviceSession[]; revokedIds: string[] } {
  if (maxDevices === null) return { sessions, revokedIds: [] };
  const active = sessions.filter((s) => !s.revoked);
  if (active.length <= maxDevices) return { sessions, revokedIds: [] };

  const sorted = [...active].sort((a, b) => {
    if (a.current !== b.current) return a.current ? 1 : -1;
    return a.lastHeartbeatAt.localeCompare(b.lastHeartbeatAt);
  });
  const toRevoke = sorted.slice(0, active.length - maxDevices);
  const revokedIds = toRevoke.map((s) => s.id);
  const next = sessions.map((s) =>
    revokedIds.includes(s.id) ? { ...s, revoked: true, current: false } : s,
  );
  return { sessions: next, revokedIds };
}

export function activeSessions(sessions: DeviceSession[]): DeviceSession[] {
  return sessions.filter((s) => !s.revoked);
}

export function minutesSinceHeartbeat(session: DeviceSession, now = new Date()): number {
  const then = Date.parse(session.lastHeartbeatAt);
  if (Number.isNaN(then)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.round((now.getTime() - then) / 60_000));
}
