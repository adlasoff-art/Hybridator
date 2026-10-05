import { z } from "zod";

/**
 * Configuration produit centrale.
 * Toutes les données commerciales, de marque et de limites vivent ici.
 * Les pages ne doivent JAMAIS coder ces valeurs en dur : elles lisent cette config
 * (via useProductConfig). Plus tard, elle pourra provenir du back-end sans toucher l'UI.
 */

const planSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  /** Prix mensuel indicatif ; null = sur devis */
  priceMonthly: z.number().nullable(),
  /** Nombre d'appareils actifs ; null = illimité */
  devices: z.number().nullable(),
  platforms: z.array(z.string()),
  cloudSync: z.boolean(),
  cloudStorageGb: z.number().nullable(),
  cloudLabel: z.string(),
  exportLabel: z.string(),
  /** Niveau d'export comparé à minExportTier des préréglages */
  exportTier: z.number(),
  watermark: z.boolean(),
  /** Angles multi-caméras ; null = illimité */
  multicamAngles: z.number().nullable(),
  /** Minutes IA mensuelles ; null = sur mesure */
  aiMinutesMonthly: z.number().nullable(),
  aiLabel: z.string(),
  highlighted: z.boolean(),
});

const exportPresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  container: z.string(),
  aspectRatio: z.string(),
  minExportTier: z.number(),
});

const quotaSchema = z.object({
  key: z.string(),
  label: z.string(),
  unit: z.string(),
});

export const productConfigSchema = z.object({
  brand: z.object({
    name: z.string(),
    tagline: z.string(),
    description: z.string(),
    projectExtension: z.string(),
    bundleExtension: z.string(),
  }),
  currency: z.object({ code: z.string(), locale: z.string() }),
  trial: z.object({
    days: z.number(),
    aiMinutes: z.number(),
    planIdDuringTrial: z.string(),
    fallbackPlanId: z.string(),
  }),
  plans: z.array(planSchema).min(1),
  quotas: z.array(quotaSchema),
  featureFlags: z.record(z.string(), z.boolean()),
  exportPresets: z.array(exportPresetSchema),
  transcript: z.object({
    fillerWords: z.array(z.string()),
    silenceThresholdSec: z.number(),
  }),
  multicam: z.object({ minShotSec: z.number() }),
});

export type ProductConfig = z.infer<typeof productConfigSchema>;
export type Plan = z.infer<typeof planSchema>;
export type ExportPreset = z.infer<typeof exportPresetSchema>;

export const defaultProductConfig: ProductConfig = productConfigSchema.parse({
  brand: {
    name: "Hybridator",
    tagline: "Enregistrez, montez et nettoyez vos podcasts multi-caméras avec l'IA.",
    description:
      "Suite professionnelle d'enregistrement, de montage vidéo/audio et de post-production augmentée par IA, non destructive et multiplateforme.",
    projectExtension: "hyb",
    bundleExtension: "hybx",
  },
  currency: { code: "EUR", locale: "fr-FR" },
  trial: { days: 14, aiMinutes: 30, planIdDuringTrial: "studio", fallbackPlanId: "free" },
  plans: [
    {
      id: "free",
      name: "Free / Essai",
      description: "Essai complet puis mode gratuit illimité en local.",
      priceMonthly: 0,
      devices: 1,
      platforms: ["Desktop", "Web (limité)"],
      cloudSync: false,
      cloudStorageGb: 0,
      cloudLabel: "Local uniquement",
      exportLabel: "1080p (filigrane après essai)",
      exportTier: 0,
      watermark: true,
      multicamAngles: 2,
      aiMinutesMonthly: 30,
      aiLabel: "30 min (fixe)",
      highlighted: false,
    },
    {
      id: "creator",
      name: "Creator Pro",
      description: "Pour les créateurs solo sur deux postes.",
      priceMonthly: 19,
      devices: 2,
      platforms: ["Desktop", "Web", "PWA"],
      cloudSync: true,
      cloudStorageGb: 10,
      cloudLabel: "10 Go Cloud",
      exportLabel: "4K sans filigrane",
      exportTier: 1,
      watermark: false,
      multicamAngles: 4,
      aiMinutesMonthly: 300,
      aiLabel: "300 min / mois",
      highlighted: false,
    },
    {
      id: "studio",
      name: "Studio Multi-Equipment",
      description: "Pour les studios podcast et équipes multi-postes.",
      priceMonthly: 49,
      devices: 5,
      platforms: ["Desktop", "Web", "PWA", "Mobile"],
      cloudSync: true,
      cloudStorageGb: 100,
      cloudLabel: "100 Go Cloud",
      exportLabel: "4K 60 fps multi-cam master",
      exportTier: 2,
      watermark: false,
      multicamAngles: 8,
      aiMinutesMonthly: 1200,
      aiLabel: "1 200 min / mois",
      highlighted: true,
    },
    {
      id: "enterprise",
      name: "Enterprise / Media",
      description: "Flotte d'appareils, cloud dédié et API.",
      priceMonthly: null,
      devices: null,
      platforms: ["Toutes", "API"],
      cloudSync: true,
      cloudStorageGb: null,
      cloudLabel: "Cloud dédié / S3 custom",
      exportLabel: "8K / ProRes / DNxHR",
      exportTier: 3,
      watermark: false,
      multicamAngles: null,
      aiMinutesMonthly: null,
      aiLabel: "Sur mesure / dépassement possible",
      highlighted: false,
    },
  ],
  quotas: [
    { key: "stt", label: "Transcription", unit: "min" },
    { key: "ai_analysis", label: "Analyse du discours", unit: "requêtes" },
    { key: "tts", label: "Synthèse vocale", unit: "caractères" },
    { key: "generative", label: "Génération IA", unit: "s" },
    { key: "cloud_storage", label: "Stockage cloud", unit: "Go" },
  ],
  featureFlags: {
    enable_multicam_mixer: true,
    enable_ai_center: true,
    enable_cloud_sync: false,
    enable_pwa_offline_render: false,
    enable_tts: false,
  },
  exportPresets: [
    {
      id: "youtube",
      name: "YouTube Landscape",
      description: "MP4 H.264 / AAC, 1080p ou 4K, débit optimisé.",
      container: "MP4",
      aspectRatio: "16:9",
      minExportTier: 0,
    },
    {
      id: "shorts",
      name: "Shorts / TikTok / Reels",
      description: "Vertical 9:16, sous-titres incrustés, normalisation -14 LUFS.",
      container: "MP4",
      aspectRatio: "9:16",
      minExportTier: 0,
    },
    {
      id: "master",
      name: "Master professionnel",
      description: "ProRes / DNxHR peu compressé pour étalonnage externe.",
      container: "MOV",
      aspectRatio: "16:9",
      minExportTier: 3,
    },
    {
      id: "stems",
      name: "Pistes audio séparées",
      description: "Stems WAV 24-bit / 48 kHz, une piste par micro.",
      container: "WAV",
      aspectRatio: "audio",
      minExportTier: 1,
    },
  ],
  transcript: {
    fillerWords: ["euh", "hum", "bah", "ben", "genre"],
    silenceThresholdSec: 0.6,
  },
  multicam: { minShotSec: 1.5 },
});

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
