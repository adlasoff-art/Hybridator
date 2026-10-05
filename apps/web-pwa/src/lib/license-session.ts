import {
  activeSessions,
  createDeviceFingerprint,
  defaultLicenseTtlSec,
  enforceDeviceLimit,
  heartbeatSession,
  issueLicenseJwt,
  revokeSession,
  upsertCurrentSession,
  verifyLicenseAtStartup,
  type DeviceFingerprint,
  type DevicePlatform,
  type DeviceSession,
  type Plan,
} from "@hybridator/licensing-billing";

const DEVICE_ID_KEY = "hybridator.deviceId";
const DEVICE_SECRET_KEY = "hybridator.deviceSecret";
const LICENSE_SECRET_KEY = "hybridator.licenseSecret";
const JWT_KEY = "hybridator.licenseJwt";
const FP_KEY = "hybridator.deviceFingerprint";
const SESSIONS_KEY = "hybridator.deviceSessions";
const ACCOUNT_ID = "local-demo-account";

export interface LicenseBootstrap {
  deviceId: string;
  fingerprint: DeviceFingerprint;
  jwt: string;
  sessions: DeviceSession[];
  licenseValid: boolean;
  reason?: string;
}

function randomId(): string {
  return crypto.randomUUID?.() ?? `id_${Math.random().toString(36).slice(2, 12)}`;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function ensureSecret(key: string): string {
  let s = localStorage.getItem(key);
  if (!s) {
    s = randomId() + randomId();
    localStorage.setItem(key, s);
  }
  return s;
}

function detectPlatform(): DeviceFingerprint["platform"] {
  const ua = navigator.userAgent;
  if (/Mobile|Android|iPhone/i.test(ua)) return "mobile";
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (window.matchMedia("(display-mode: standalone)").matches) return "pwa";
  return "web";
}

function detectOs(): string {
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad/i.test(ua)) return "iOS";
  return "Navigateur";
}

function seedRemoteSessions(currentDeviceId: string): DeviceSession[] {
  const now = Date.now();
  const seeds: DeviceSession[] = [
    {
      id: "sess_demo_pc",
      deviceId: "demo-pc-montage",
      name: "PC Montage",
      platform: "desktop" satisfies DevicePlatform,
      os: "Windows",
      lastHeartbeatAt: new Date(now - 42 * 60_000).toISOString(),
      revoked: false,
      current: false,
    },
    {
      id: "sess_demo_ipad",
      deviceId: "demo-ipad",
      name: "iPad Régie",
      platform: "tablet",
      os: "iPadOS",
      lastHeartbeatAt: new Date(now - 26 * 60 * 60_000).toISOString(),
      revoked: false,
      current: false,
    },
    {
      id: "sess_demo_chrome",
      deviceId: "demo-chrome",
      name: "Chrome — Bureau",
      platform: "web",
      os: "ChromeOS",
      lastHeartbeatAt: new Date(now - 9 * 24 * 60 * 60_000).toISOString(),
      revoked: false,
      current: false,
    },
  ];
  return seeds.filter((s) => s.deviceId !== currentDeviceId);
}

/** Bootstrap licence : empreinte signée, JWT, sessions, enforcement limite plan. */
export async function bootstrapLicense(plan: Plan): Promise<LicenseBootstrap> {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = randomId();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  const deviceSecret = ensureSecret(DEVICE_SECRET_KEY);
  const licenseSecret = ensureSecret(LICENSE_SECRET_KEY);
  const platform = detectPlatform();
  const label =
    platform === "pwa"
      ? `${navigator.platform || "App"} (PWA)`
      : navigator.platform || "Navigateur";

  const fingerprint = await createDeviceFingerprint({
    deviceId,
    platform,
    label,
    userAgent: navigator.userAgent,
    deviceSecret,
  });
  writeJson(FP_KEY, fingerprint);

  const now = Math.floor(Date.now() / 1000);
  let jwt = localStorage.getItem(JWT_KEY) ?? "";
  let licenseValid = false;
  let reason: string | undefined;
  let usedServer = false;

  if (jwt) {
    // Préférer la vérif serveur (secret jamais côté client en prod)
    try {
      const res = await fetch("/api/license/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jwt, deviceId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { ok: boolean; reason?: string };
        if (data.ok) {
          licenseValid = true;
          usedServer = true;
        } else {
          reason = data.reason;
          jwt = "";
        }
      }
    } catch {
      /* offline — vérif locale */
    }
    if (!licenseValid && jwt) {
      const checked = await verifyLicenseAtStartup({
        fingerprint,
        deviceSecret,
        jwt,
        signingSecret: licenseSecret,
        expectedDeviceId: deviceId,
      });
      if (checked.ok) {
        licenseValid = true;
      } else {
        reason = checked.reason;
        jwt = "";
      }
    }
  }

  if (!jwt) {
    try {
      const res = await fetch("/api/license/issue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId: ACCOUNT_ID,
          planId: plan.id,
          deviceId,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { ok: boolean; jwt?: string };
        if (data.ok && data.jwt) {
          jwt = data.jwt;
          localStorage.setItem(JWT_KEY, jwt);
          licenseValid = true;
          usedServer = true;
          reason = undefined;
        }
      }
    } catch {
      /* offline */
    }
  }

  if (!jwt) {
    const token = await issueLicenseJwt(
      {
        sub: ACCOUNT_ID,
        planId: plan.id,
        deviceId,
        iat: now,
        exp: now + defaultLicenseTtlSec(),
      },
      licenseSecret,
    );
    jwt = token.jwt;
    localStorage.setItem(JWT_KEY, jwt);
    licenseValid = true;
    reason = undefined;
  }

  void usedServer;

  let sessions = readJson<DeviceSession[]>(SESSIONS_KEY) ?? [];
  if (sessions.length === 0) {
    sessions = seedRemoteSessions(deviceId);
  }
  sessions = upsertCurrentSession(sessions, fingerprint, detectOs());
  const enforced = enforceDeviceLimit(sessions, plan.devices);
  sessions = enforced.sessions;
  writeJson(SESSIONS_KEY, sessions);

  const currentRevoked = sessions.find((s) => s.deviceId === deviceId)?.revoked === true;
  if (currentRevoked) {
    licenseValid = false;
    reason = "Session révoquée — limite d'appareils du plan.";
  }

  const result: LicenseBootstrap = {
    deviceId,
    fingerprint,
    jwt,
    sessions: activeSessions(sessions),
    licenseValid,
  };
  if (reason !== undefined) result.reason = reason;
  return result;
}

export function loadDeviceSessions(): DeviceSession[] {
  return activeSessions(readJson<DeviceSession[]>(SESSIONS_KEY) ?? []);
}

export function saveDeviceSessions(sessions: DeviceSession[]): void {
  writeJson(SESSIONS_KEY, sessions);
}

export function remoteLogoutSession(sessionId: string): DeviceSession[] {
  const next = revokeSession(readJson<DeviceSession[]>(SESSIONS_KEY) ?? [], sessionId);
  saveDeviceSessions(next);
  return activeSessions(next);
}

export function tickHeartbeat(deviceId: string): DeviceSession[] {
  const next = heartbeatSession(readJson<DeviceSession[]>(SESSIONS_KEY) ?? [], deviceId);
  saveDeviceSessions(next);
  return activeSessions(next);
}

/** Renouvelle le JWT (heartbeat licence) — préfère l'émission serveur. */
export async function renewLicenseJwt(deviceId: string, planId: string): Promise<string> {
  try {
    const res = await fetch("/api/license/issue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accountId: ACCOUNT_ID, planId, deviceId }),
    });
    if (res.ok) {
      const data = (await res.json()) as { ok: boolean; jwt?: string };
      if (data.ok && data.jwt) {
        localStorage.setItem(JWT_KEY, data.jwt);
        return data.jwt;
      }
    }
  } catch {
    /* offline */
  }
  const licenseSecret = ensureSecret(LICENSE_SECRET_KEY);
  const now = Math.floor(Date.now() / 1000);
  const token = await issueLicenseJwt(
    {
      sub: ACCOUNT_ID,
      planId,
      deviceId,
      iat: now,
      exp: now + defaultLicenseTtlSec(),
    },
    licenseSecret,
  );
  localStorage.setItem(JWT_KEY, token.jwt);
  return token.jwt;
}
