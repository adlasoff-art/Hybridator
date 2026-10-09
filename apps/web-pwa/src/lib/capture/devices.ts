import { formatCaptureDeviceLabel } from "./mime";

export interface CaptureDeviceInfo {
  deviceId: string;
  label: string;
  kind: "videoinput" | "audioinput";
}

export async function listCaptureDevices(): Promise<{
  video: CaptureDeviceInfo[];
  audio: CaptureDeviceInfo[];
}> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    throw new Error("enumerateDevices indisponible.");
  }
  const all = await navigator.mediaDevices.enumerateDevices();
  const video = all
    .filter((d) => d.kind === "videoinput")
    .map((d, i) => ({
      deviceId: d.deviceId,
      label: formatCaptureDeviceLabel(d.label, "video", i),
      kind: "videoinput" as const,
    }));
  const audio = all
    .filter((d) => d.kind === "audioinput")
    .map((d, i) => ({
      deviceId: d.deviceId,
      label: formatCaptureDeviceLabel(d.label, "audio", i),
      kind: "audioinput" as const,
    }));
  return { video, audio };
}

export async function openCaptureStream(opts: {
  videoDeviceId?: string | null;
  audioDeviceId?: string | null;
  video?: boolean;
  audio?: boolean;
}): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("getUserMedia indisponible.");
  }
  const wantVideo = opts.video !== false;
  const wantAudio = opts.audio !== false;
  const constraints: MediaStreamConstraints = {
    video: wantVideo
      ? opts.videoDeviceId
        ? { deviceId: { exact: opts.videoDeviceId } }
        : true
      : false,
    audio: wantAudio
      ? opts.audioDeviceId
        ? { deviceId: { exact: opts.audioDeviceId } }
        : true
      : false,
  };
  if (!constraints.video && !constraints.audio) {
    throw new Error("Activez au moins une source vidéo ou audio.");
  }
  return navigator.mediaDevices.getUserMedia(constraints);
}

export function stopMediaStream(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  for (const t of stream.getTracks()) t.stop();
}
