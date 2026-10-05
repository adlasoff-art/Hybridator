import type { Plan } from "./schema";

export interface UsageEvent {
  id: string;
  at: string;
  /** Clé de quota (stt, ai_analysis, …) — jamais une clé API. */
  feature: string;
  quantity: number;
  unit: string;
  /** Identifiant opaque du fournisseur (ex. demo, server-proxy). */
  provider: string;
  projectId?: string;
  ok: boolean;
  error?: string;
}

export interface UsageLedger {
  totals: Record<string, number>;
  events: UsageEvent[];
}

export class QuotaExceededError extends Error {
  override readonly name = "QuotaExceededError";
  constructor(
    readonly feature: string,
    readonly limit: number,
    readonly used: number,
    readonly requested: number,
  ) {
    super(
      `Quota « ${feature} » insuffisant : ${used + requested} > ${limit}. Le projet n'a pas été modifié.`,
    );
  }
}

export function createUsageLedger(seed?: Partial<UsageLedger>): UsageLedger {
  return {
    totals: { ...(seed?.totals ?? {}) },
    events: [...(seed?.events ?? [])],
  };
}

/** Limite plan pour une clé de quota. null = illimité / sur mesure. */
export function planLimit(plan: Plan, feature: string): number | null {
  switch (feature) {
    case "stt":
    case "ai_analysis":
      return plan.aiMinutesMonthly;
    case "cloud_storage":
      return plan.cloudStorageGb;
    default:
      return null;
  }
}

export function assertQuota(
  plan: Plan,
  ledger: UsageLedger,
  feature: string,
  quantity: number,
): void {
  const limit = planLimit(plan, feature);
  if (limit === null) return;
  const used = ledger.totals[feature] ?? 0;
  if (used + quantity > limit) {
    throw new QuotaExceededError(feature, limit, used, quantity);
  }
}

export function recordUsage(
  ledger: UsageLedger,
  event: Omit<UsageEvent, "id" | "at"> & { id?: string; at?: string },
): UsageLedger {
  const full: UsageEvent = {
    id: event.id ?? `ue_${Math.random().toString(36).slice(2, 10)}`,
    at: event.at ?? new Date().toISOString(),
    feature: event.feature,
    quantity: event.quantity,
    unit: event.unit,
    provider: event.provider,
    ok: event.ok,
    ...(event.projectId !== undefined ? { projectId: event.projectId } : {}),
    ...(event.error !== undefined ? { error: event.error } : {}),
  };
  const totals = { ...ledger.totals };
  if (full.ok) {
    totals[full.feature] = (totals[full.feature] ?? 0) + full.quantity;
  }
  return {
    totals,
    events: [full, ...ledger.events].slice(0, 500),
  };
}
