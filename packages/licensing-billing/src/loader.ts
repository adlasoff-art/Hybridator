import { defaultProductConfig } from "./defaults";
import { productConfigSchema, type ProductConfig } from "./schema";

export interface LoadProductConfigOptions {
  /** URL du JSON de configuration distante. Si absente, retourne immédiatement le fallback. */
  url?: string | undefined;
  fetchImpl?: typeof fetch | undefined;
  /** Timeout réseau en ms (défaut 4 s). */
  timeoutMs?: number | undefined;
  fallback?: ProductConfig | undefined;
}

/**
 * Charge la configuration produit depuis le back-end.
 * En cas d'échec (réseau, parse Zod), repli sur `defaultProductConfig`.
 */
export async function loadProductConfig(
  options: LoadProductConfigOptions = {},
): Promise<ProductConfig> {
  const fallback = options.fallback ?? defaultProductConfig;
  const url = options.url;
  if (!url) return fallback;

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") return fallback;

  const timeoutMs = options.timeoutMs ?? 4000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(url, { signal: controller.signal });
    if (!res.ok) return fallback;
    const json: unknown = await res.json();
    const parsed = productConfigSchema.safeParse(json);
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
