import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  defaultProductConfig,
  findPlan,
  loadProductConfig,
  type Plan,
  type ProductConfig,
} from "./product";
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

function resolveConfig(base: ProductConfig, overrides: Record<string, boolean>): ProductConfig {
  return {
    ...base,
    featureFlags: { ...base.featureFlags, ...overrides },
  };
}

export function ProductConfigProvider({ children }: { children: ReactNode }) {
  const [baseConfig, setBaseConfig] = useState<ProductConfig>(defaultProductConfig);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FLAGS_KEY);
      if (raw) setOverrides(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const remoteUrl = import.meta.env.VITE_PRODUCT_CONFIG_URL as string | undefined;
    let cancelled = false;
    void loadProductConfig({ url: remoteUrl, fallback: defaultProductConfig }).then((cfg) => {
      if (!cancelled) setBaseConfig(cfg);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<ProductConfigContextValue>(() => {
    const config = resolveConfig(baseConfig, overrides);
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
  }, [baseConfig, overrides]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProductConfig(): ProductConfigContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useProductConfig must be used inside ProductConfigProvider");
  return v;
}
