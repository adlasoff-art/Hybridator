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
import { AiOpsPreview, type PendingAiBatch } from "./AiOpsPreview";

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
  const [pending, setPending] = useState<PendingAiBatch | null>(null);
  const [lastSummary, setLastSummary] = useState<string | null>(null);

  if (!isFlagOn("enable_ai_center")) {
    return <p className="text-sm text-muted-foreground">Le Centre IA est désactivé.</p>;
  }

  const selected = selectedClipId ? findClip(doc.timeline, selectedClipId) : undefined;

  const confirmPending = () => {
    if (!pending?.operations.length) return;
    apply(pending.operations);
    pending.applySideEffects?.();
    setLastSummary(pending.detail ?? pending.title);
    setPending(null);
    toast.success("Opérations IA appliquées (non destructives).");
  };

  const runProject = async () => {
    if (busy || !prompt.trim()) return;
    setBusy("project");
    setPending(null);
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
    if (!applied.operations.length) {
      toast.message("Aucune EditOperation dérivée du plan.");
      return;
    }
    const script = result.value.script;
    const title = applied.title;
    setPending({
      title: "Scénario A — Prompt → timeline",
      detail: `${applied.operations.length} ops · ${result.value.clips.length} clips · ${result.value.durationSec}s · ${result.value.mode}/${mode}`,
      operations: applied.operations,
      applySideEffects: () => {
        patchDoc((d) => ({
          ...d,
          settings: { ...d.settings, name: title || d.settings.name },
          transcript: script
            ? {
                ...d.transcript,
                language: "fr",
                duration: result.value.durationSec,
                segments: [
                  {
                    id: "ai-script",
                    speaker: "Narrateur",
                    text: script,
                    start: 0,
                    end: result.value.durationSec,
                    words: [],
                  },
                ],
              }
            : d.transcript,
        }));
      },
    });
    toast.message("Aperçu prêt — validez pour appliquer.");
  };

  const runClipEdit = async () => {
    if (busy || !selected || !instruction.trim()) return;
    setBusy("clip");
    setPending(null);
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
    setPending({
      title: "Scénario B — Édition contextuelle",
      detail: `${result.value.summary} · ${mode}`,
      operations: ops,
    });
    toast.message("Aperçu prêt — validez pour appliquer.");
  };

  return (
    <div className="space-y-5 text-sm">
      <p className="rounded border border-border bg-muted/40 px-2 py-1.5 text-[10px] leading-4 text-muted-foreground">
        Les suggestions passent par des <strong className="text-foreground">EditOperation</strong>{" "}
        uniquement. Aperçu obligatoire avant apply — les médias source ne sont jamais mutés.
      </p>

      <AiOpsPreview pending={pending} onApply={confirmPending} onDiscard={() => setPending(null)} />

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
          {busy === "project" ? "Génération…" : "Proposer le montage"}
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
          {busy === "clip" ? "Analyse…" : "Proposer l’édition"}
        </button>
      </div>

      {lastSummary && (
        <p className="rounded border border-border bg-muted/50 px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
          Dernier apply : {lastSummary}
        </p>
      )}
      <p className="text-[10px] leading-4 text-muted-foreground">
        Proxy `/api/ai/*` — clés uniquement serveur. Sans clé : planificateur démo. Quota :{" "}
        {activePlan.aiLabel}.
      </p>
    </div>
  );
}
