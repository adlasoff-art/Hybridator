import type { EditOperation } from "@/engine";
import { summarizeEditOperations } from "@/engine";

export type PendingAiBatch = {
  title: string;
  detail?: string;
  operations: EditOperation[];
  /** Effets document hors EditOperation (ex. titre / transcript) — appliqués seulement après confirm. */
  applySideEffects?: () => void;
};

interface Props {
  pending: PendingAiBatch | null;
  onApply: () => void;
  onDiscard: () => void;
}

/**
 * Preview honnête avant apply : liste d'EditOperations, jamais d'auto-apply.
 * Les assets source ne sont pas mutés — seules des ops non destructives sont proposées.
 */
export function AiOpsPreview({ pending, onApply, onDiscard }: Props) {
  if (!pending || pending.operations.length === 0) return null;
  const lines = summarizeEditOperations(pending.operations);

  return (
    <div
      className="space-y-2 rounded-md border border-primary/35 bg-primary/5 p-2.5"
      role="region"
      aria-label="Aperçu des opérations IA"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase text-primary">
            Aperçu — pas encore appliqué
          </p>
          <p className="mt-0.5 text-xs font-medium text-foreground">{pending.title}</p>
          {pending.detail ? (
            <p className="mt-0.5 text-[10px] text-muted-foreground">{pending.detail}</p>
          ) : null}
        </div>
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
          {pending.operations.length} op.
        </span>
      </div>
      <ul className="max-h-36 space-y-0.5 overflow-y-auto rounded border border-border/60 bg-background/60 px-2 py-1.5">
        {lines.map((line, i) => (
          <li
            key={`${i}-${line}`}
            className="font-mono text-[10px] leading-4 text-muted-foreground"
          >
            · {line}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={onApply}
          className="flex-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Appliquer
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-secondary"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
