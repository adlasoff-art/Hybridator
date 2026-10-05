/**
 * Historique par snapshots immuables (partage structurel via copies superficielles du doc).
 * Les opérations restent le journal source de vérité ; un CRDT pourra remplacer
 * ce store plus tard pour la collaboration temps réel.
 */

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export const createHistory = <T>(present: T): History<T> => ({ past: [], present, future: [] });

export function commit<T>(h: History<T>, next: T, limit = 200): History<T> {
  if (next === h.present) return h;
  return { past: [...h.past, h.present].slice(-limit), present: next, future: [] };
}

export function undo<T>(h: History<T>): History<T> {
  const prev = h.past[h.past.length - 1];
  if (prev === undefined) return h;
  return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future] };
}

export function redo<T>(h: History<T>): History<T> {
  const [next, ...rest] = h.future;
  if (next === undefined) return h;
  return { past: [...h.past, h.present], present: next, future: rest };
}

/** Propriété utile aux tests : undo après commit restitue la référence précédente. */
export function canUndo<T>(h: History<T>): boolean {
  return h.past.length > 0;
}

export function canRedo<T>(h: History<T>): boolean {
  return h.future.length > 0;
}
