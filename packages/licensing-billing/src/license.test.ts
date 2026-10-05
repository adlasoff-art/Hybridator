import { describe, expect, it } from "vitest";
import {
  createDeviceFingerprint,
  enforceDeviceLimit,
  heartbeatSession,
  revokeSession,
  upsertCurrentSession,
  type DeviceSession,
} from "./device";
import { defaultProductConfig } from "./defaults";
import {
  defaultLicenseTtlSec,
  issueLicenseJwt,
  resolveEntitlement,
  verifyLicenseAtStartup,
  verifyLicenseJwt,
} from "./license";

const SECRET = "test-device-secret";
const LICENSE_SECRET = "test-license-secret";

describe("device fingerprint + sessions", () => {
  it("signs and verifies a device fingerprint", async () => {
    const fp = await createDeviceFingerprint({
      deviceId: "dev-1",
      platform: "web",
      label: "Chrome",
      userAgent: "Mozilla/5.0",
      deviceSecret: SECRET,
    });
    expect(fp.signature.length).toBeGreaterThan(10);
    const { verifyDeviceFingerprint } = await import("./device");
    await expect(verifyDeviceFingerprint(fp, SECRET)).resolves.toBe(true);
    await expect(verifyDeviceFingerprint(fp, "wrong")).resolves.toBe(false);
  });

  it("enforces plan device limit by remote-revoking oldest sessions", () => {
    const sessions: DeviceSession[] = [
      {
        id: "s1",
        deviceId: "a",
        name: "A",
        platform: "web",
        os: "Win",
        lastHeartbeatAt: "2026-01-01T00:00:00.000Z",
        revoked: false,
        current: true,
      },
      {
        id: "s2",
        deviceId: "b",
        name: "B",
        platform: "desktop",
        os: "macOS",
        lastHeartbeatAt: "2026-01-02T00:00:00.000Z",
        revoked: false,
        current: false,
      },
      {
        id: "s3",
        deviceId: "c",
        name: "C",
        platform: "mobile",
        os: "iOS",
        lastHeartbeatAt: "2026-01-03T00:00:00.000Z",
        revoked: false,
        current: false,
      },
    ];
    const { sessions: next, revokedIds } = enforceDeviceLimit(sessions, 2);
    expect(revokedIds).toHaveLength(1);
    expect(next.find((s) => s.id === "s1")?.revoked).toBe(false);
    expect(next.filter((s) => !s.revoked)).toHaveLength(2);
  });

  it("supports heartbeat and remote logout", () => {
    let sessions = upsertCurrentSession(
      [],
      {
        deviceId: "d1",
        platform: "web",
        label: "Now",
        userAgentHash: "x",
        signedAt: new Date().toISOString(),
        signature: "sig",
      },
      "Chrome",
    );
    sessions = [
      ...sessions,
      {
        id: "old",
        deviceId: "d2",
        name: "Other",
        platform: "desktop",
        os: "Win",
        lastHeartbeatAt: "2026-01-01T00:00:00.000Z",
        revoked: false,
        current: false,
      },
    ];
    sessions = heartbeatSession(sessions, "d1", new Date("2026-06-01T12:00:00.000Z"));
    expect(sessions.find((s) => s.deviceId === "d1")?.lastHeartbeatAt).toBe(
      "2026-06-01T12:00:00.000Z",
    );
    sessions = revokeSession(sessions, "old");
    expect(sessions.find((s) => s.id === "old")?.revoked).toBe(true);
  });
});

describe("license JWT + entitlement", () => {
  it("issues and verifies JWT; rejects tampering", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await issueLicenseJwt(
      {
        sub: "acc-1",
        planId: "studio",
        deviceId: "dev-1",
        iat: now,
        exp: now + defaultLicenseTtlSec(),
      },
      LICENSE_SECRET,
    );
    const ok = await verifyLicenseJwt(token.jwt, LICENSE_SECRET);
    expect(ok.ok).toBe(true);
    const bad = await verifyLicenseJwt(token.jwt.slice(0, -2) + "aa", LICENSE_SECRET);
    expect(bad.ok).toBe(false);
  });

  it("falls back to free plan after trial (watermark, no cloud)", () => {
    const started = new Date(Date.now() - 20 * 86_400_000).toISOString();
    const ent = resolveEntitlement(
      defaultProductConfig,
      { accountId: "a", planId: null, trialStartedAt: started },
      { featureCloudSync: true },
    );
    expect(ent.inTrial).toBe(false);
    expect(ent.activePlan.id).toBe("free");
    expect(ent.watermark).toBe(true);
    expect(ent.cloudSyncAllowed).toBe(false);
    expect(ent.trialDaysLeft).toBe(0);
  });

  it("uses trial plan during trial window", () => {
    const started = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const ent = resolveEntitlement(defaultProductConfig, {
      accountId: "a",
      planId: null,
      trialStartedAt: started,
    });
    expect(ent.inTrial).toBe(true);
    expect(ent.activePlan.id).toBe("studio");
    expect(ent.trialDaysLeft).toBeGreaterThan(0);
  });

  it("verifies license at startup with fingerprint + JWT", async () => {
    const fp = await createDeviceFingerprint({
      deviceId: "dev-1",
      platform: "pwa",
      label: "PWA",
      userAgent: "HybridatorTest",
      deviceSecret: SECRET,
    });
    const now = Math.floor(Date.now() / 1000);
    const token = await issueLicenseJwt(
      {
        sub: "acc-1",
        planId: "creator",
        deviceId: "dev-1",
        iat: now,
        exp: now + 3600,
      },
      LICENSE_SECRET,
    );
    const ok = await verifyLicenseAtStartup({
      fingerprint: fp,
      deviceSecret: SECRET,
      jwt: token.jwt,
      signingSecret: LICENSE_SECRET,
      expectedDeviceId: "dev-1",
    });
    expect(ok.ok).toBe(true);
  });
});
