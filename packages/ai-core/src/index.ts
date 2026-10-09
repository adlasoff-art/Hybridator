export type {
  NormalizedTranscript,
  TranscriptSegment,
  TranscriptWord,
  EditOperation,
} from "@hybridator/core-model";

export { analyzeTranscript, normalizeWord, type TranscriptRules } from "./analyze";

export type { SttAdapter, SttJob } from "./stt/types";
export { createDemoSttAdapter } from "./stt/demo-adapter";
export { createServerSttAdapter, type ServerSttAdapterOptions } from "./stt/server-adapter";

export {
  alignAngleOffsets,
  crossCorrelate,
  type AngleOffset,
  type AngleWaveform,
} from "./audio/cross-correlate";

export { detectVoiceActivity, type TimeRange } from "./autocut/vad";
export { buildAutoCutOperations, type AngleVad, type AutoCutOptions } from "./autocut/auto-cut";

export { runAiJob } from "./job";

export type {
  AppliedGenerativePlan,
  GenerativeAiAdapter,
  GenerativeEditIntent,
  GenerativeEditRequest,
  GenerativeEditResult,
  GenerativePlan,
  GenerativePlanClip,
  GenerativeProjectRequest,
} from "./generative/types";
export { createDemoGenerativeAiAdapter } from "./generative/demo-adapter";
export {
  createServerGenerativeAiAdapter,
  type ServerGenerativeAiAdapterOptions,
} from "./generative/server-adapter";
export { buildDemoEditResult, buildDemoGenerativePlan } from "./generative/demo-planner";
export { intentsToOperations, planToOperations } from "./generative/apply-plan";
