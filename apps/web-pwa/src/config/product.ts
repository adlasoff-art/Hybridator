/**
 * Pont app → package licensing-billing.
 * Les pages ne doivent pas coder de valeurs commerciales en dur.
 */
export {
  defaultProductConfig,
  findPlan,
  formatPrice,
  loadProductConfig,
  planLimit,
  productConfigSchema,
  resolveEntitlement,
  type Entitlement,
  type ExportPreset,
  type Plan,
  type ProductConfig,
} from "@hybridator/licensing-billing";
