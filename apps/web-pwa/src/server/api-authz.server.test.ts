import { describe, expect, it, beforeEach } from "vitest";
import { handleApiRequest } from "./api";
import { registerUser } from "./auth-store.server";
import { resetRateLimitsForTests } from "./rate-limit.server";
import { setCloudObjectStoreForTests, syncResetForTests, syncPut } from "./sync-store.server";
import { createEmptyNleDoc } from "@hybridator/core-model";

function req(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

describe("API authz (phases 11–13)", () => {
  beforeEach(async () => {
    await syncResetForTests();
    setCloudObjectStoreForTests(null);
    resetRateLimitsForTests();
  });

  it("sync ignores spoofed x-hybridator-account without Bearer", async () => {
    const victim = await registerUser({
      email: "victim@example.com",
      password: "password123",
    });
    expect(victim.ok).toBe(true);
    if (!victim.ok) return;

    const doc = createEmptyNleDoc({ id: "proj_secret", name: "Secret" });
    await syncPut(victim.user.accountId, doc);

    const list = await handleApiRequest(
      req("/api/sync/projects", {
        headers: { "x-hybridator-account": victim.user.accountId },
      }),
    );
    expect(list?.status).toBe(200);
    const listBody = (await list!.json()) as { projects: { id: string }[] };
    expect(listBody.projects.some((p) => p.id === "proj_secret")).toBe(false);

    const get = await handleApiRequest(
      req(`/api/sync/projects/${encodeURIComponent("proj_secret")}`, {
        headers: { "x-hybridator-account": victim.user.accountId },
      }),
    );
    expect(get?.status).toBe(404);
  });

  it("sync with Bearer reaches own projects only", async () => {
    const a = await registerUser({ email: "a@example.com", password: "password123" });
    const b = await registerUser({ email: "b@example.com", password: "password123" });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;

    const docA = createEmptyNleDoc({ id: "pa", name: "A" });
    await syncPut(a.user.accountId, docA);

    const ok = await handleApiRequest(
      req("/api/sync/projects", {
        headers: { authorization: `Bearer ${a.token}` },
      }),
    );
    const okBody = (await ok!.json()) as { projects: { id: string }[] };
    expect(okBody.projects.some((p) => p.id === "pa")).toBe(true);

    const denied = await handleApiRequest(
      req("/api/sync/projects", {
        headers: { authorization: `Bearer ${b.token}` },
      }),
    );
    const deniedBody = (await denied!.json()) as { projects: { id: string }[] };
    expect(deniedBody.projects.some((p) => p.id === "pa")).toBe(false);
  });

  it("rejects planId escalation via profile and session POST", async () => {
    const reg = await registerUser({
      email: "plan@example.com",
      password: "password123",
    });
    expect(reg.ok).toBe(true);
    if (!reg.ok) return;

    const profile = await handleApiRequest(
      req("/api/auth/profile", {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${reg.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ displayName: "Ok", planId: "studio" }),
      }),
    );
    const profileBody = (await profile!.json()) as { session: { planId: string | null } };
    expect(profileBody.session.planId).toBeNull();

    const session = await handleApiRequest(
      req("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId: reg.user.accountId,
          planId: "studio",
          email: "hacked@evil.com",
        }),
      }),
    );
    const sessionBody = (await session!.json()) as { session: AccountLike };
    expect(sessionBody.session.accountId).toBe("acc_local");
    expect(sessionBody.session.planId).toBeNull();
  });

  it("GET /api/auth/me without token returns demo only", async () => {
    const reg = await registerUser({
      email: "me@example.com",
      password: "password123",
      displayName: "Private",
    });
    expect(reg.ok).toBe(true);
    if (!reg.ok) return;

    const res = await handleApiRequest(
      req("/api/auth/me", {
        headers: { "x-hybridator-account": reg.user.accountId },
      }),
    );
    const body = (await res!.json()) as {
      authenticated: boolean;
      session: { accountId: string; displayName: string };
    };
    expect(body.authenticated).toBe(false);
    expect(body.session.accountId).toBe("acc_local");
    expect(body.session.displayName).not.toBe("Private");
  });

  it("license issue refuses foreign accountId without auth", async () => {
    const prev = process.env["LICENSE_ALLOW_DEV"];
    process.env["LICENSE_ALLOW_DEV"] = "1";
    try {
      const res = await handleApiRequest(
        req("/api/license/issue", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            accountId: "acc_someone_else",
            planId: "creator",
            deviceId: "dev1",
          }),
        }),
      );
      expect(res?.status).toBe(401);
    } finally {
      if (prev === undefined) delete process.env["LICENSE_ALLOW_DEV"];
      else process.env["LICENSE_ALLOW_DEV"] = prev;
    }
  });

  it("TTS requires auth when provider key is configured", async () => {
    const prev = process.env["TTS_API_KEY"];
    process.env["TTS_API_KEY"] = "test-key-not-called";
    try {
      const denied = await handleApiRequest(
        req("/api/ai/tts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: "Bonjour" }),
        }),
      );
      expect(denied?.status).toBe(401);

      const tooLong = "x".repeat(2500);
      const reg = await registerUser({
        email: "tts@example.com",
        password: "password123",
      });
      expect(reg.ok).toBe(true);
      if (!reg.ok) return;
      const long = await handleApiRequest(
        req("/api/ai/tts", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${reg.token}`,
          },
          body: JSON.stringify({ text: tooLong }),
        }),
      );
      expect(long?.status).toBe(400);
    } finally {
      if (prev === undefined) delete process.env["TTS_API_KEY"];
      else process.env["TTS_API_KEY"] = prev;
    }
  });

  it("TTS demo path works without provider key", async () => {
    const prevOpen = process.env["OPENAI_API_KEY"];
    const prevTts = process.env["TTS_API_KEY"];
    delete process.env["OPENAI_API_KEY"];
    delete process.env["TTS_API_KEY"];
    try {
      const res = await handleApiRequest(
        req("/api/ai/tts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: "Demo tone" }),
        }),
      );
      expect(res?.status).toBe(200);
      expect(res?.headers.get("content-type")).toContain("audio/wav");
    } finally {
      if (prevOpen !== undefined) process.env["OPENAI_API_KEY"] = prevOpen;
      if (prevTts !== undefined) process.env["TTS_API_KEY"] = prevTts;
    }
  });
});

interface AccountLike {
  accountId: string;
  planId: string | null;
}
