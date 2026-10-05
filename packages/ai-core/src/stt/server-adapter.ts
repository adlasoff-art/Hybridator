import { analyzeTranscript, type TranscriptRules } from "../analyze";
import type { SttAdapter, SttJob } from "./types";

export interface ServerSttAdapterOptions {
  /** Endpoint serveur (ex. /api/ai/stt) — les clés API restent côté serveur. */
  endpoint: string;
  fetchImpl?: typeof fetch;
  /** Identifiant opaque renvoyé / journalisé (pas une clé). */
  providerId?: string;
}

/**
 * Adaptateur STT via proxy serveur.
 * Le client n'envoie jamais de secret ; le serveur injecte la clé fournisseur.
 */
export function createServerSttAdapter(options: ServerSttAdapterOptions): SttAdapter {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  return {
    providerId: options.providerId ?? "server-proxy",
    async transcribe(job: SttJob, rules: TranscriptRules, signal) {
      if (typeof fetchImpl !== "function") {
        throw new Error("fetch indisponible pour l'adaptateur STT serveur.");
      }
      const init: RequestInit = {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: job.projectId,
          mediaUri: job.mediaUri,
          durationSec: job.durationSec,
          language: job.language,
          rules,
        }),
      };
      if (signal) init.signal = signal as AbortSignal;
      const res = await fetchImpl(options.endpoint, init);
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(`STT serveur échoué (${res.status}): ${msg || "erreur"}`);
      }
      const json: unknown = await res.json();
      // Le serveur peut renvoyer un NormalizedTranscript complet ou des segments bruts
      if (
        json &&
        typeof json === "object" &&
        "segments" in json &&
        "detections" in json &&
        "metrics" in json
      ) {
        return json as ReturnType<typeof analyzeTranscript>;
      }
      if (json && typeof json === "object" && "segments" in json) {
        const body = json as {
          language?: string;
          segments: Parameters<typeof analyzeTranscript>[0]["segments"];
        };
        return analyzeTranscript(
          { language: body.language ?? job.language ?? "fr", segments: body.segments },
          rules,
        );
      }
      throw new Error("Réponse STT serveur invalide.");
    },
  };
}
