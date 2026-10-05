import { useEffect, useRef, useState, type ReactNode } from "react";
import { PreviewEngine, type EditorDoc } from "./preview-bridge";

interface Props {
  doc: EditorDoc;
  time: number;
  playing: boolean;
  duration: number;
  watermark?: boolean;
  brandName?: string;
  onTime: (t: number) => void;
  onPlayingChange: (playing: boolean) => void;
  overlay?: ReactNode;
}

/**
 * Aperçu multicam : PreviewEngine (rAF ~60 fps, proxys, OffscreenCanvas prêt).
 * Le temps média remonte au parent pour la timeline / transcript.
 */
export function PreviewCanvas({
  doc,
  time,
  playing,
  duration,
  watermark,
  brandName,
  onTime,
  onPlayingChange,
  overlay,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PreviewEngine | null>(null);
  const playingRef = useRef(playing);
  const durationRef = useRef(duration);
  const onTimeRef = useRef(onTime);
  const onPlayingChangeRef = useRef(onPlayingChange);
  const [stats, setStats] = useState({ fps: 60, avDriftMs: 0 });
  const frameN = useRef(0);

  playingRef.current = playing;
  durationRef.current = duration;
  onTimeRef.current = onTime;
  onPlayingChangeRef.current = onPlayingChange;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new PreviewEngine({
      width: 1280,
      height: 720,
      onFrame: (_frame, s) => {
        const t = engine.time;
        if (t >= durationRef.current) {
          engine.pause();
          engine.seek(durationRef.current);
          onTimeRef.current(durationRef.current);
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
    // mount once — doc/time synced below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setDoc(doc);
  }, [doc]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (!playing) engine.seek(time);
  }, [time, playing]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (playing) {
      engine.seek(time);
      engine.play();
    } else {
      engine.pause();
    }
    // only react to playing toggles; time seek handled above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <canvas ref={canvasRef} className="h-full w-full object-contain" />
      {overlay}
      <span className="absolute left-2 top-2 rounded border border-foreground/10 bg-background/80 px-1.5 py-0.5 font-mono text-[10px] tabular-nums">
        {stats.fps.toFixed(0)} fps
        {Math.abs(stats.avDriftMs) > 1 ? ` · Δ ${stats.avDriftMs.toFixed(0)} ms` : ""}
      </span>
      {watermark && brandName && (
        <span className="absolute bottom-2 right-2 font-mono text-[9px] uppercase text-foreground/40">
          {brandName}
        </span>
      )}
    </div>
  );
}
