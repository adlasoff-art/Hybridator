import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  defaultProductConfig,
  loadProductConfig,
  resolveEntitlement,
  type Entitlement,
  type ProductConfig,
} from "./product";
import { demoAccount, demoTrialStartedAt } from "@/lib/demo-account";
import {
  bootstrapLicense,
  renewLicenseJwt,
  tickHeartbeat,
  type LicenseBootstrap,
} from "@/lib/license-session";

const FLAGS_KEY = "product.flagOverrides";

interface ProductConfigContextValue {
  config: ProductConfig;
  /** Plan effectif du compte (essai inclus) */
  activePlan: Entitlement["activePlan"];
  trialDaysLeft: number;
  inTrial: boolean;
  watermark: boolean;
  cloudSyncAllowed: boolean;
  licenseValid: boolean;
  licenseReason?: string;
  deviceId: string | null;
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
  const [license, setLicense] = useState<LicenseBootstrap | null>(null);

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

  const config = useMemo(() => resolveConfig(baseConfig, overrides), [baseConfig, overrides]);

  const entitlement = useMemo(() => {
    return resolveEntitlement(
      config,
      {
        accountId: "local-demo-account",
        planId: demoAccount.planId,
        trialStartedAt: demoTrialStartedAt(),
      },
      {
        licenseValid: license?.licenseValid ?? true,
        featureCloudSync: config.featureFlags["enable_cloud_sync"] === true,
      },
    );
  }, [config, license?.licenseValid]);

  // Vérification licence au démarrage + heartbeat
  useEffect(() => {
    let cancelled = false;
    let hb: number | undefined;
    void bootstrapLicense(entitlement.activePlan).then((boot) => {
      if (cancelled) return;
      setLicense(boot);
      hb = window.setInterval(() => {
        tickHeartbeat(boot.deviceId);
        void renewLicenseJwt(boot.deviceId, entitlement.activePlan.id);
      }, 60_000);
    });
    return () => {
      cancelled = true;
      if (hb !== undefined) window.clearInterval(hb);
    };
    // re-bootstrap when plan id changes (essai → repli)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entitlement.activePlan.id]);

  const value = useMemo<ProductConfigContextValue>(() => {
    const result: ProductConfigContextValue = {
      config,
      activePlan: entitlement.activePlan,
      trialDaysLeft: entitlement.trialDaysLeft,
      inTrial: entitlement.inTrial,
      watermark: entitlement.watermark,
      cloudSyncAllowed: entitlement.cloudSyncAllowed,
      licenseValid: entitlement.licenseValid,
      deviceId: license?.deviceId ?? null,
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
    if (license?.reason !== undefined) result.licenseReason = license.reason;
    else if (entitlement.reason !== undefined) result.licenseReason = entitlement.reason;
    return result;
  }, [config, entitlement, license]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProductConfig(): ProductConfigContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useProductConfig must be used inside ProductConfigProvider");
  return v;
}
