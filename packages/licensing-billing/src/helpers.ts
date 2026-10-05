import type { Plan, ProductConfig } from "./schema";

export function formatPrice(config: ProductConfig, amount: number): string {
  return new Intl.NumberFormat(config.currency.locale, {
    style: "currency",
    currency: config.currency.code,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function findPlan(config: ProductConfig, id: string): Plan {
  return config.plans.find((p) => p.id === id) ?? (config.plans[0] as Plan);
}
