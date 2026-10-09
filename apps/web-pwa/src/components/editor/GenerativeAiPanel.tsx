import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useProductConfig } from "@/config/ProductConfigProvider";
import {
  findClip,
  intentsToOperations,
  planToOperations,
  runAiJob,
  type EditOperation,
  type EditorDoc,
} from "@/engine";
import { resolveGenerativeAdapter } from "@/lib/generative-client";
import { withQuotaGate } from "@/lib/usage-store";

interface Props {
  doc: EditorDoc;
  selectedClipId: string | null;
  apply: (ops: EditOperation[], key?: string) => void;
  patchDoc: (fn: (d: EditorDoc) => EditorDoc) => void;
}

export function GenerativeAiPanel({ doc, selectedClipId, apply, patchDoc }: Props) {
  const { config, activePlan, inTrial, isFlagOn } = useProductConfig();
  const [prompt, setPrompt] = useState(
    "Crée une vidéo explicative de 30 secondes avec voix off et musique épique",
  );
  const [referenceNotes, setReferenceNotes] = useState("");
  const [durationSec, setDurationSec] = useState(30);
  const [instruction, setInstruction] = useState(
    "Applique un effet cinéma et une transition fondu",
  );
  const [busy, setBusy] = useState<"project" | "clip" | null>(null);
  const [lastSummary, setLastSummary] = useState<string | null>(null);

  if (!isFlagOn("enable_ai_center")) {
    return <p className="text-sm text-muted-foreground">Le Centre IA est désactivé.</p>;
  }

  const selected = selectedClipId ? findClip(doc.timeline, selectedClipId) : undefined;

  const runProject = async () => {
    if (busy || !prompt.trim()) return;
    setBusy("project");
    const { adapter, mode } = await resolveGenerativeAdapter();
    const minutes = Math.max(1, Math.ceil(durationSec / 60));
    const gate = withQuotaGate(activePlan, "ai", minutes, "min", adapter.providerId, doc.id, {
      rates: config.usageCostRatesUsd,
      ...(inTrial ? { trialAiMinutesCap: config.trial.aiMinutes } : {}),
    });
    const result = await runAiJob({
      before: gate.before,
      run: () => {
        const notes = referenceNotes.trim();
        return adapter.generateProject({
          projectId: doc.id,
          prompt: prompt.trim(),
          durationSec,
          language: "fr",
          ...(notes ? { referenceNotes: notes } : {}),
        });
      },
      after: gate.after,
    });
    setBusy(null);
    if (!result.ok) {
      toast.error(`${result.error} Projet intact.`);
      return;
    }
    const applied = planToOperations(result.value);
    apply(applied.operations);
    patchDoc((d) => ({
      ...d,
      settings: { ...d.settings, name: applied.title || d.settings.name },
      transcript: result.value.script
        ? {
            ...d.transcript,
            language: "fr",
            duration: result.value.durationSec,
            segments: [
              {
                id: "ai-script",
                speaker: "Narrateur",
                text: result.value.script,
                start: 0,
                end: result.value.durationSec,
                words: [],
              },
            ],
          }
        : d.transcript,
    }));
    setLastSummary(
      `${result.value.clips.length} clips · ${result.value.durationSec}s · ${result.value.mode}/${mode}`,
    );
    toast.success(
      mode === "server"
        ? `Projet généré (${result.value.providerId}).`
        : "Projet généré (adaptateur démo hors ligne).",
    );
  };

  const runClipEdit = async () => {
    if (busy || !selected || !instruction.trim()) return;
    setBusy("clip");
    const { adapter, mode } = await resolveGenerativeAdapter();
    const gate = withQuotaGate(activePlan, "ai", 1, "min", adapter.providerId, doc.id, {
      rates: config.usageCostRatesUsd,
      ...(inTrial ? { trialAiMinutesCap: config.trial.aiMinutes } : {}),
    });
    const track = doc.timeline.tracks.find((t) => t.id === selected.trackId);
    const result = await runAiJob({
      before: gate.before,
      run: () =>
        adapter.editClip({
          projectId: doc.id,
          clipId: selected.id,
          instruction: instruction.trim(),
          clipSummary: {
            ...(selected.label ? { label: selected.label } : {}),
            trackId: selected.trackId,
            start: selected.start,
            duration: selected.duration,
            ...(track?.kind ? { kind: track.kind } : {}),
          },
          language: "fr",
        }),
      after: gate.after,
    });
    setBusy(null);
    if (!result.ok) {
      toast.error(`${result.error} Clip intact.`);
      return;
    }
    const ops = intentsToOperations(doc, selected.id, result.value);
    if (!ops.length) {
      toast.message("Aucune opération dérivée.");
      return;
    }
    apply(ops);
    setLastSummary(result.value.summary);
    toast.success(
      mode === "server"
        ? `Édition appliquée (${result.value.providerId}).`
        : "Édition appliquée (démo).",
    );
  };

  return (
    <div className="space-y-5 text-sm">
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase text-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Scénario A — Prompt → timeline
        </p>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
          placeholder="Décrivez la vidéo à générer…"
        />
        <textarea
          value={referenceNotes}
          onChange={(e) => setReferenceNotes(e.target.value)}
          rows={2}
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
          placeholder="Notes / style / références (optionnel)"
        />
        <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          Durée (s)
          <input
            type="number"
            min={8}
            max={180}
            value={durationSec}
            onChange={(e) => setDurationSec(Number(e.target.value) || 30)}
            className="w-20 rounded border border-border bg-background px-2 py-1 font-mono text-foreground"
          />
        </label>
        <button
          type="button"
          disabled={busy !== null || !prompt.trim()}
          onClick={() => void runProject()}
          className="w-full rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
        >
          {busy === "project" ? "Génération…" : "Générer le montage"}
        </button>
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <p className="font-mono text-[10px] font-semibold uppercase text-foreground">
          Scénario B — Édition contextuelle
        </p>
        <p className="text-xs text-muted-foreground">
          {selected
            ? `Clip : ${selected.label ?? selected.id}`
            : "Sélectionnez un clip sur la timeline."}
        </p>
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={2}
          disabled={!selected}
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs disabled:opacity-40"
          placeholder='Ex. "Isole ma voix", "Flou + transition fondu"'
        />
        <button
          type="button"
          disabled={busy !== null || !selected || !instruction.trim()}
          onClick={() => void runClipEdit()}
          className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-xs hover:bg-raised disabled:opacity-40"
        >
          {busy === "clip" ? "Édition…" : "Appliquer l’instruction"}
        </button>
      </div>

      {lastSummary && (
        <p className="rounded border border-border bg-muted/50 px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
          {lastSummary}
        </p>
      )}
      <p className="text-[10px] leading-4 text-muted-foreground">
        Proxy `/api/ai/*` — clés OpenAI (`OPENAI_API_KEY` / `GENERATIVE_API_KEY`) uniquement
        serveur. Sans clé : planificateur démo. Quota : {activePlan.aiLabel}.
      </p>
    </div>
  );
}
