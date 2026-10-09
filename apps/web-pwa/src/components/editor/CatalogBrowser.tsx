import { toast } from "sonner";
import {
  EFFECT_CATALOG,
  STICKER_CATALOG,
  TEXT_CATALOG,
  TRANSITION_CATALOG,
  opForCatalogEffect,
  opForCatalogTransition,
  opsForCatalogOverlay,
  type CatalogItem,
  type EditOperation,
  type EditorDoc,
} from "@/engine";

type CatalogTab = "text" | "stickers" | "effects" | "transitions";

interface Props {
  mode: CatalogTab;
  doc: EditorDoc;
  time: number;
  selectedClipId: string | null;
  apply: (ops: EditOperation[], key?: string) => void;
}

const LISTS: Record<CatalogTab, CatalogItem[]> = {
  text: TEXT_CATALOG,
  stickers: STICKER_CATALOG,
  effects: EFFECT_CATALOG,
  transitions: TRANSITION_CATALOG,
};

export function CatalogBrowser({ mode, doc, time, selectedClipId, apply }: Props) {
  const items = LISTS[mode];

  const onPick = (item: CatalogItem) => {
    if (item.kind === "text" || item.kind === "sticker") {
      const ops = opsForCatalogOverlay(doc, item, time);
      if (!ops.length) {
        toast.error("Piste cible introuvable.");
        return;
      }
      apply(ops);
      toast.success(`${item.label} ajouté à la timeline.`);
      return;
    }
    if (!selectedClipId) {
      toast.message("Sélectionnez un clip sur la timeline.");
      return;
    }
    if (item.kind === "effect") {
      const op = opForCatalogEffect(selectedClipId, item);
      if (op) {
        apply([op]);
        toast.success(`Effet « ${item.label} » appliqué.`);
      }
      return;
    }
    if (item.kind === "transition") {
      const op = opForCatalogTransition(selectedClipId, item);
      if (op) {
        apply([op]);
        toast.success(`Transition « ${item.label} » appliquée.`);
      }
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {mode === "text" && "Ajoute un calque texte sur T1 à la tête de lecture."}
        {mode === "stickers" && "Ajoute un sticker sur V2 à la tête de lecture."}
        {mode === "effects" && "Applique un effet au clip sélectionné."}
        {mode === "transitions" && "Définit la transition de sortie du clip sélectionné."}
      </p>
      <ul className="grid grid-cols-2 gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onPick(item)}
              className="flex w-full flex-col items-center justify-center gap-1 rounded border border-border bg-secondary/60 px-2 py-3 text-center hover:bg-raised"
            >
              {item.kind === "sticker" ? (
                <span className="text-2xl leading-none">{item.content}</span>
              ) : (
                <span className="font-mono text-[10px] uppercase text-primary">{item.kind}</span>
              )}
              <span className="text-xs font-medium">{item.label}</span>
              {(item.kind === "text" || item.kind === "sticker") && (
                <span className="font-mono text-[9px] text-muted-foreground">
                  {item.defaultDurationSec}s
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
