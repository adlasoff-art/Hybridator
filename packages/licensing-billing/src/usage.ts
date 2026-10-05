import type { Plan, ProductConfig } from "./schema";

export interface UsageEvent {
  id: string;
  at: string;
  /** Clé de quota (stt, ai_analysis, tts, generative, cloud_storage). */
  feature: string;
  quantity: number;
  unit: string;
  /** Identifiant opaque du fournisseur (ex. demo, server-proxy). */
  provider: string;
  projectId?: string;
  ok: boolean;
  error?: string;
  /** Coût indicatif USD (journal admin) — calculé à l'append, immuable ensuite. */
  costUsd: number;
}

export interface UsageLedger {
  totals: Record<string, number>;
  /** Journal append-only : les entrées existantes ne sont jamais mutées. */
  events: readonly UsageEvent[];
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
      `Quota « ${feature} » insuffisant : ${used + requested} > ${limit}. Votre travail est conservé.`,
    );
  }
}

export function createUsageLedger(seed?: Partial<UsageLedger>): UsageLedger {
  return {
    totals: { ...(seed?.totals ?? {}) },
    events: Object.freeze([...(seed?.events ?? [])]) as readonly UsageEvent[],
  };
}

/**
 * Limite plan isolée par sous-système.
 * Pendant l'essai (aiMinutesCap), STT / analyse sont plafonnés par config.trial.aiMinutes.
 */
export function planLimit(
  plan: Plan,
  feature: string,
  opts?: { trialAiMinutesCap?: number | undefined },
): number | null {
  switch (feature) {
    case "stt":
    case "ai_analysis": {
      const base = plan.aiMinutesMonthly;
      if (opts?.trialAiMinutesCap !== undefined && base !== null) {
        return Math.min(base, opts.trialAiMinutesCap);
      }
      return base;
    }
    case "tts":
      return plan.ttsCharsMonthly;
    case "generative":
      return plan.generativeSecondsMonthly;
    case "cloud_storage":
      return plan.cloudStorageGb;
    default:
      return null;
  }
}

export function estimateCostUsd(
  rates: Record<string, number>,
  feature: string,
  quantity: number,
): number {
  const rate = rates[feature] ?? 0;
  return Math.round(rate * quantity * 1e6) / 1e6;
}

export function assertQuota(
  plan: Plan,
  ledger: UsageLedger,
  feature: string,
  quantity: number,
  opts?: { trialAiMinutesCap?: number | undefined },
): void {
  const limit = planLimit(plan, feature, opts);
  if (limit === null) return;
  const used = ledger.totals[feature] ?? 0;
  if (used + quantity > limit) {
    throw new QuotaExceededError(feature, limit, used, quantity);
  }
}

/**
 * Ajoute un usage_events immuable (prepend). Les événements antérieurs restent intacts.
 */
export function recordUsage(
  ledger: UsageLedger,
  event: Omit<UsageEvent, "id" | "at" | "costUsd"> & {
    id?: string;
    at?: string;
    costUsd?: number;
  },
  rates: Record<string, number> = {},
): UsageLedger {
  const full: UsageEvent = {
    id: event.id ?? `ue_${Math.random().toString(36).slice(2, 10)}`,
    at: event.at ?? new Date().toISOString(),
    feature: event.feature,
    quantity: event.quantity,
    unit: event.unit,
    provider: event.provider,
    ok: event.ok,
    costUsd:
      event.costUsd ?? (event.ok ? estimateCostUsd(rates, event.feature, event.quantity) : 0),
    ...(event.projectId !== undefined ? { projectId: event.projectId } : {}),
    ...(event.error !== undefined ? { error: event.error } : {}),
  };
  const totals = { ...ledger.totals };
  if (full.ok) {
    totals[full.feature] = (totals[full.feature] ?? 0) + full.quantity;
  }
  // Append-only : nouvelle liste, aucun rewrite des événements passés
  const events = Object.freeze([full, ...ledger.events].slice(0, 2000)) as readonly UsageEvent[];
  return { totals, events };
}

/** Cap d'essai STT/analyse depuis la config produit. */
export function trialAiCap(config: ProductConfig, inTrial: boolean): number | undefined {
  return inTrial ? config.trial.aiMinutes : undefined;
}
