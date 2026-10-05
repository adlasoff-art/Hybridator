import { describe, expect, it } from "vitest";
import { defaultProductConfig } from "./defaults";
import { findPlan } from "./helpers";
import {
  assertQuota,
  createUsageLedger,
  estimateCostUsd,
  planLimit,
  QuotaExceededError,
  recordUsage,
} from "./usage";

describe("usage / quotas", () => {
  it("allows consumption under plan limit and records immutable events with cost", () => {
    const plan = findPlan(defaultProductConfig, "free");
    let ledger = createUsageLedger();
    assertQuota(plan, ledger, "stt", 5);
    ledger = recordUsage(
      ledger,
      {
        feature: "stt",
        quantity: 5,
        unit: "min",
        provider: "demo",
        ok: true,
      },
      defaultProductConfig.usageCostRatesUsd,
    );
    expect(ledger.totals["stt"]).toBe(5);
    expect(ledger.events).toHaveLength(1);
    expect(ledger.events[0]?.costUsd).toBe(
      estimateCostUsd(defaultProductConfig.usageCostRatesUsd, "stt", 5),
    );
    const first = ledger.events[0]!;
    ledger = recordUsage(ledger, {
      feature: "tts",
      quantity: 100,
      unit: "caractères",
      provider: "demo",
      ok: true,
    });
    expect(ledger.events[1]).toEqual(first);
  });

  it("rejects when quota would be exceeded with polite error", () => {
    const plan = findPlan(defaultProductConfig, "free");
    const ledger = createUsageLedger({ totals: { stt: 28 } });
    expect(() => assertQuota(plan, ledger, "stt", 5)).toThrow(QuotaExceededError);
    try {
      assertQuota(plan, ledger, "stt", 5);
    } catch (e) {
      expect((e as Error).message).toMatch(/conservé/);
    }
  });

  it("isolates limits per subsystem", () => {
    const plan = findPlan(defaultProductConfig, "creator");
    expect(planLimit(plan, "stt")).toBe(300);
    expect(planLimit(plan, "tts")).toBe(100_000);
    expect(planLimit(plan, "generative")).toBe(600);
    expect(planLimit(plan, "cloud_storage")).toBe(10);
  });

  it("caps STT by trial.aiMinutes when in trial", () => {
    const plan = findPlan(defaultProductConfig, "studio");
    expect(planLimit(plan, "stt", { trialAiMinutesCap: 30 })).toBe(30);
  });

  it("does not increase totals on failed jobs", () => {
    const ledger = recordUsage(createUsageLedger(), {
      feature: "stt",
      quantity: 10,
      unit: "min",
      provider: "demo",
      ok: false,
      error: "network",
    });
    expect(ledger.totals["stt"]).toBeUndefined();
    expect(ledger.events[0]?.ok).toBe(false);
    expect(ledger.events[0]?.costUsd).toBe(0);
  });
});
