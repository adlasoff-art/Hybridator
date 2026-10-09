export type {
  Clip,
  ClipPatch,
  EditOperation,
  EditorDoc,
  SourceRange,
  Timeline,
  Track,
  NormalizedTranscript,
  TranscriptWord,
} from "@hybridator/core-model";
export { ALL_TRACKS } from "@hybridator/core-model";

export {
  applyOperation,
  applyOperations,
  clipAt,
  clipEnd,
  findClip,
  opsForSourceRanges,
  sourceToTimeline,
  timelineDuration,
} from "./timeline";

export {
  isSourceRemoved,
  mergeRanges,
  referenceTrack,
  sourceSpanTimelineDuration,
  sourceSpanToTimelineRange,
  timelineToSource,
} from "./mapping";

export { canRedo, canUndo, commit, createHistory, redo, undo, type History } from "./history";

export { snapClipStart, collectSnapPoints, type SnapOptions } from "./snap";

export {
  hasUnlinkedAudioSibling,
  pickAudioTrack,
  planUnlinkAudio,
  type UnlinkPlan,
} from "./unlink";

export {
  flattenTranscriptWords,
  sourceRangeForWord,
  sourceRangeFromCharSpan,
  sourceRangeWithinWord,
  type ResolvedWord,
  type TranscriptCharRef,
} from "./transcript-edit";
