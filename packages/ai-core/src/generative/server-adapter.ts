import type {
  GenerativeAiAdapter,
  GenerativeEditRequest,
  GenerativeEditResult,
  GenerativePlan,
  GenerativeProjectRequest,
} from "./types";

export interface ServerGenerativeAiAdapterOptions {
  generateEndpoint?: string;
  editEndpoint?: string;
  fetchImpl?: typeof fetch;
  providerId?: string;
  /** En-têtes auth (ex. Bearer) — fournis par l'hôte UI, jamais de secrets ici. */
  getAuthHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
}

/**
 * Adaptateur via proxy serveur — secrets uniquement côté serveur.
 */
export function createServerGenerativeAiAdapter(
  options: ServerGenerativeAiAdapterOptions = {},
): GenerativeAiAdapter {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const generateEndpoint = options.generateEndpoint ?? "/api/ai/generate";
  const editEndpoint = options.editEndpoint ?? "/api/ai/edit-clip";

  async function headers(): Promise<Record<string, string>> {
    const extra = options.getAuthHeaders ? await options.getAuthHeaders() : {};
    return { "content-type": "application/json", ...extra };
  }

  return {
    providerId: options.providerId ?? "server-generative",
    async generateProject(req: GenerativeProjectRequest): Promise<GenerativePlan> {
      if (typeof fetchImpl !== "function") {
        throw new Error("fetch indisponible pour l'adaptateur IA générative.");
      }
      const res = await fetchImpl(generateEndpoint, {
        method: "POST",
        headers: await headers(),
        body: JSON.stringify(req),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(`IA generate échoué (${res.status}): ${msg || "erreur"}`);
      }
      return (await res.json()) as GenerativePlan;
    },
    async editClip(req: GenerativeEditRequest): Promise<GenerativeEditResult> {
      if (typeof fetchImpl !== "function") {
        throw new Error("fetch indisponible pour l'adaptateur IA générative.");
      }
      const res = await fetchImpl(editEndpoint, {
        method: "POST",
        headers: await headers(),
        body: JSON.stringify(req),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(`IA edit-clip échoué (${res.status}): ${msg || "erreur"}`);
      }
      return (await res.json()) as GenerativeEditResult;
    },
  };
}
