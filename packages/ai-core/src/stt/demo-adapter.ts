import type { TranscriptSegment } from "@hybridator/core-model";
import { analyzeTranscript, type TranscriptRules } from "../analyze";
import type { SttAdapter, SttJob } from "./types";

/**
 * Adaptateur de démonstration — produit un transcript synthétique analysé.
 * Aucun appel réseau, aucune clé.
 */
export function createDemoSttAdapter(): SttAdapter {
  return {
    providerId: "demo",
    async transcribe(job: SttJob, rules: TranscriptRules, signal) {
      if (signal?.aborted) {
        const err = new Error("Transcription annulée");
        err.name = "AbortError";
        throw err;
      }
      const segments = buildDemoSegments(job.language ?? "fr", Math.min(job.durationSec, 30));
      return analyzeTranscript({ language: job.language ?? "fr", segments }, rules);
    },
  };
}

function buildDemoSegments(language: string, durationSec: number): TranscriptSegment[] {
  const lines = language.startsWith("en")
    ? [
        { speaker: "host", text: "Welcome to this episode um about podcast editing" },
        { speaker: "guest", text: "Thanks for having me uh I really really love this topic" },
      ]
    : [
        { speaker: "host", text: "Bienvenue dans cet épisode euh consacré au montage" },
        {
          speaker: "guest",
          text: "Merci de m'inviter bah c'est un sujet que j'adore vraiment vraiment",
        },
      ];

  let t = 0.3;
  const segments: TranscriptSegment[] = [];
  for (let si = 0; si < lines.length; si++) {
    const line = lines[si]!;
    const tokens = line.text.split(" ");
    const start = t;
    const words = tokens.map((tok) => {
      const d = 0.14 + 0.04 * tok.length;
      const w = { word: tok, start: t, end: t + d, confidence: 0.94 };
      t = w.end + 0.08;
      return w;
    });
    const end = words[words.length - 1]?.end ?? start;
    // Petit silence artificiel entre segments
    t = end + 0.9;
    if (t > durationSec) break;
    segments.push({
      id: `stt-${si}`,
      speaker: line.speaker,
      text: line.text,
      start,
      end,
      words,
    });
  }
  return segments;
}
