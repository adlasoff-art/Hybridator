import { useEffect, useRef, useState, type ReactNode } from "react";
import { clipAt, clipEnd, type EditorDoc, type Effect } from "@/engine";
import { resolveAssetObjectUrl } from "@/lib/media-url-cache";
import { PreviewEngine } from "./preview-bridge";

function cssFilterFromEffects(effects: Effect[]): string | undefined {
  const parts: string[] = [];
  for (const e of effects) {
    if (e.type === "blur") parts.push(`blur(${Number(e.params["radius"] ?? 4)}px)`);
    if (e.type === "grayscale") parts.push(`grayscale(${Number(e.params["amount"] ?? 1)})`);
    if (e.type === "cinema") {
      parts.push(`contrast(${Number(e.params["contrast"] ?? 1.15)})`);
      parts.push(`saturate(${Number(e.params["saturation"] ?? 0.9)})`);
    }
    if (e.type === "glow") parts.push(`brightness(${1 + Number(e.params["intensity"] ?? 0.4)})`);
    if (e.type === "vignette") parts.push("contrast(1.05)");
  }
  return parts.length ? parts.join(" ") : undefined;
}

export type CanvasAspect = "16:9" | "9:16" | "1:1";

interface Props {
  doc: EditorDoc;
  time: number;
  playing: boolean;
  duration: number;
  aspect?: CanvasAspect;
  watermark?: boolean;
  brandName?: string;
  onTime: (t: number) => void;
  onPlayingChange: (playing: boolean) => void;
  overlay?: ReactNode;
}

function aspectClass(aspect: CanvasAspect): string {
  if (aspect === "9:16") return "aspect-[9/16] max-h-full";
  if (aspect === "1:1") return "aspect-square max-h-full";
  return "aspect-video max-h-full w-full";
}

/**
 * Aperçu : lecture HTMLVideo/Audio pour médias OPFS importés ;
 * sinon PreviewEngine (démo / proxys).
 */
export function PreviewCanvas({
  doc,
  time,
  playing,
  duration,
  aspect = "16:9",
  watermark,
  brandName,
  onTime,
  onPlayingChange,
  overlay,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const engineRef = useRef<PreviewEngine | null>(null);
  const playingRef = useRef(playing);
  const durationRef = useRef(duration);
  const onTimeRef = useRef(onTime);
  const onPlayingChangeRef = useRef(onPlayingChange);
  const [stats, setStats] = useState({ fps: 60, avDriftMs: 0 });
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const frameN = useRef(0);

  playingRef.current = playing;
  durationRef.current = duration;
  onTimeRef.current = onTime;
  onPlayingChangeRef.current = onPlayingChange;

  const v1 = doc.timeline.tracks.find((t) => t.id === "v1");
  const a1 = doc.timeline.tracks.find((t) => t.id === "a1");
  const vClip = v1 ? clipAt(v1, time) : undefined;
  const aClip = a1 ? clipAt(a1, time) : undefined;
  const vAsset = vClip ? doc.assets.find((a) => a.id === vClip.assetId) : undefined;
  const aAsset = aClip ? doc.assets.find((a) => a.id === aClip.assetId) : undefined;
  const useNative =
    Boolean(vAsset && !vAsset.uri.startsWith("demo://")) ||
    Boolean(aAsset && !aAsset.uri.startsWith("demo://") && !vAsset);

  const vAssetId = vAsset?.id;
  const vAssetUri = vAsset?.uri;
  const aAssetId = aAsset?.id;
  const aAssetUri = aAsset?.uri;
  const aAssetKind = aAsset?.kind;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (vAssetId && vAssetUri && !vAssetUri.startsWith("demo://")) {
        const url = await resolveAssetObjectUrl(doc.id, vAssetId, vAssetUri);
        if (!cancelled) setMediaUrl(url);
      } else if (!cancelled) setMediaUrl(null);
      if (aAssetId && aAssetUri && aAssetKind === "audio" && !aAssetUri.startsWith("demo://")) {
        const url = await resolveAssetObjectUrl(doc.id, aAssetId, aAssetUri);
        if (!cancelled) setAudioUrl(url);
      } else if (!cancelled) setAudioUrl(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [doc.id, vAssetId, vAssetUri, aAssetId, aAssetUri, aAssetKind]);

  // Sync video element to playhead
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !vClip || !mediaUrl) return;
    const sourceTime = vClip.sourceIn + (time - vClip.start) * vClip.speed;
    if (Math.abs(video.currentTime - sourceTime) > 0.12) {
      try {
        video.currentTime = Math.max(0, sourceTime);
      } catch {
        /* ignore seek race */
      }
    }
    video.playbackRate = vClip.speed || 1;
    if (playing && video.paused) void video.play().catch(() => undefined);
    if (!playing && !video.paused) video.pause();
  }, [time, playing, vClip, mediaUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !aClip || !audioUrl) return;
    const sourceTime = aClip.sourceIn + (time - aClip.start) * aClip.speed;
    if (Math.abs(audio.currentTime - sourceTime) > 0.12) {
      try {
        audio.currentTime = Math.max(0, sourceTime);
      } catch {
        /* ignore */
      }
    }
    audio.volume = Math.min(1, Math.max(0, aClip.audio.volume));
    audio.muted = aClip.audio.muted || Boolean(a1?.muted);
    if (playing && audio.paused) void audio.play().catch(() => undefined);
    if (!playing && !audio.paused) audio.pause();
  }, [time, playing, aClip, audioUrl, a1?.muted]);

  // rAF clock when using native media
  useEffect(() => {
    if (!useNative || !playing) return;
    let raf = 0;
    let last = performance.now();
    let acc = time;
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      acc += dt;
      if (acc >= durationRef.current) {
        onTimeRef.current(durationRef.current);
        onPlayingChangeRef.current(false);
        return;
      }
      onTimeRef.current(acc);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useNative, playing]);

  useEffect(() => {
    if (useNative) {
      engineRef.current?.dispose();
      engineRef.current = null;
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new PreviewEngine({
      width: 1280,
      height: 720,
      onFrame: (_frame, s) => {
        const t = engine.time;
        const dur = durationRef.current;
        // Projet vide (dur=0) ou fin de lecture : ne jamais seek() ici —
        // seek → paint → onFrame provoquait un Maximum call stack size exceeded.
        if (dur <= 0) {
          if (playingRef.current) {
            engine.pause();
            onPlayingChangeRef.current(false);
          }
          frameN.current += 1;
          if (frameN.current % 12 === 0) setStats(s);
          return;
        }
        if (playingRef.current && t >= dur) {
          engine.pause();
          engine.seek(dur, false);
          onTimeRef.current(dur);
          onPlayingChangeRef.current(false);
          return;
        }
        if (playingRef.current) onTimeRef.current(t);
        frameN.current += 1;
        if (frameN.current % 12 === 0) setStats(s);
      },
    });
    engine.attachCanvas(canvas);
    engine.setDoc(doc);
    engine.seek(time);
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useNative]);

  useEffect(() => {
    if (useNative) return;
    engineRef.current?.setDoc(doc);
  }, [doc, useNative]);

  useEffect(() => {
    if (useNative) return;
    const engine = engineRef.current;
    if (!engine) return;
    if (!playing) engine.seek(time);
  }, [time, playing, useNative]);

  useEffect(() => {
    if (useNative) return;
    const engine = engineRef.current;
    if (!engine) return;
    if (playing) {
      engine.seek(time);
      engine.play();
    } else {
      engine.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, useNative]);

  const transform = vClip?.transform;
  const fxFilter = cssFilterFromEffects(vClip?.effects ?? []);
  const t1 = doc.timeline.tracks.find((t) => t.id === "t1");
  const v2 = doc.timeline.tracks.find((t) => t.id === "v2");
  const textClip = t1 ? clipAt(t1, time) : undefined;
  const stickerClip = v2 ? clipAt(v2, time) : undefined;
  const textContent =
    textClip?.label ??
    (textClip?.effects.find((e) => e.type === "text-style")?.params["content"] as
      string | undefined);
  // Overlay sticker uniquement si l'effet sticker est présent (pas le b-roll V2 générique).
  const stickerEffect = stickerClip?.effects.find((e) => e.type === "sticker");
  const stickerContent =
    stickerEffect &&
    (typeof stickerEffect.params["content"] === "string"
      ? stickerEffect.params["content"]
      : stickerClip?.label);
  const inTransition =
    vClip?.transition &&
    time >= clipEnd(vClip) - vClip.transition.durationSec &&
    time < clipEnd(vClip);

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-background">
      <div className={`relative ${aspectClass(aspect)} overflow-hidden bg-black`}>
        {useNative ? (
          <>
            {mediaUrl && vAsset?.kind === "image" ? (
              <img
                src={mediaUrl}
                alt=""
                className="h-full w-full object-contain"
                style={{
                  transform: transform
                    ? `translate(${transform.x / 10}px, ${transform.y / 10}px) scale(${transform.scale}) rotate(${transform.rotation}deg)`
                    : undefined,
                  opacity: transform?.opacity ?? 1,
                  filter: fxFilter,
                }}
              />
            ) : (
              <video
                ref={videoRef}
                src={mediaUrl ?? undefined}
                className="h-full w-full object-contain"
                playsInline
                muted={Boolean(audioUrl)}
                style={{
                  transform: transform
                    ? `translate(${transform.x / 10}px, ${transform.y / 10}px) scale(${transform.scale}) rotate(${transform.rotation}deg)`
                    : undefined,
                  opacity: transform?.opacity ?? 1,
                  filter: fxFilter,
                }}
              />
            )}
            <audio ref={audioRef} src={audioUrl ?? undefined} preload="auto" />
            {!mediaUrl && !audioUrl && (
              <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
                Importez un média et placez-le sur V1 / A1
              </div>
            )}
          </>
        ) : (
          <canvas
            ref={canvasRef}
            className="h-full w-full object-contain"
            style={{ filter: fxFilter }}
          />
        )}
        {inTransition && vClip?.transition && (
          <div
            className="pointer-events-none absolute inset-0 bg-black transition-opacity"
            style={{
              opacity: Math.min(
                1,
                (time - (clipEnd(vClip) - vClip.transition.durationSec)) /
                  Math.max(0.01, vClip.transition.durationSec),
              ),
            }}
            title={vClip.transition.type}
          />
        )}
        {stickerContent && (
          <span
            className="pointer-events-none absolute right-6 top-8 text-4xl drop-shadow"
            style={{
              transform: stickerClip?.transform
                ? `translate(${stickerClip.transform.x / 10}px, ${stickerClip.transform.y / 10}px) scale(${stickerClip.transform.scale})`
                : undefined,
              opacity: stickerClip?.transform.opacity ?? 1,
            }}
          >
            {stickerContent}
          </span>
        )}
        {textContent && (
          <p
            className="pointer-events-none absolute inset-x-8 text-center font-semibold text-white drop-shadow"
            style={{
              bottom: typeof textClip?.effects[0]?.params["y"] === "number" ? undefined : "12%",
              top:
                typeof textClip?.effects[0]?.params["y"] === "number"
                  ? `${40 + Number(textClip.effects[0].params["y"]) / 20}%`
                  : undefined,
              fontSize: Number(textClip?.effects[0]?.params["fontSize"] ?? 28),
              fontWeight: Number(textClip?.effects[0]?.params["weight"] ?? 600),
              opacity: textClip?.transform.opacity ?? 1,
            }}
          >
            {textContent}
          </p>
        )}
        {overlay}
        <span className="absolute left-2 top-2 rounded border border-foreground/10 bg-background/80 px-1.5 py-0.5 font-mono text-[10px] tabular-nums">
          {useNative ? "media" : `${stats.fps.toFixed(0)} fps`}
          {!useNative && Math.abs(stats.avDriftMs) > 1
            ? ` · Δ ${stats.avDriftMs.toFixed(0)} ms`
            : ""}
        </span>
        {watermark && brandName && (
          <span className="absolute bottom-2 right-2 font-mono text-[9px] uppercase text-foreground/40">
            {brandName}
          </span>
        )}
      </div>
    </div>
  );
}
