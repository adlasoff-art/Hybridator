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

/** Vérifie le quota puis retourne un recorder d'événement usage_events. */
export function withQuotaGate(
  plan: Plan,
  feature: string,
  quantity: number,
  unit: string,
  provider: string,
  projectId: string,
): {
  before: () => void;
  after: (result: { ok: true } | { ok: false; error: string }) => void;
} {
  return {
    before: () => {
      const ledger = loadUsageLedger();
      assertQuota(plan, ledger, feature, quantity);
    },
    after: (result) => {
      const ledger = loadUsageLedger();
      const next = recordUsage(ledger, {
        feature,
        quantity,
        unit,
        provider,
        projectId,
        ok: result.ok,
        ...(result.ok ? {} : { error: result.error }),
      });
      saveUsageLedger(next);
    },
  };
}
