import { useState } from "react";
import {
  DEFAULT_CLIP_CROP,
  hasUnlinkedAudioSibling,
  findClip,
  normalizeCrop,
  pickAudioTrack,
  removeKeyframeAt,
  upsertKeyframeTracks,
  type ClipPatch,
  type EditOperation,
  type EditorDoc,
  type KeyframeTrack,
} from "@/engine";
import { useProductConfig } from "@/config/ProductConfigProvider";
import { BLEND_MODES, defaultMask } from "@hybridator/media-engine";

interface Props {
  doc: EditorDoc;
  clipId: string | null;
  time: number;
  apply: (ops: EditOperation[], coalesceKey?: string) => void;
}

type TabId = "video" | "audio" | "color" | "speed" | "fx";

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

export function Inspector({ doc, clipId, time, apply }: Props) {
  const { activePlan, isFlagOn } = useProductConfig();
  const [tab, setTab] = useState<TabId>("video");
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
          Sélectionnez un clip — onglets Vidéo, Audio, Étalonnage, Vitesse.
        </p>
      </div>
    );
  }

  const patch = (p: ClipPatch, key: string) =>
    apply([{ type: "UPDATE_CLIP", clipId: clip.id, patch: p }], `${clip.id}:${key}`);
  const isVisual = track.kind !== "audio";
  const isAudio = track.kind === "audio";
  const audioTrackAvailable = Boolean(pickAudioTrack(doc.timeline.tracks));
  const canUnlink =
    isVisual &&
    asset?.kind === "video" &&
    !track.locked &&
    audioTrackAvailable &&
    !hasUnlinkedAudioSibling(doc, clip) &&
    clip.mediaRole !== "audio";
  const extractedVideo = isVisual && clip.mediaRole === "video";
  const grade = clip.colorGrade;
  const angles = doc.assets
    .filter((a) => a.angle !== undefined)
    .slice(0, activePlan.multicamAngles ?? undefined);

  const tabs: { id: TabId; label: string; show: boolean }[] = [
    { id: "video", label: "Vidéo", show: isVisual },
    { id: "audio", label: "Audio", show: true },
    { id: "color", label: "Couleur", show: isVisual },
    { id: "speed", label: "Vitesse", show: true },
    { id: "fx", label: "FX", show: true },
  ];
  const visibleTabs = tabs.filter((t) => t.show);
  const activeTab = visibleTabs.some((t) => t.id === tab) ? tab : (visibleTabs[0]?.id ?? "video");

  return (
    <div className="min-h-full bg-panel">
      <div className="border-b border-border p-3">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {track.name}
          {clip.mediaRole ? ` · ${clip.mediaRole}` : ""}
        </p>
        <p className="truncate font-semibold">{clip.label ?? asset?.name}</p>
        <p className="font-mono text-[10px] text-muted-foreground">
          Source {clip.sourceIn.toFixed(2)}s → {clip.sourceOut.toFixed(2)}s
        </p>
        {isVisual && asset?.kind === "video" && !extractedVideo && (
          <button
            type="button"
            disabled={!canUnlink}
            title={
              !audioTrackAvailable
                ? "Aucune piste audio déverrouillée"
                : hasUnlinkedAudioSibling(doc, clip)
                  ? "Audio déjà extrait"
                  : "Extraire l'audio vers A1/A2"
            }
            className="mt-2 w-full rounded border border-border bg-secondary px-2 py-1.5 text-xs font-medium hover:bg-raised disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => apply([{ type: "UNLINK_AUDIO", clipId: clip.id }])}
          >
            Extraire l&apos;audio
          </button>
        )}
        {extractedVideo && (
          <p className="mt-2 text-[10px] text-muted-foreground">
            Audio extrait — réglez le volume sur le clip A lié.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-0.5 border-b border-border px-1 py-1">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded px-2 py-1 font-mono text-[10px] uppercase ${
              activeTab === t.id
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "video" && isVisual && (
        <section className="space-y-3 border-b border-border p-3">
          <h3 className="font-mono text-[10px] font-semibold uppercase text-muted-foreground">
            Transform
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
          <div className="flex gap-2">
            <label className="flex flex-1 items-center gap-2 text-xs">
              <input
                type="checkbox"
                className="accent-primary"
                checked={Boolean(clip.flipX)}
                onChange={(e) => patch({ flipX: e.target.checked }, "flipx")}
              />
              Miroir H
            </label>
            <label className="flex flex-1 items-center gap-2 text-xs">
              <input
                type="checkbox"
                className="accent-primary"
                checked={Boolean(clip.flipY)}
                onChange={(e) => patch({ flipY: e.target.checked }, "flipy")}
              />
              Miroir V
            </label>
          </div>
          <label className="block text-xs">
            <span className="text-muted-foreground">Blend</span>
            <select
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1"
              value={clip.blendMode ?? "normal"}
              onChange={(e) => patch({ blendMode: e.target.value }, "blend")}
            >
              {BLEND_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded border border-border px-2 py-1 text-[10px] uppercase"
              onClick={() => patch({ mask: defaultMask("rect") }, "mask")}
            >
              Masque
            </button>
            {clip.mask && (
              <button
                type="button"
                className="rounded border border-border px-2 py-1 text-[10px] uppercase"
                onClick={() => patch({ mask: null }, "maskoff")}
              >
                Retirer
              </button>
            )}
          </div>
          {clip.mask && (
            <Slider
              label="Feather"
              value={clip.mask.feather}
              min={0}
              max={0.5}
              step={0.01}
              onChange={(v) => patch({ mask: { ...clip.mask!, feather: v } }, "feather")}
            />
          )}
          <h3 className="pt-2 font-mono text-[10px] font-semibold uppercase text-muted-foreground">
            Rogage
          </h3>
          {(
            [
              ["top", "Haut"],
              ["right", "Droite"],
              ["bottom", "Bas"],
              ["left", "Gauche"],
            ] as const
          ).map(([key, label]) => (
            <Slider
              key={key}
              label={label}
              value={(clip.crop ?? DEFAULT_CLIP_CROP)[key] * 100}
              min={0}
              max={45}
              step={1}
              fmt={(v) => `${Math.round(v)}%`}
              onChange={(v) => {
                const next = normalizeCrop({ [key]: v / 100 }, clip.crop);
                patch({ crop: next ?? DEFAULT_CLIP_CROP }, `crop-${key}`);
              }}
            />
          ))}
          {clip.crop && (
            <button
              type="button"
              className="w-full rounded border border-border px-2 py-1 text-[10px] uppercase"
              onClick={() => patch({ crop: null }, "cropoff")}
            >
              Réinitialiser le crop
            </button>
          )}
          <KeyframeSection
            clipId={clip.id}
            property="opacity"
            label="Opacité (keyframes)"
            timeInClip={Math.max(0, time - clip.start)}
            clipDuration={clip.duration}
            tracks={clip.keyframes}
            fallback={clip.transform.opacity}
            apply={apply}
          />
        </section>
      )}

      {activeTab === "audio" && (
        <section className="space-y-3 border-b border-border p-3">
          <h3 className="font-mono text-[10px] font-semibold uppercase text-muted-foreground">
            Gain / Enveloppes
          </h3>
          <Slider
            label="Volume (aperçu ≤100%)"
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
            label="Fade-in"
            value={clip.audio.fadeInSec ?? 0}
            min={0}
            max={Math.min(5, clip.duration)}
            step={0.05}
            fmt={(v) => `${v.toFixed(2)}s`}
            onChange={(v) => patch({ audio: { fadeInSec: v } }, "fadein")}
          />
          <Slider
            label="Fade-out"
            value={clip.audio.fadeOutSec ?? 0}
            min={0}
            max={Math.min(5, clip.duration)}
            step={0.05}
            fmt={(v) => `${v.toFixed(2)}s`}
            onChange={(v) => patch({ audio: { fadeOutSec: v } }, "fadeout")}
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
          <label className="block text-xs">
            <span className="text-muted-foreground">EQ preset</span>
            <select
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1"
              value={clip.audio.eqPreset ?? "flat"}
              onChange={(e) => patch({ audio: { eqPreset: e.target.value } }, "eq")}
            >
              <option value="flat">Flat</option>
              <option value="voice">Voice boost</option>
              <option value="bass">Bass boost</option>
              <option value="treble">Treble</option>
              <option value="podcast">Podcast</option>
            </select>
          </label>
          {(isAudio || (isVisual && !extractedVideo)) && (
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                className="accent-primary"
                checked={clip.audio.muted}
                onChange={(e) => patch({ audio: { muted: e.target.checked } }, "amute")}
              />
              Muet (clip)
            </label>
          )}
          {extractedVideo && (
            <p className="text-[10px] text-muted-foreground">
              Flux vidéo sans audio embarqué (extrait).
            </p>
          )}
          <KeyframeSection
            clipId={clip.id}
            property="volume"
            label="Volume (keyframes)"
            timeInClip={Math.max(0, time - clip.start)}
            clipDuration={clip.duration}
            tracks={clip.keyframes}
            fallback={clip.audio.volume}
            apply={apply}
          />
        </section>
      )}

      {activeTab === "color" && isVisual && (
        <section className="space-y-3 border-b border-border p-3">
          <h3 className="font-mono text-[10px] font-semibold uppercase text-muted-foreground">
            Étalonnage
          </h3>
          {(
            [
              ["temperature", "Température"],
              ["tint", "Teinte"],
              ["saturation", "Saturation"],
              ["exposure", "Exposition"],
              ["contrast", "Contraste"],
              ["highlights", "Hautes lumières"],
              ["shadows", "Ombres"],
              ["vibrance", "Vibrance"],
              ["sharpen", "Netteté"],
              ["vignette", "Vignette"],
              ["grain", "Grain"],
            ] as const
          ).map(([key, label]) => (
            <Slider
              key={key}
              label={label}
              value={grade?.[key] ?? 0}
              min={-1}
              max={1}
              step={0.01}
              onChange={(v) => patch({ colorGrade: { [key]: v } }, `cg-${key}`)}
            />
          ))}
        </section>
      )}

      {activeTab === "speed" && (
        <section className="space-y-2 border-b border-border p-3">
          <h3 className="font-mono text-[10px] font-semibold uppercase text-muted-foreground">
            Vitesse
          </h3>
          <Slider
            label="Constante"
            value={clip.speed}
            min={0.1}
            max={100}
            step={0.05}
            fmt={(v) => `×${v.toFixed(2)}`}
            onChange={(v) =>
              apply([{ type: "CHANGE_SPEED", clipId: clip.id, speed: v }], `${clip.id}:speed`)
            }
          />
          <div className="grid grid-cols-2 gap-1">
            {(
              [
                ["Montage", 1.5],
                ["Hero", 0.5],
                ["Bullet", 0.2],
                ["Flash", 4],
              ] as const
            ).map(([name, speed]) => (
              <button
                key={name}
                type="button"
                className="rounded bg-secondary px-2 py-1 text-[10px] uppercase hover:bg-raised"
                onClick={() =>
                  apply([
                    { type: "CHANGE_SPEED", clipId: clip.id, speed },
                    {
                      type: "ADD_EFFECT",
                      clipId: clip.id,
                      effect: {
                        id: `speed-curve-${Date.now()}`,
                        type: "speed-curve",
                        params: { preset: name, speed },
                      },
                    },
                  ])
                }
              >
                {name}
              </button>
            ))}
          </div>
        </section>
      )}

      {activeTab === "fx" && (
        <>
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
                  onClick={() =>
                    apply([{ type: "SET_TRANSITION", clipId: clip.id, transition: null }])
                  }
                >
                  Retirer
                </button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Aucune — onglet Transitions.</p>
            )}
          </section>
        </>
      )}

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

function KeyframeSection({
  clipId,
  property,
  label,
  timeInClip,
  clipDuration,
  tracks,
  fallback,
  apply,
}: {
  clipId: string;
  property: KeyframeTrack["property"];
  label: string;
  timeInClip: number;
  clipDuration: number;
  tracks: KeyframeTrack[] | undefined;
  fallback: number;
  apply: (ops: EditOperation[], coalesceKey?: string) => void;
}) {
  const track = tracks?.find((t) => t.property === property);
  const t = Math.min(clipDuration, Math.max(0, timeInClip));
  return (
    <div className="space-y-2 border-t border-border pt-2">
      <h3 className="font-mono text-[10px] font-semibold uppercase text-muted-foreground">
        {label}
      </h3>
      <p className="font-mono text-[10px] text-muted-foreground">
        Tête relative {t.toFixed(2)}s · {track?.keys.length ?? 0} clé(s)
      </p>
      <div className="flex gap-1">
        <button
          type="button"
          className="flex-1 rounded border border-border px-2 py-1 text-[10px] uppercase"
          onClick={() => {
            const next = upsertKeyframeTracks(tracks, property, t, fallback);
            apply([{ type: "UPDATE_CLIP", clipId, patch: { keyframes: next } }]);
          }}
        >
          Ajouter @ playhead
        </button>
        <button
          type="button"
          className="rounded border border-border px-2 py-1 text-[10px] uppercase disabled:opacity-40"
          disabled={!track?.keys.length}
          onClick={() => {
            const next = removeKeyframeAt(tracks, property, t);
            apply([{ type: "UPDATE_CLIP", clipId, patch: { keyframes: next } }]);
          }}
        >
          Retirer
        </button>
      </div>
      {track && track.keys.length > 0 && (
        <ul className="max-h-24 space-y-0.5 overflow-y-auto font-mono text-[10px]">
          {track.keys.map((k) => (
            <li key={k.id} className="flex justify-between text-muted-foreground">
              <span>
                {k.timeSec.toFixed(2)}s → {k.value.toFixed(2)}
              </span>
              <button
                type="button"
                className="hover:text-foreground"
                onClick={() => {
                  const next = removeKeyframeAt(tracks, property, k.timeSec);
                  apply([{ type: "UPDATE_CLIP", clipId, patch: { keyframes: next } }]);
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
