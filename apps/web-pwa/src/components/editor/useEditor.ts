import { useCallback, useRef, useState } from "react";
import {
  applyOperations,
  commit,
  createHistory,
  redo,
  undo,
  type EditOperation,
  type EditorDoc,
  type History,
} from "@/engine";

/** Pont React fin au-dessus du moteur pur. */
export function useEditor(initial: EditorDoc) {
  const [history, setHistory] = useState<History<EditorDoc>>(() => createHistory(initial));
  const lastKey = useRef<string | null>(null);

  const apply = useCallback((ops: EditOperation[], coalesceKey?: string) => {
    if (ops.length === 0) return;
    setHistory((h) => {
      const next = { ...applyOperations(h.present, ops), updatedAt: new Date().toISOString() };
      if (coalesceKey && coalesceKey === lastKey.current) return { ...h, present: next };
      return commit(h, next);
    });
    lastKey.current = coalesceKey ?? null;
  }, []);

  return {
    doc: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    apply,
    undo: useCallback(() => {
      lastKey.current = null;
      setHistory(undo);
    }, []),
    redo: useCallback(() => {
      lastKey.current = null;
      setHistory(redo);
    }, []),
    reset: useCallback((d: EditorDoc) => {
      lastKey.current = null;
      setHistory(createHistory(d));
    }, []),
  };
}
