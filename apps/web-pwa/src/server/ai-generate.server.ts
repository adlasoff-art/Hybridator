import {
  buildDemoEditResult,
  buildDemoGenerativePlan,
  type GenerativeEditIntent,
  type GenerativeEditRequest,
  type GenerativeEditResult,
  type GenerativePlan,
  type GenerativePlanClip,
  type GenerativeProjectRequest,
} from "@hybridator/ai-core";
import { z } from "zod";

function env(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  const v = process.env[name];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

const TRACK_HINTS = ["v1", "v2", "a1", "a2", "t1"] as const;
const CLIP_KINDS = ["video", "audio", "text", "sticker", "music"] as const;

const planClipSchema = z.object({
  trackHint: z.enum(TRACK_HINTS),
  kind: z.enum(CLIP_KINDS),
  label: z.string().min(1).max(200),
  start: z.number().finite().min(0).max(3600),
  duration: z.number().finite().gt(0).max(3600),
  content: z.string().max(2000).optional(),
  effectTypes: z.array(z.string().max(64)).max(12).optional(),
  transitionType: z.string().max(64).optional(),
});

const planSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  durationSec: z.number().finite().gt(0).max(3600).optional(),
  script: z.string().max(8000).optional(),
  voiceoverText: z.string().max(8000).optional(),
  clips: z.array(planClipSchema).max(80).optional(),
});

const intentSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("add_effect"),
    effectType: z.string().min(1).max(64),
    params: z.record(z.union([z.number(), z.string(), z.boolean()])).optional(),
  }),
  z.object({
    type: z.literal("set_transition"),
    transitionType: z.string().min(1).max(64),
    durationSec: z.number().finite().gt(0).max(10).optional(),
  }),
  z.object({
    type: z.literal("noise_reduction"),
    amount: z.number().finite().min(0).max(1),
  }),
  z.object({
    type: z.literal("change_speed"),
    speed: z.number().finite().gt(0).max(8),
  }),
  z.object({
    type: z.literal("add_text_overlay"),
    content: z.string().min(1).max(500),
    durationSec: z.number().finite().gt(0).max(120).optional(),
  }),
  z.object({
    type: z.literal("add_broll_placeholder"),
    label: z.string().min(1).max(200),
    startOffsetSec: z.number().finite().min(0).max(3600).optional(),
    durationSec: z.number().finite().gt(0).max(120).optional(),
  }),
]);

const editSchema = z.object({
  summary: z.string().max(500).optional(),
  intents: z.array(intentSchema).max(20).optional(),
});

export function generativeApiKey(): string | undefined {
  return env("GENERATIVE_API_KEY") ?? env("OPENAI_API_KEY");
}

export function isGenerativeLlmConfigured(): boolean {
  return Boolean(generativeApiKey());
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Réponse LLM non JSON.");
  }
}

async function callOpenAiJson(system: string, user: string): Promise<unknown> {
  const key = generativeApiKey();
  if (!key) throw new Error("Clé générative absente.");
  const model = env("GENERATIVE_OPENAI_MODEL") ?? "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`OpenAI génératif échoué (${res.status}): ${msg}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("Réponse OpenAI vide.");
  return extractJsonObject(content);
}

function normalizePlan(raw: unknown, fallback: GenerativePlan): GenerativePlan {
  const parsed = planSchema.safeParse(raw);
  if (!parsed.success) return fallback;
  const o = parsed.data;
  const clips: GenerativePlanClip[] =
    o.clips && o.clips.length > 0
      ? o.clips.map((c) => ({
          trackHint: c.trackHint,
          kind: c.kind,
          label: c.label,
          start: c.start,
          duration: c.duration,
          ...(c.content !== undefined ? { content: c.content } : {}),
          ...(c.effectTypes !== undefined ? { effectTypes: c.effectTypes } : {}),
          ...(c.transitionType !== undefined ? { transitionType: c.transitionType } : {}),
        }))
      : fallback.clips;
  return {
    title: o.title ?? fallback.title,
    durationSec: o.durationSec ?? fallback.durationSec,
    ...(o.script !== undefined
      ? { script: o.script }
      : fallback.script
        ? { script: fallback.script }
        : {}),
    ...(o.voiceoverText !== undefined
      ? { voiceoverText: o.voiceoverText }
      : fallback.voiceoverText
        ? { voiceoverText: fallback.voiceoverText }
        : {}),
    clips,
    providerId: "openai-generative",
    mode: "llm",
  };
}

function normalizeEdit(raw: unknown, fallback: GenerativeEditResult): GenerativeEditResult {
  const parsed = editSchema.safeParse(raw);
  if (!parsed.success) return fallback;
  const intents = (parsed.data.intents ?? []) as GenerativeEditIntent[];
  if (intents.length === 0) return fallback;
  return {
    summary: parsed.data.summary ?? fallback.summary,
    intents,
    providerId: "openai-generative",
    mode: "llm",
  };
}

/** Scénario A — prompt → plan timeline. */
export async function handleGenerativeProject(
  body: GenerativeProjectRequest,
): Promise<GenerativePlan> {
  const demo = buildDemoGenerativePlan(body);
  if (!isGenerativeLlmConfigured()) return demo;

  try {
    const raw = await callOpenAiJson(
      `Tu es un monteur vidéo. Réponds UNIQUEMENT en JSON avec:
{ "title": string, "durationSec": number, "script": string, "voiceoverText": string,
  "clips": [{ "trackHint": "v1"|"v2"|"a1"|"a2"|"t1", "kind": "video"|"audio"|"text"|"sticker"|"music",
    "label": string, "start": number, "duration": number, "content"?: string,
    "effectTypes"?: string[], "transitionType"?: string }] }
Place vidéo sur v1, broll v2, voix a1, musique a2, textes t1. Durée totale cohérente.`,
      JSON.stringify({
        prompt: body.prompt,
        durationSec: body.durationSec,
        referenceNotes: body.referenceNotes,
        language: body.language ?? "fr",
      }),
    );
    return normalizePlan(raw, demo);
  } catch {
    return { ...demo, providerId: "demo-generative-fallback", mode: "demo" };
  }
}

/** Scénario B — instruction sur clip → intentions. */
export async function handleGenerativeEdit(
  body: GenerativeEditRequest,
): Promise<GenerativeEditResult> {
  const demo = buildDemoEditResult(body);
  if (!isGenerativeLlmConfigured()) return demo;

  try {
    const raw = await callOpenAiJson(
      `Tu assistes un NLE. Réponds UNIQUEMENT en JSON:
{ "summary": string, "intents": Array<
  | { "type": "add_effect", "effectType": string, "params"?: object }
  | { "type": "set_transition", "transitionType": string, "durationSec"?: number }
  | { "type": "noise_reduction", "amount": number }
  | { "type": "change_speed", "speed": number }
  | { "type": "add_text_overlay", "content": string, "durationSec"?: number }
  | { "type": "add_broll_placeholder", "label": string, "startOffsetSec"?: number, "durationSec"?: number }
> }
effectType ∈ fade|blur|grayscale|vignette|cinema|glow.
transitionType ∈ fade|dissolve|wipe-left|wipe-right|slide-up|zoom.`,
      JSON.stringify({
        instruction: body.instruction,
        clipSummary: body.clipSummary,
        language: body.language ?? "fr",
      }),
    );
    return normalizeEdit(raw, demo);
  } catch {
    return { ...demo, providerId: "demo-generative-fallback", mode: "demo" };
  }
}
