import { describe, expect, it, beforeEach } from "vitest";
import { setCloudObjectStoreForTests, syncResetForTests } from "./sync-store.server";
import {
  loginUser,
  logoutSession,
  registerUser,
  resolveSessionToken,
  updateUserProfile,
} from "./auth-store.server";
import { hashPassword, verifyPassword } from "./auth-crypto.server";

describe("auth crypto", () => {
  it("hashes and verifies passwords", () => {
    const { hash, salt } = hashPassword("secret-pass");
    expect(verifyPassword("secret-pass", hash, salt)).toBe(true);
    expect(verifyPassword("wrong", hash, salt)).toBe(false);
  });
});

describe("auth store", () => {
  beforeEach(async () => {
    await syncResetForTests();
    setCloudObjectStoreForTests(null);
  });

  it("registers, logs in, resolves session, updates profile, logs out", async () => {
    const reg = await registerUser({
      email: "User@Example.com",
      password: "password123",
      displayName: "Ada",
    });
    expect(reg.ok).toBe(true);
    if (!reg.ok) return;
    expect(reg.user.email).toBe("user@example.com");
    expect(reg.token.length).toBeGreaterThan(20);

    const me = await resolveSessionToken(reg.token);
    expect(me?.displayName).toBe("Ada");

    const dup = await registerUser({
      email: "user@example.com",
      password: "password123",
    });
    expect(dup.ok).toBe(false);

    const bad = await loginUser({ email: "user@example.com", password: "nope" });
    expect(bad.ok).toBe(false);

    const login = await loginUser({ email: "user@example.com", password: "password123" });
    expect(login.ok).toBe(true);
    if (!login.ok) return;

    const updated = await updateUserProfile(login.user.accountId, { displayName: "Ada Lovelace" });
    expect(updated?.displayName).toBe("Ada Lovelace");

    await logoutSession(login.token);
    expect(await resolveSessionToken(login.token)).toBeNull();
  });
});
