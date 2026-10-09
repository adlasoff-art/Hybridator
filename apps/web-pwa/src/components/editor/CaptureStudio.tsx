import { useCallback, useEffect, useRef, useState } from "react";
import { Circle, Square, Video } from "lucide-react";
import { toast } from "sonner";
import {
  createDefaultClip,
  defaultTrackIdForAssetKind,
  opfsMediaBlobStore,
  type Asset,
  type EditOperation,
  type EditorDoc,
} from "@/engine";
import { createAudioMeter, type AudioMeter } from "@/lib/capture/audio-meter";
import {
  listCaptureDevices,
  openCaptureStream,
  stopMediaStream,
  type CaptureDeviceInfo,
} from "@/lib/capture/devices";
import { createCaptureRecorder, type CaptureRecorder } from "@/lib/capture/recorder";

interface Props {
  doc: EditorDoc;
  time: number;
  apply: (ops: EditOperation[], key?: string) => void;
}

export function CaptureStudio({ doc, time, apply }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const meterRef = useRef<AudioMeter | null>(null);
  const recorderRef = useRef<CaptureRecorder | null>(null);
  const rafRef = useRef(0);

  const [videoDevices, setVideoDevices] = useState<CaptureDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<CaptureDeviceInfo[]>([]);
  const [videoId, setVideoId] = useState<string>("");
  const [audioId, setAudioId] = useState<string>("");
  const [live, setLive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [gain, setGain] = useState(1);
  const [placeOnTimeline, setPlaceOnTimeline] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const startedAtRef = useRef(0);

  const refreshDevices = useCallback(async () => {
    try {
      try {
        const tmp = await openCaptureStream({ video: true, audio: true });
        stopMediaStream(tmp);
      } catch {
        /* permission denied or no devices — still enumerate */
      }
      const listed = await listCaptureDevices();
      setVideoDevices(listed.video);
      setAudioDevices(listed.audio);
      setVideoId((prev) => prev || listed.video[0]?.deviceId || "");
      setAudioId((prev) => prev || listed.audio[0]?.deviceId || "");
      if (!listed.video.length && !listed.audio.length) {
        toast.message("Aucun périphérique détecté.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Périphériques inaccessibles.");
    }
  }, []);

  useEffect(() => {
    void refreshDevices();
    return () => {
      cancelAnimationFrame(rafRef.current);
      recorderRef.current = null;
      meterRef.current?.dispose();
      meterRef.current = null;
      stopMediaStream(streamRef.current);
      streamRef.current = null;
    };
  }, [refreshDevices]);

  const tickMeter = useCallback(() => {
    const meter = meterRef.current;
    if (meter) setLevel(meter.getLevel());
    if (recording) setElapsed((performance.now() - startedAtRef.current) / 1000);
    rafRef.current = requestAnimationFrame(tickMeter);
  }, [recording]);

  useEffect(() => {
    if (!live && !recording) {
      cancelAnimationFrame(rafRef.current);
      setLevel(0);
      return;
    }
    rafRef.current = requestAnimationFrame(tickMeter);
    return () => cancelAnimationFrame(rafRef.current);
  }, [live, recording, tickMeter]);

  const stopLive = useCallback(() => {
    if (recording) return;
    cancelAnimationFrame(rafRef.current);
    meterRef.current?.dispose();
    meterRef.current = null;
    recorderRef.current = null;
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setLive(false);
    setLevel(0);
  }, [recording]);

  const startLive = async () => {
    setBusy(true);
    try {
      stopLive();
      const raw = await openCaptureStream({
        videoDeviceId: videoId || null,
        audioDeviceId: audioId || null,
        video: Boolean(videoId) || videoDevices.length > 0,
        audio: Boolean(audioId) || audioDevices.length > 0,
      });
      const meter = createAudioMeter(raw);
      meter.setGain(gain);
      meterRef.current = meter;
      streamRef.current = meter.outputStream;
      if (videoRef.current) {
        videoRef.current.srcObject = meter.outputStream;
        await videoRef.current.play().catch(() => undefined);
      }
      recorderRef.current = createCaptureRecorder(meter.outputStream);
      setLive(true);
      toast.success("Prévisualisation live active.");
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Impossible d'ouvrir la caméra / le micro (permissions ?).",
      );
    } finally {
      setBusy(false);
    }
  };

  const onGainChange = (v: number) => {
    setGain(v);
    meterRef.current?.setGain(v);
  };

  const startRec = () => {
    if (!recorderRef.current || !live) {
      toast.message("Démarrez d'abord la prévisualisation.");
      return;
    }
    recorderRef.current.start();
    startedAtRef.current = performance.now();
    setElapsed(0);
    setRecording(true);
    toast.message("Enregistrement ISO…");
  };

  const stopRec = async () => {
    if (!recorderRef.current?.recording) return;
    setBusy(true);
    try {
      const iso = await recorderRef.current.stop();
      setRecording(false);
      const assetId = `cap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const file = new File([iso.blob], iso.fileName, { type: iso.mimeType });
      const uri = await opfsMediaBlobStore.put(doc.id, assetId, file);
      const asset: Asset = {
        id: assetId,
        name: iso.fileName,
        kind: iso.kind,
        uri,
        durationSec: iso.durationSec,
      };
      const ops: EditOperation[] = [{ type: "ADD_ASSET", asset }];
      if (placeOnTimeline) {
        const trackId = defaultTrackIdForAssetKind(asset.kind);
        ops.push({
          type: "ADD_CLIP",
          clip: createDefaultClip({
            id: `clip_${assetId}`,
            assetId,
            trackId,
            start: Math.max(0, time),
            duration: asset.durationSec,
            sourceIn: 0,
            sourceOut: asset.durationSec,
            label: asset.name,
          }),
        });
      }
      apply(ops);
      toast.success(
        placeOnTimeline
          ? `ISO enregistré et placé sur la timeline (${iso.durationSec.toFixed(1)}s).`
          : `ISO enregistré dans le chutier (${iso.durationSec.toFixed(1)}s).`,
      );
    } catch (e) {
      setRecording(false);
      toast.error(e instanceof Error ? e.message : "Arrêt enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-muted-foreground">
        Studio multi-sources (WebRTC). Caméras USB / cartes HDMI exposées par le système, micros
        USB. L’ISO est sauvé dans le chutier OPFS.
      </p>

      <div className="grid gap-2">
        <label className="text-xs text-muted-foreground">
          Caméra / acquisition
          <select
            value={videoId}
            onChange={(e) => setVideoId(e.target.value)}
            disabled={live || recording}
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground"
          >
            {videoDevices.length === 0 && <option value="">Aucune caméra</option>}
            {videoDevices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Micro / interface
          <select
            value={audioId}
            onChange={(e) => setAudioId(e.target.value)}
            disabled={live || recording}
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground"
          >
            {audioDevices.length === 0 && <option value="">Aucun micro</option>}
            {audioDevices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void refreshDevices()}
          disabled={recording}
          className="rounded border border-border px-2 py-1 text-xs hover:bg-secondary disabled:opacity-40"
        >
          Actualiser les périphériques
        </button>
      </div>

      <div className="relative aspect-video overflow-hidden rounded border border-border bg-black">
        <video ref={videoRef} muted playsInline className="h-full w-full object-contain" />
        {!live && (
          <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Video className="h-3.5 w-3.5" /> Pas de flux
            </span>
          </div>
        )}
        {recording && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-red-600/90 px-1.5 py-0.5 font-mono text-[10px] text-white">
            <Circle className="h-2.5 w-2.5 fill-current" /> REC {elapsed.toFixed(1)}s
          </span>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] uppercase text-muted-foreground">
          <span>Vu-mètre</span>
          <span className="font-mono">{Math.round(level * 100)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded bg-muted">
          <div
            className={`h-full transition-[width] duration-75 ${level > 0.85 ? "bg-red-500" : level > 0.6 ? "bg-amber-400" : "bg-primary"}`}
            style={{ width: `${Math.min(100, level * 100)}%` }}
          />
        </div>
        <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          Gain
          <input
            type="range"
            min={0}
            max={2}
            step={0.01}
            value={gain}
            onChange={(e) => onGainChange(Number(e.target.value))}
            className="flex-1 accent-primary"
          />
          <span className="w-10 font-mono text-foreground">{gain.toFixed(2)}</span>
        </label>
      </div>

      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={placeOnTimeline}
          onChange={(e) => setPlaceOnTimeline(e.target.checked)}
          className="accent-primary"
        />
        Placer sur V1 / A1 à la tête de lecture après enregistrement
      </label>

      <div className="flex flex-wrap gap-2">
        {!live ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void startLive()}
            className="flex-1 rounded-md bg-secondary px-3 py-2 text-xs hover:bg-raised disabled:opacity-40"
          >
            Démarrer le live
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || recording}
            onClick={stopLive}
            className="flex-1 rounded-md border border-border px-3 py-2 text-xs hover:bg-secondary disabled:opacity-40"
          >
            Arrêter le live
          </button>
        )}
        {!recording ? (
          <button
            type="button"
            disabled={!live || busy}
            onClick={startRec}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-600/90 disabled:opacity-40"
          >
            <Circle className="h-3 w-3 fill-current" /> Enregistrer ISO
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void stopRec()}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"
          >
            <Square className="h-3 w-3 fill-current" /> Stop & sauver
          </button>
        )}
      </div>
    </div>
  );
}
