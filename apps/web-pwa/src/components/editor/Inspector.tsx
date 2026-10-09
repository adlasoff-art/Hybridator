import { findClip, type ClipPatch, type EditOperation, type EditorDoc } from "@/engine";
import { useProductConfig } from "@/config/ProductConfigProvider";

interface Props {
  doc: EditorDoc;
  clipId: string | null;
  apply: (ops: EditOperation[], coalesceKey?: string) => void;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  fmt,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
}) {
  return (
    <label className="block">
      <span className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{fmt ? fmt(value) : value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-primary"
      />
    </label>
  );
}

export function Inspector({ doc, clipId, apply }: Props) {
  const { activePlan, isFlagOn } = useProductConfig();
  const clip = clipId ? findClip(doc.timeline, clipId) : undefined;
  const track = clip ? doc.timeline.tracks.find((t) => t.id === clip.trackId) : undefined;
  const asset = clip ? doc.assets.find((a) => a.id === clip.assetId) : undefined;

  if (!clip || !track) {
    return (
      <div className="h-full bg-panel text-sm text-muted-foreground">
        <div className="flex h-11 items-center border-b border-border px-3">
          <p className="font-mono text-[10px] font-semibold uppercase text-foreground">
            Inspecteur
          </p>
        </div>
        <p className="p-3 text-xs leading-5">
          Sélectionnez un clip pour régler position, échelle, opacité, vitesse et audio.
        </p>
      </div>
    );
  }

  const patch = (p: ClipPatch, key: string) =>
    apply([{ type: "UPDATE_CLIP", clipId: clip.id, patch: p }], `${clip.id}:${key}`);
  const isVisual = track.kind !== "audio";
  const isAudio = track.kind === "audio";
  const angles = doc.assets
    .filter((a) => a.angle !== undefined)
    .slice(0, activePlan.multicamAngles ?? undefined);

  return (
    <div className="min-h-full bg-panel">
      <div className="border-b border-border p-3">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {track.name}
        </p>
        <p className="truncate font-semibold">{clip.label ?? asset?.name}</p>
        <p className="font-mono text-[10px] text-muted-foreground">
          Source {clip.sourceIn.toFixed(2)}s → {clip.sourceOut.toFixed(2)}s
        </p>
      </div>
      {isVisual && (
        <section className="space-y-3 border-b border-border p-3">
          <h3 className="font-mono text-[10px] font-semibold uppercase text-muted-foreground">
            Position / Échelle
          </h3>
          <Slider
            label="X"
            value={clip.transform.x}
            min={-960}
            max={960}
            step={1}
            fmt={(v) => `${v}px`}
            onChange={(v) => patch({ transform: { x: v } }, "x")}
          />
          <Slider
            label="Y"
            value={clip.transform.y}
            min={-540}
            max={540}
            step={1}
            fmt={(v) => `${v}px`}
            onChange={(v) => patch({ transform: { y: v } }, "y")}
          />
          <Slider
            label="Échelle"
            value={clip.transform.scale * 100}
            min={10}
            max={300}
            step={1}
            fmt={(v) => `${Math.round(v)}%`}
            onChange={(v) => patch({ transform: { scale: v / 100 } }, "scale")}
          />
          <Slider
            label="Rotation"
            value={clip.transform.rotation}
            min={-180}
            max={180}
            step={1}
            fmt={(v) => `${v}°`}
            onChange={(v) => patch({ transform: { rotation: v } }, "rot")}
          />
          <Slider
            label="Opacité"
            value={clip.transform.opacity * 100}
            min={0}
            max={100}
            step={1}
            fmt={(v) => `${Math.round(v)}%`}
            onChange={(v) => patch({ transform: { opacity: v / 100 } }, "op")}
          />
        </section>
      )}
      {isAudio && (
        <section className="space-y-3 border-b border-border p-3">
          <h3 className="font-mono text-[10px] font-semibold uppercase text-muted-foreground">
            Gain / Panoramique
          </h3>
          <Slider
            label="Volume"
            value={clip.audio.volume}
            min={0}
            max={2}
            step={0.01}
            fmt={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => patch({ audio: { volume: v } }, "vol")}
          />
          <Slider
            label="Panoramique"
            value={clip.audio.pan}
            min={-1}
            max={1}
            step={0.01}
            onChange={(v) => patch({ audio: { pan: v } }, "pan")}
          />
          <Slider
            label="Réduction de bruit"
            value={clip.audio.noiseReduction}
            min={0}
            max={1}
            step={0.01}
            fmt={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => patch({ audio: { noiseReduction: v } }, "nr")}
          />
        </section>
      )}
      <section className="space-y-2 border-b border-border p-3">
        <h3 className="font-mono text-[10px] font-semibold uppercase text-muted-foreground">
          Vitesse
        </h3>
        <Slider
          label="Vitesse"
          value={clip.speed}
          min={0.1}
          max={10}
          step={0.05}
          fmt={(v) => `×${v.toFixed(2)}`}
          onChange={(v) =>
            apply([{ type: "CHANGE_SPEED", clipId: clip.id, speed: v }], `${clip.id}:speed`)
          }
        />
      </section>
      <section className="space-y-2 border-b border-border p-3">
        <h3 className="font-mono text-[10px] font-semibold uppercase text-muted-foreground">
          Effets
        </h3>
        {clip.effects.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucun — onglet Effets.</p>
        ) : (
          <ul className="space-y-1">
            {clip.effects.map((fx) => (
              <li
                key={fx.id}
                className="flex items-center justify-between rounded bg-muted px-2 py-1 text-xs"
              >
                <span className="font-mono">{fx.type}</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    apply([{ type: "REMOVE_EFFECT", clipId: clip.id, effectId: fx.id }])
                  }
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-2 border-b border-border p-3">
        <h3 className="font-mono text-[10px] font-semibold uppercase text-muted-foreground">
          Transition
        </h3>
        {clip.transition ? (
          <div className="flex items-center justify-between rounded bg-muted px-2 py-1 text-xs">
            <span>
              {clip.transition.type} · {clip.transition.durationSec}s
            </span>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => apply([{ type: "SET_TRANSITION", clipId: clip.id, transition: null }])}
            >
              Retirer
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Aucune — onglet Transitions.</p>
        )}
      </section>
      {track.role === "angles" && isFlagOn("enable_multicam_mixer") && (
        <section className="space-y-2 border-b border-border p-3">
          <h3 className="font-mono text-[10px] font-semibold uppercase text-muted-foreground">
            Réglages multi-caméras
          </h3>
          <div className="grid grid-cols-3 gap-1">
            {angles.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() =>
                  apply([{ type: "SWITCH_CAMERA_ANGLE", time: clip.start, angleId: a.id }])
                }
                className={`rounded px-2 py-1.5 font-mono text-xs ${clip.assetId === a.id ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-raised"}`}
              >
                CAM {a.angle}
              </button>
            ))}
          </div>
        </section>
      )}
      <label className="flex items-center gap-2 p-3 text-sm">
        <input
          type="checkbox"
          checked={clip.enabled}
          onChange={(e) =>
            apply([{ type: "UPDATE_CLIP", clipId: clip.id, patch: { enabled: e.target.checked } }])
          }
          className="accent-primary"
        />
        Clip actif
      </label>
    </div>
  );
}
