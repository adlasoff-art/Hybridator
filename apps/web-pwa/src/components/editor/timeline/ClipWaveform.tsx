import { useEffect, useRef } from "react";
import { drawWaveformPeaks, type WaveformPeaks } from "@hybridator/media-engine";
import { getAssetWaveform } from "@/engine/waveform-cache";

interface Props {
  projectId: string;
  assetId: string;
  assetUri: string;
  width: number;
  height: number;
  /** sourceIn/sourceOut pour cropper la portion visible du clip. */
  sourceIn: number;
  sourceOut: number;
  color?: string;
  className?: string;
}

export function ClipWaveform({
  projectId,
  assetId,
  assetUri,
  width,
  height,
  sourceIn,
  sourceOut,
  color = "rgba(163, 230, 53, 0.9)",
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const peaks = await getAssetWaveform(projectId, assetId, assetUri);
      if (cancelled || !peaks || !canvasRef.current) return;
      paintSlice(canvasRef.current, peaks, width, height, sourceIn, sourceOut, color);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, assetId, assetUri, width, height, sourceIn, sourceOut, color]);

  if (width < 4 || height < 4) return null;
  return (
    <canvas
      ref={canvasRef}
      width={Math.max(1, Math.floor(width))}
      height={Math.max(1, Math.floor(height))}
      className={className ?? "pointer-events-none absolute inset-x-0 bottom-0 h-full w-full"}
      aria-hidden
    />
  );
}

function paintSlice(
  canvas: HTMLCanvasElement,
  peaks: WaveformPeaks,
  width: number,
  height: number,
  sourceIn: number,
  sourceOut: number,
  color: string,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  const totalBuckets = peaks.peaks.length / 2;
  if (totalBuckets <= 0 || peaks.durationSec <= 0) return;
  const startB = Math.floor((sourceIn / peaks.durationSec) * totalBuckets);
  const endB = Math.ceil((sourceOut / peaks.durationSec) * totalBuckets);
  const slice = peaks.peaks.subarray(
    Math.max(0, startB) * 2,
    Math.min(totalBuckets, Math.max(startB + 1, endB)) * 2,
  );
  drawWaveformPeaks(ctx, slice, width, height, color);
}
