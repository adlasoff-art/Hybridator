/**
 * Fournisseurs STT côté serveur uniquement — jamais importés par le client.
 */
import { analyzeTranscript, type TranscriptRules } from "@hybridator/ai-core";
import type { NormalizedTranscript, TranscriptSegment } from "@hybridator/core-model";

export type SttProviderId = "openai" | "deepgram" | "demo";

function env(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  const v = process.env[name];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export function resolveSttProvider(): SttProviderId {
  const raw = (env("STT_PROVIDER") ?? "demo").toLowerCase();
  if (raw === "openai" || raw === "deepgram" || raw === "demo") return raw;
  return "demo";
}

function wordsFromText(
  text: string,
  start: number,
): { words: TranscriptSegment["words"]; end: number } {
  const tokens = text.split(/\s+/).filter(Boolean);
  let t = start;
  const words = tokens.map((tok) => {
    const d = 0.12 + 0.03 * tok.length;
    const w = { word: tok, start: t, end: t + d, confidence: 0.9 };
    t = w.end + 0.05;
    return w;
  });
  return { words, end: words[words.length - 1]?.end ?? start };
}

/** Mappe une réponse texte horodatée (Whisper verbose_json / Deepgram) vers segments. */
export function segmentsFromProviderWords(
  items: Array<{ word: string; start: number; end: number; confidence?: number }>,
  speaker = "host",
): TranscriptSegment[] {
  if (items.length === 0) return [];
  const words = items.map((w) => ({
    word: w.word,
    start: w.start,
    end: w.end,
    confidence: w.confidence ?? 0.9,
  }));
  return [
    {
      id: "prov-0",
      speaker,
      text: words.map((w) => w.word).join(" "),
      start: words[0]!.start,
      end: words[words.length - 1]!.end,
      words,
    },
  ];
}

export async function callOpenAiWhisper(options: {
  apiKey: string;
  mediaUri: string;
  language?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ segments: TranscriptSegment[]; rawProvider: "openai" }> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (!options.mediaUri.startsWith("http")) {
    throw new Error(
      "OpenAI Whisper nécessite une mediaUri http(s). Médias locaux : utilisez un upload serveur.",
    );
  }
  const mediaRes = await fetchImpl(options.mediaUri);
  if (!mediaRes.ok) throw new Error(`Téléchargement média échoué (${mediaRes.status}).`);
  const blob = await mediaRes.blob();
  const form = new FormData();
  form.append("file", blob, "audio.webm");
  form.append("model", env("STT_OPENAI_MODEL") ?? "whisper-1");
  form.append("response_format", "verbose_json");
  if (options.language) form.append("language", options.language.slice(0, 2));

  const res = await fetchImpl("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${options.apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`OpenAI STT échoué (${res.status}): ${msg || "erreur"}`);
  }
  const json = (await res.json()) as {
    text?: string;
    words?: Array<{ word: string; start: number; end: number }>;
    segments?: Array<{ text: string; start: number; end: number }>;
  };
  if (json.words?.length) {
    return { segments: segmentsFromProviderWords(json.words), rawProvider: "openai" };
  }
  if (json.segments?.length) {
    const segments: TranscriptSegment[] = json.segments.map((s, i) => {
      const built = wordsFromText(s.text.trim(), s.start);
      return {
        id: `oai-${i}`,
        speaker: "host",
        text: s.text.trim(),
        start: s.start,
        end: s.end,
        words: built.words,
      };
    });
    return { segments, rawProvider: "openai" };
  }
  const text = json.text?.trim() ?? "";
  const built = wordsFromText(text || "…", 0);
  return {
    segments: [
      {
        id: "oai-0",
        speaker: "host",
        text: text || "…",
        start: 0,
        end: built.end,
        words: built.words,
      },
    ],
    rawProvider: "openai",
  };
}

export async function callDeepgram(options: {
  apiKey: string;
  mediaUri: string;
  language?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ segments: TranscriptSegment[]; rawProvider: "deepgram" }> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (!options.mediaUri.startsWith("http")) {
    throw new Error(
      "Deepgram nécessite une mediaUri http(s). Médias locaux : utilisez un upload serveur.",
    );
  }
  const lang = options.language?.slice(0, 2) ?? "fr";
  const url = `https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=${encodeURIComponent(lang)}`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: options.mediaUri }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`Deepgram STT échoué (${res.status}): ${msg || "erreur"}`);
  }
  const json = (await res.json()) as {
    results?: {
      channels?: Array<{
        alternatives?: Array<{
          transcript?: string;
          words?: Array<{ word: string; start: number; end: number; confidence?: number }>;
        }>;
      }>;
    };
  };
  const alt = json.results?.channels?.[0]?.alternatives?.[0];
  if (alt?.words?.length) {
    return { segments: segmentsFromProviderWords(alt.words), rawProvider: "deepgram" };
  }
  const text = alt?.transcript?.trim() ?? "";
  const built = wordsFromText(text || "…", 0);
  return {
    segments: [
      {
        id: "dg-0",
        speaker: "host",
        text: text || "…",
        start: 0,
        end: built.end,
        words: built.words,
      },
    ],
    rawProvider: "deepgram",
  };
}

/** Vérifie que la clé OpenAI répond (sans facturer un audio). */
export async function probeOpenAiKey(
  apiKey: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<boolean> {
  const res = await fetchImpl("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  return res.ok;
}

export async function transcribeWithProvider(options: {
  provider: SttProviderId;
  apiKey: string;
  mediaUri: string;
  language?: string;
  rules: TranscriptRules;
  fetchImpl?: typeof fetch;
}): Promise<NormalizedTranscript> {
  if (options.provider === "openai") {
    const { segments } = await callOpenAiWhisper({
      apiKey: options.apiKey,
      mediaUri: options.mediaUri,
      ...(options.language !== undefined ? { language: options.language } : {}),
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    });
    return analyzeTranscript({ language: options.language ?? "fr", segments }, options.rules);
  }
  if (options.provider === "deepgram") {
    const { segments } = await callDeepgram({
      apiKey: options.apiKey,
      mediaUri: options.mediaUri,
      ...(options.language !== undefined ? { language: options.language } : {}),
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    });
    return analyzeTranscript({ language: options.language ?? "fr", segments }, options.rules);
  }
  throw new Error("Fournisseur STT demo — utiliser le chemin synthétique.");
}
