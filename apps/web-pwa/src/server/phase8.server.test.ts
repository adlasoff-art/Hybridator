import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { signStripeWebhookPayload, verifyStripeWebhookSignature } from "./stripe-webhook.server";
import { syncGet, syncList, syncPut, syncResetForTests } from "./sync-store.server";
import type { EditorDoc } from "@hybridator/core-model";

const secret = "whsec_test_phase8";

function sampleDoc(id: string, name: string): EditorDoc {
  return {
    id,
    createdAt: "t0",
    updatedAt: "t0",
    settings: {
      name,
      width: 1920,
      height: 1080,
      fps: 30,
      aspectRatio: "16:9",
      sampleRate: 48000,
    },
    assets: [],
    timeline: { tracks: [] },
    transcript: {
      language: "fr",
      duration: 0,
      segments: [],
      detections: { silences: [], fillers: [], repetitions: [], speechTics: [] },
      metrics: { totalPotentiallySavedTime: 0 },
    },
    removedRanges: [],
    operations: [],
  };
}

describe("stripe webhook signature", () => {
  it("accepts a valid HMAC header", async () => {
    const payload = JSON.stringify({ type: "checkout.session.completed" });
    const now = 1_700_000_000;
    const header = await signStripeWebhookPayload(payload, secret, now);
    const ok = await verifyStripeWebhookSignature({
      payload,
      header,
      secret,
      nowSec: now,
    });
    expect(ok).toEqual({ ok: true });
  });

  it("rejects a tampered payload", async () => {
    const payload = JSON.stringify({ type: "checkout.session.completed" });
    const now = 1_700_000_000;
    const header = await signStripeWebhookPayload(payload, secret, now);
    const bad = await verifyStripeWebhookSignature({
      payload: payload.replace("completed", "hacked"),
      header,
      secret,
      nowSec: now,
    });
    expect(bad.ok).toBe(false);
  });

  it("rejects a stale timestamp", async () => {
    const payload = "{}";
    const now = 1_700_000_000;
    const header = await signStripeWebhookPayload(payload, secret, now - 400);
    const bad = await verifyStripeWebhookSignature({
      payload,
      header,
      secret,
      nowSec: now,
      toleranceSec: 300,
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toMatch(/tolérance/);
  });
});

describe("persistent file sync store", () => {
  it("survives a backend reset when SYNC_DATA_DIR is set", async () => {
    const dir = await mkdtemp(join(tmpdir(), "hyb-sync-"));
    const prev = process.env["SYNC_DATA_DIR"];
    process.env["SYNC_DATA_DIR"] = dir;
    try {
      await syncPut("acc_file", sampleDoc("p-persist", "Persistant"));
      await syncResetForTests();
      process.env["SYNC_DATA_DIR"] = dir;
      const listed = await syncList("acc_file");
      expect(listed).toHaveLength(1);
      expect((await syncGet("acc_file", "p-persist"))?.settings.name).toBe("Persistant");
    } finally {
      if (prev === undefined) delete process.env["SYNC_DATA_DIR"];
      else process.env["SYNC_DATA_DIR"] = prev;
      await rm(dir, { recursive: true, force: true });
    }
  });
});
