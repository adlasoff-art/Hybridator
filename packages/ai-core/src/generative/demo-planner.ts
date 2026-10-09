import type {
  GenerativeEditIntent,
  GenerativeEditRequest,
  GenerativeEditResult,
  GenerativePlan,
  GenerativeProjectRequest,
} from "./types";

function parseDuration(prompt: string, fallback: number): number {
  const m = prompt.match(/(\d+)\s*(s|sec|secondes?|seconds?)/i);
  if (m) return Math.min(180, Math.max(5, Number(m[1])));
  const m2 = prompt.match(/(\d+)\s*(min|minutes?)/i);
  if (m2) return Math.min(180, Math.max(5, Number(m2[1]) * 60));
  return fallback;
}

function wants(prompt: string, ...words: string[]): boolean {
  const p = prompt.toLowerCase();
  return words.some((w) => p.includes(w));
}

/** Planificateur déterministe hors ligne (aucune clé). */
export function buildDemoGenerativePlan(req: GenerativeProjectRequest): GenerativePlan {
  const durationSec = Math.min(180, Math.max(8, req.durationSec ?? parseDuration(req.prompt, 30)));
  const title =
    req.prompt.trim().slice(0, 60) || (req.language === "en" ? "AI project" : "Projet IA");
  const script =
    req.referenceNotes?.trim() ||
    `Narration : ${req.prompt.trim().slice(0, 200) || "Présentation générée."}`;
  const withMusic = wants(req.prompt, "musique", "music", "épique", "epic", "beat");
  const withSubs = wants(req.prompt, "sous-titre", "subtitle", "légende", "caption") || true;

  const clips: GenerativePlan["clips"] = [
    {
      trackHint: "v1",
      kind: "video",
      label: "Séquence principale",
      start: 0,
      duration: durationSec,
      effectTypes: wants(req.prompt, "cinéma", "cinema", "film") ? ["cinema"] : ["fade"],
      transitionType: "fade",
    },
  ];

  if (durationSec >= 12) {
    clips.push({
      trackHint: "v2",
      kind: "video",
      label: "B-roll illustration",
      start: Math.min(durationSec * 0.35, durationSec - 4),
      duration: Math.min(5, durationSec * 0.25),
      effectTypes: ["vignette"],
    });
  }

  // Piste voix toujours présente pour un montage narratif utilisable
  clips.push({
    trackHint: "a1",
    kind: "audio",
    label: "Voix off",
    start: 0,
    duration: durationSec,
    content: script,
  });

  if (withMusic) {
    clips.push({
      trackHint: "a2",
      kind: "music",
      label: "Musique de fond",
      start: 0,
      duration: durationSec,
    });
  }

  if (withSubs) {
    const chunk = Math.max(3, durationSec / 3);
    const parts = script
      .split(/[.!?]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3);
    const lines = parts.length ? parts : ["Introduction", "Développement", "Conclusion"];
    lines.forEach((line, i) => {
      const start = Math.min(durationSec - 1, i * chunk);
      clips.push({
        trackHint: "t1",
        kind: "text",
        label: "Sous-titre",
        start,
        duration: Math.min(chunk, durationSec - start),
        content: line.slice(0, 80),
      });
    });
  }

  return {
    title: title.length > 3 ? title : "Projet IA",
    durationSec,
    script,
    voiceoverText: script,
    clips,
    providerId: "demo-generative",
    mode: "demo",
  };
}

/** Interprète une instruction naturelle en intentions (démo). */
export function buildDemoEditResult(req: GenerativeEditRequest): GenerativeEditResult {
  const i = req.instruction.toLowerCase();
  const intents: GenerativeEditIntent[] = [];

  if (/(bruit|noise|isolate|isole|voix)/i.test(i)) {
    intents.push({ type: "noise_reduction", amount: 0.7 });
  }
  if (/(flou|blur)/i.test(i)) {
    intents.push({ type: "add_effect", effectType: "blur", params: { radius: 6 } });
  }
  if (/(n&b|noir|blanc|grayscale|nb)/i.test(i)) {
    intents.push({ type: "add_effect", effectType: "grayscale", params: { amount: 1 } });
  }
  if (/(cinéma|cinema|film)/i.test(i)) {
    intents.push({
      type: "add_effect",
      effectType: "cinema",
      params: { contrast: 1.15, saturation: 0.9 },
    });
  }
  if (/(vignette)/i.test(i)) {
    intents.push({ type: "add_effect", effectType: "vignette", params: { strength: 0.5 } });
  }
  if (/(glow|lueur)/i.test(i)) {
    intents.push({ type: "add_effect", effectType: "glow", params: { intensity: 0.6 } });
  }
  if (/(transition|fondu|fade|wipe|dissou)/i.test(i)) {
    const type = /wipe/.test(i) ? "wipe-left" : /dissou/.test(i) ? "dissolve" : "fade";
    intents.push({ type: "set_transition", transitionType: type, durationSec: 0.5 });
  }
  if (/(lent|slow|ralenti)/i.test(i)) {
    intents.push({ type: "change_speed", speed: 0.5 });
  }
  if (/(rapide|fast|accél)/i.test(i)) {
    intents.push({ type: "change_speed", speed: 1.5 });
  }
  if (/(b-?roll|illustration|overlay)/i.test(i)) {
    intents.push({
      type: "add_broll_placeholder",
      label: "B-roll IA",
      startOffsetSec: 0,
      durationSec: 3,
    });
  }
  if (/(texte|titre|sous-titre|caption)/i.test(i)) {
    const m = req.instruction.match(/[«"]([^»"]+)[»"]/);
    intents.push({
      type: "add_text_overlay",
      content: m?.[1] ?? "Texte IA",
      durationSec: 3,
    });
  }

  if (!intents.length) {
    intents.push({ type: "add_effect", effectType: "fade", params: { amount: 1 } });
    intents.push({ type: "set_transition", transitionType: "fade", durationSec: 0.4 });
  }

  return {
    summary: `Édition contextuelle : ${intents.map((x) => x.type).join(", ")}`,
    intents,
    providerId: "demo-generative",
    mode: "demo",
  };
}
