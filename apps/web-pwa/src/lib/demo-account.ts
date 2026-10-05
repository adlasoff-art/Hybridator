/**
 * Compte de démonstration (V0, sans comptes réels).
 * planId null = plan déduit de l'essai (voir config.trial).
 */
export const demoAccount: { planId: string | null; trialStartedDaysAgo: number } = {
  planId: null,
  trialStartedDaysAgo: 3,
};

export interface DemoDevice {
  id: string;
  name: string;
  platform: "desktop" | "web" | "pwa" | "mobile" | "tablet";
  os: string;
  lastSeenMinutes: number;
  current: boolean;
}

export const demoDevices: DemoDevice[] = [
  {
    id: "d1",
    name: "MacBook Pro Studio",
    platform: "desktop",
    os: "macOS",
    lastSeenMinutes: 0,
    current: true,
  },
  {
    id: "d2",
    name: "PC Montage",
    platform: "desktop",
    os: "Windows",
    lastSeenMinutes: 42,
    current: false,
  },
  {
    id: "d3",
    name: "iPad Régie",
    platform: "tablet",
    os: "iPadOS",
    lastSeenMinutes: 60 * 26,
    current: false,
  },
  {
    id: "d4",
    name: "Chrome — Bureau",
    platform: "web",
    os: "ChromeOS",
    lastSeenMinutes: 60 * 24 * 9,
    current: false,
  },
];

export interface DemoUsageEvent {
  feature: string;
  quantity: number;
  unit: string;
  provider: string;
  costUsd: number;
}

export const demoUsage: Record<string, number> = {
  stt: 412,
  ai_analysis: 138,
  tts: 0,
  generative: 0,
  cloud_storage: 23,
};

export const demoUsageEvents: DemoUsageEvent[] = [
  { feature: "stt", quantity: 3600, unit: "seconds", provider: "stt-provider-a", costUsd: 0.36 },
  {
    feature: "ai_analysis",
    quantity: 12,
    unit: "credits",
    provider: "llm-provider-a",
    costUsd: 0.09,
  },
  { feature: "stt", quantity: 1800, unit: "seconds", provider: "stt-provider-b", costUsd: 0.13 },
  { feature: "cloud_storage", quantity: 2.1e9, unit: "bytes", provider: "storage", costUsd: 0.04 },
];
