export type { MediaProcessAdapter, RenderJob } from "@hybridator/core-model";

export { buildProxyFrame, proxyColor, activeAngleAsset, type ProxyFrame } from "./proxy";
export { PreviewClock } from "./preview-clock";
export { PreviewEngine, createPreviewSurface } from "./preview-engine";
export { createWasmMediaProcessAdapter } from "./adapters/wasm-render";
export {
  createCloudMediaProcessAdapter,
  createHybridMediaProcessAdapter,
  type CloudRenderOptions,
} from "./adapters/cloud-render";

export {
  computeWaveformPeaks,
  computeWaveformFromArrayBuffer,
  decodeAudioBuffer,
  serializeWaveformPeaks,
  deserializeWaveformPeaks,
  drawWaveformPeaks,
  volumeAtTime,
  sampleKeyframeValue,
  type WaveformPeaks,
  type ComputeWaveformOptions,
} from "./core/audio/waveform";

export {
  BLEND_MODES,
  canvasCompositeForBlend,
  cssFilterFromColorGrade,
  transitionProgress,
  type BlendMode,
} from "./core/compose/blend";

export { applyClipMask, defaultMask } from "./core/compose/mask";

export {
  defaultExportSettings,
  webCodecsAvailable,
  transcriptToSrt,
  transcriptToVtt,
  runExportProgress,
  type ExportSettings,
  type ExportProgress,
} from "./export/pipeline";
