import { describe, expect, it } from "vitest";
import {
  assertQuota,
  createUsageLedger,
  defaultProductConfig,
  findPlan,
  QuotaExceededError,
  recordUsage,
  runAiJob,
} from "./quota-test-bridge";

/** F — QA : quota atteint → blocage poli, travail (ledger doc) conservé. */
describe("quota gate (polite block)", () => {
  it("blocks over-quota jobs without mutating prior ledger totals", async () => {
    const plan = findPlan(defaultProductConfig, "free");
    let ledger = createUsageLedger({ totals: { stt: 29 } });
    const docSnapshot = { id: "p1", ops: 3 };

    const result = await runAiJob({
      before: () => assertQuota(plan, ledger, "stt", 5),
      run: async () => {
        throw new Error("should not run");
      },
      after: (r) => {
        ledger = recordUsage(ledger, {
          feature: "stt",
          quantity: 5,
          unit: "min",
          provider: "demo",
          projectId: docSnapshot.id,
          ok: r.ok,
          ...(r.ok ? {} : { error: r.error }),
        });
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/conservé|Quota/);
    expect(ledger.totals["stt"]).toBe(29);
    expect(docSnapshot.ops).toBe(3);
    expect(() => assertQuota(plan, ledger, "stt", 5)).toThrow(QuotaExceededError);
  });
});
