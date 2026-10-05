import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { defaultProductConfig, findPlan, type Plan, type ProductConfig } from "./product";
import { demoAccount } from "@/lib/demo-account";

const FLAGS_KEY = "product.flagOverrides";

interface ProductConfigContextValue {
  config: ProductConfig;
  /** Plan effectif du compte (essai inclus) */
  activePlan: Plan;
  trialDaysLeft: number;
  isFlagOn: (key: string) => boolean;
  setFlag: (key: string, value: boolean) => void;
}

const Ctx = createContext<ProductConfigContextValue | null>(null);

export function ProductConfigProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FLAGS_KEY);
      if (raw) setOverrides(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<ProductConfigContextValue>(() => {
    const config: ProductConfig = {
      ...defaultProductConfig,
      featureFlags: { ...defaultProductConfig.featureFlags, ...overrides },
    };
    const trialDaysLeft = Math.max(0, config.trial.days - demoAccount.trialStartedDaysAgo);
    const planId =
      demoAccount.planId ??
      (trialDaysLeft > 0 ? config.trial.planIdDuringTrial : config.trial.fallbackPlanId);
    return {
      config,
      activePlan: findPlan(config, planId),
      trialDaysLeft,
      isFlagOn: (key) => config.featureFlags[key] === true,
      setFlag: (key, v) =>
        setOverrides((prev) => {
          const next = { ...prev, [key]: v };
          try {
            window.localStorage.setItem(FLAGS_KEY, JSON.stringify(next));
          } catch {
            /* ignore */
          }
          return next;
        }),
    };
  }, [overrides]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProductConfig(): ProductConfigContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useProductConfig must be used inside ProductConfigProvider");
  return v;
}
