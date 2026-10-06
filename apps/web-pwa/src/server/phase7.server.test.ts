import { describe, expect, it, vi } from "vitest";
import { segmentsFromProviderWords, callDeepgram } from "./stt-providers.server";
import {
  createStripeCheckoutSession,
  planIdFromStripeEvent,
  stripePriceIdForPlan,
} from "./billing-stripe.server";
import { syncGet, syncList, syncPut, syncResetForTests } from "./sync-store.server";
import type { EditorDoc } from "@hybridator/core-model";

describe("stt providers", () => {
  it("maps provider words to segments", () => {
    const segs = segmentsFromProviderWords([
      { word: "Bonjour", start: 0, end: 0.4 },
      { word: "monde", start: 0.45, end: 0.9 },
    ]);
    expect(segs[0]?.text).toBe("Bonjour monde");
  });

  it("calls Deepgram with Token auth (mocked)", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        results: {
          channels: [
            {
              alternatives: [
                {
                  transcript: "hello there",
                  words: [
                    { word: "hello", start: 0, end: 0.3, confidence: 0.99 },
                    { word: "there", start: 0.35, end: 0.7, confidence: 0.98 },
                  ],
                },
              ],
            },
          ],
        },
      }),
    }));

    const result = await callDeepgram({
      apiKey: "dg-test",
      mediaUri: "https://example.com/a.wav",
      language: "en",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.rawProvider).toBe("deepgram");
    expect(result.segments[0]?.words).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalled();
    const firstCall = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const headers = firstCall[1].headers as Record<string, string>;
    expect(String(headers["Authorization"])).toContain("Token");
  });
});

describe("stripe billing", () => {
  it("reads price id from env mapping", () => {
    process.env["STRIPE_PRICE_CREATOR"] = "price_test_123";
    expect(stripePriceIdForPlan("creator")).toBe("price_test_123");
    delete process.env["STRIPE_PRICE_CREATOR"];
  });

  it("creates checkout session when configured (mocked Stripe)", async () => {
    process.env["STRIPE_SECRET_KEY"] = "sk_test_x";
    process.env["STRIPE_PRICE_CREATOR"] = "price_abc";
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: "cs_1", url: "https://checkout.stripe.com/c/pay/cs_1" }),
    })) as unknown as typeof fetch;

    const result = await createStripeCheckoutSession({
      planId: "creator",
      accountId: "acc_1",
      customerEmail: "a@b.c",
      fetchImpl,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.checkoutUrl).toContain("checkout.stripe.com");
    delete process.env["STRIPE_SECRET_KEY"];
    delete process.env["STRIPE_PRICE_CREATOR"];
  });

  it("maps webhook checkout.session.completed", () => {
    const mapped = planIdFromStripeEvent({
      type: "checkout.session.completed",
      data: { object: { metadata: { planId: "studio", accountId: "acc_9" } } },
    });
    expect(mapped).toEqual({ planId: "studio", accountId: "acc_9" });
  });
});

describe("sync store", () => {
  it("puts and lists projects per account", () => {
    syncResetForTests();
    const doc = {
      id: "p1",
      createdAt: "t0",
      updatedAt: "t0",
      settings: {
        name: "Cloud",
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
    } satisfies EditorDoc;
    syncPut("acc_a", doc);
    expect(syncList("acc_a")).toHaveLength(1);
    expect(syncGet("acc_a", "p1")?.settings.name).toBe("Cloud");
    expect(syncList("acc_b")).toHaveLength(0);
  });
});
