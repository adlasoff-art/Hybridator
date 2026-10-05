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
