/**
 * Compte de démonstration (sans comptes réels).
 * planId null = plan déduit de l'essai (voir config.trial).
 */
export const demoAccount: { planId: string | null; trialStartedDaysAgo: number } = {
  planId: null,
  trialStartedDaysAgo: 3,
};

/** Début d'essai ISO dérivé de la démo (persistable plus tard). */
export function demoTrialStartedAt(now = new Date()): string {
  const d = new Date(now.getTime());
  d.setUTCDate(d.getUTCDate() - demoAccount.trialStartedDaysAgo);
  return d.toISOString();
}
