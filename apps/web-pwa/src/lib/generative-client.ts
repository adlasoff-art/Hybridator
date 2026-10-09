import {
  createDemoGenerativeAiAdapter,
  createServerGenerativeAiAdapter,
  type GenerativeAiAdapter,
} from "@hybridator/ai-core";
import { loadAuthToken } from "@/lib/account-session";

/**
 * Préfère `/api/ai/*` (LLM si clé serveur, sinon plan démo serveur).
 * Repli adaptateur démo local si offline.
 */
export async function resolveGenerativeAdapter(): Promise<{
  adapter: GenerativeAiAdapter;
  mode: "server" | "demo";
}> {
  try {
    const health = await fetch("/api/health");
    if (health.ok) {
      return {
        adapter: createServerGenerativeAiAdapter({
          generateEndpoint: "/api/ai/generate",
          editEndpoint: "/api/ai/edit-clip",
          providerId: "server-generative",
          getAuthHeaders: () => {
            const token = loadAuthToken();
            return token ? { authorization: `Bearer ${token}` } : {};
          },
        }),
        mode: "server",
      };
    }
  } catch {
    /* offline */
  }
  return { adapter: createDemoGenerativeAiAdapter(), mode: "demo" };
}
