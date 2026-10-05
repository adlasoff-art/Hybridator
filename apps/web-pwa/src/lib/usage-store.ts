import {
  assertQuota,
  createUsageLedger,
  recordUsage,
  type Plan,
  type UsageLedger,
} from "@hybridator/licensing-billing";

const KEY = "hybridator.usageLedger";

export function loadUsageLedger(): UsageLedger {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return createUsageLedger();
    const parsed = JSON.parse(raw) as UsageLedger;
    return createUsageLedger(parsed);
  } catch {
    return createUsageLedger();
  }
}

export function saveUsageLedger(ledger: UsageLedger): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ledger));
  } catch {
    /* ignore */
  }
}

/** Vérifie le quota puis journalise un usage_events immuable (coût inclus). */
export function withQuotaGate(
  plan: Plan,
  feature: string,
  quantity: number,
  unit: string,
  provider: string,
  projectId: string,
  opts?: {
    rates?: Record<string, number>;
    trialAiMinutesCap?: number;
  },
): {
  before: () => void;
  after: (result: { ok: true } | { ok: false; error: string }) => void;
} {
  const trialOpts =
    opts?.trialAiMinutesCap !== undefined
      ? { trialAiMinutesCap: opts.trialAiMinutesCap }
      : undefined;
  return {
    before: () => {
      const ledger = loadUsageLedger();
      assertQuota(plan, ledger, feature, quantity, trialOpts);
    },
    after: (result) => {
      const ledger = loadUsageLedger();
      const next = recordUsage(
        ledger,
        {
          feature,
          quantity,
          unit,
          provider,
          projectId,
          ok: result.ok,
          ...(result.ok ? {} : { error: result.error }),
        },
        opts?.rates ?? {},
      );
      saveUsageLedger(next);
    },
  };
}
