import type { CancelSignal, NormalizedTranscript } from "@hybridator/core-model";
import type { TranscriptRules } from "../analyze";

/**
 * Port STT — aucun fournisseur ni clé API ici.
 * Les adaptateurs distants appellent un endpoint serveur qui détient les secrets.
 */
export interface SttJob {
  projectId: string;
  mediaUri: string;
  durationSec: number;
  language?: string;
}

export interface SttAdapter {
  /** Identifiant opaque du fournisseur (jamais une clé). */
  readonly providerId: string;
  transcribe(
    job: SttJob,
    rules: TranscriptRules,
    signal?: CancelSignal,
  ): Promise<NormalizedTranscript>;
}
