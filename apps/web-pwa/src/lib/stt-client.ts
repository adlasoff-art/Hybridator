import { createDemoSttAdapter, createServerSttAdapter, type SttAdapter } from "@hybridator/ai-core";

/**
 * Préfère le proxy serveur `/api/stt` (secrets côté serveur).
 * Repli démo si le flag est off ou si le health check échoue.
 */
export async function resolveSttAdapter(preferServer: boolean): Promise<{
  adapter: SttAdapter;
  mode: "server" | "demo";
}> {
  if (!preferServer) {
    return { adapter: createDemoSttAdapter(), mode: "demo" };
  }
  try {
    const health = await fetch("/api/health");
    if (health.ok) {
      return {
        adapter: createServerSttAdapter({
          endpoint: "/api/stt",
          providerId: "server-proxy",
        }),
        mode: "server",
      };
    }
  } catch {
    /* offline */
  }
  return { adapter: createDemoSttAdapter(), mode: "demo" };
}
