import { describe, expect, it } from "vitest";
import { defaultProductConfig } from "./defaults";
import { findPlan } from "./helpers";
import { assertQuota, createUsageLedger, QuotaExceededError, recordUsage } from "./usage";

describe("usage / quotas", () => {
  it("allows consumption under plan limit and records events", () => {
    const plan = findPlan(defaultProductConfig, "free");
    let ledger = createUsageLedger();
    assertQuota(plan, ledger, "stt", 5);
    ledger = recordUsage(ledger, {
      feature: "stt",
      quantity: 5,
      unit: "min",
      provider: "demo",
      ok: true,
    });
    expect(ledger.totals["stt"]).toBe(5);
    expect(ledger.events).toHaveLength(1);
  });

  it("rejects when quota would be exceeded", () => {
    const plan = findPlan(defaultProductConfig, "free"); // 30 min IA
    const ledger = createUsageLedger({ totals: { stt: 28 } });
    expect(() => assertQuota(plan, ledger, "stt", 5)).toThrow(QuotaExceededError);
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
  });
});
