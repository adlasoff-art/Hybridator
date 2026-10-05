/**
 * Coquille Phase 0 — le portage de applyOperation / historique arrive en Phase 1.
 * Réexporte le contrat timeline depuis core-model pour stabiliser l'API publique.
 */
export type {
  Clip,
  ClipPatch,
  EditOperation,
  EditorDoc,
  SourceRange,
  Timeline,
  Track,
} from "@hybridator/core-model";
export { ALL_TRACKS } from "@hybridator/core-model";
