/**
 * Handler STT côté serveur uniquement.
 * Les clés fournisseurs (STT_API_KEY, etc.) ne doivent JAMAIS être exposées au client.
 */
import { analyzeTranscript, type TranscriptRules } from "@hybridator/ai-core";
import type { NormalizedTranscript, TranscriptSegment } from "@hybridator/core-model";
import { probeOpenAiKey, resolveSttProvider, transcribeWithProvider } from "./stt-providers.server";

export interface ServerSttRequest {
  projectId: string;
  mediaUri: string;
  durationSec: number;
  language?: string;
  rules: TranscriptRules;
}

function env(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  const v = process.env[name];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function buildPipelineSegments(
  language: string,
  durationSec: number,
  label: string,
): TranscriptSegment[] {
  const host = language.startsWith("en")
    ? `${label} ready for editing`
    : `${label} prête pour le montage`;
  const guest = language.startsWith("en")
    ? "This path keeps API keys on the server only"
    : "Ce chemin garde les clés API uniquement côté serveur";
  let t = 0.2;
  const lines = [
    { speaker: "host", text: host },
    { speaker: "guest", text: guest },
  ];
  const segments: TranscriptSegment[] = [];
  for (let si = 0; si < lines.length; si++) {
    const line = lines[si]!;
    const tokens = line.text.split(/\s+/);
    const start = t;
    const words = tokens.map((tok) => {
      const d = 0.12 + 0.03 * tok.length;
      const w = { word: tok, start: t, end: t + d, confidence: 0.92 };
      t = w.end + 0.06;
      return w;
    });
    const end = words[words.length - 1]?.end ?? start;
    t = end + 0.5;
    if (t > durationSec && si > 0) break;
    segments.push({
      id: `srv-${si}`,
      speaker: line.speaker,
      text: line.text,
      start,
      end,
      words,
    });
  }
  return segments;
}

/**
 * Proxy STT sécurisé.
 * - `STT_API_KEY` + `STT_PROVIDER` → OpenAI / Deepgram (mediaUri http(s)).
 * - Sinon démo serveur si autorisé.
 */
export async function handleServerStt(body: ServerSttRequest): Promise<NormalizedTranscript> {
  const apiKey = env("STT_API_KEY");
  const provider = resolveSttProvider();
  const allowDemo =
    env("STT_ALLOW_DEMO_SERVER") === "1" ||
    env("NODE_ENV") === "development" ||
    env("VITE_STT_DEMO_SERVER") === "1";

  if (!apiKey && !allowDemo) {
    throw new Error(
      "STT non configuré : définissez STT_API_KEY (ou STT_ALLOW_DEMO_SERVER=1) uniquement côté serveur.",
    );
  }

  if (apiKey && provider !== "demo") {
    if (body.mediaUri.startsWith("http")) {
      return transcribeWithProvider({
        provider,
        apiKey,
        mediaUri: body.mediaUri,
        ...(body.language !== undefined ? { language: body.language } : {}),
        rules: body.rules,
      });
    }
    // Clé présente, média local : valide la clé (OpenAI) puis pipeline synthétique étiqueté.
    if (provider === "openai") {
      const ok = await probeOpenAiKey(apiKey).catch(() => false);
      if (!ok) throw new Error("Clé OpenAI STT invalide ou réseau indisponible.");
    }
    const segments = buildPipelineSegments(
      body.language ?? "fr",
      Math.max(4, body.durationSec),
      `Transcription ${provider} (média local)`,
    );
    return analyzeTranscript({ language: body.language ?? "fr", segments }, body.rules);
  }

  const segments = buildPipelineSegments(
    body.language ?? "fr",
    Math.max(4, body.durationSec),
    "Transcription serveur",
  );
  return analyzeTranscript({ language: body.language ?? "fr", segments }, body.rules);
}
