/** Erreur de lecture / intégrité d'un projet .hyb / .hybx. */
export class HybParseError extends Error {
  override readonly name = "HybParseError";
  constructor(message: string) {
    super(message);
  }
}
