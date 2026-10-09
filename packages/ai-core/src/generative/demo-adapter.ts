import { buildDemoEditResult, buildDemoGenerativePlan } from "./demo-planner";
import type { GenerativeAiAdapter } from "./types";

/** Adaptateur génératif hors ligne — aucune clé / réseau. */
export function createDemoGenerativeAiAdapter(): GenerativeAiAdapter {
  return {
    providerId: "demo-generative",
    async generateProject(req) {
      return buildDemoGenerativePlan(req);
    },
    async editClip(req) {
      return buildDemoEditResult(req);
    },
  };
}
