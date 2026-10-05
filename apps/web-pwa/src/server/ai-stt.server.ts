/**
 * Handler STT côté serveur uniquement.
 * Les clés fournisseurs (STT_API_KEY, etc.) ne doivent JAMAIS être exposées au client.
 */
import { analyzeTranscript, type TranscriptRules } from "@hybridator/ai-core";
import type { NormalizedTranscript, TranscriptSegment } from "@hybridator/core-model";

export interface ServerSttRequest {
  projectId: string;
  mediaUri: string;
  durationSec: number;
  language?: string;
  rules: TranscriptRules;
}

export async function handleServerStt(body: ServerSttRequest): Promise<NormalizedTranscript> {
  const apiKey = typeof process !== "undefined" ? process.env["STT_API_KEY"] : undefined;
  if (!apiKey) {
    // Pas de clé : on refuse plutôt que d'appeler un fournisseur depuis le client.
    throw new Error(
      "STT non configuré : définissez STT_API_KEY uniquement côté serveur, puis relancez.",
    );
  }

  // Branchement fournisseur réel (Whisper / Deepgram / …) — la clé reste ici.
  // En attendant l'intégration, on synthétise un transcript pour valider le pipeline sécurisé.
  void apiKey;
  const segments: TranscriptSegment[] = [
    {
      id: "srv-0",
      speaker: "host",
      text: "Transcription serveur",
      start: 0,
      end: Math.min(2, body.durationSec),
      words: [
        { word: "Transcription", start: 0, end: 1, confidence: 0.9 },
        { word: "serveur", start: 1.1, end: 1.8, confidence: 0.9 },
      ],
    },
  ];
  return analyzeTranscript({ language: body.language ?? "fr", segments }, body.rules);
}
