/**
 * Exécute un job IA sans muter le document en cas d'échec.
 * Les quotas doivent être vérifiés dans `before` ; l'usage est journalisé dans `after`.
 */
export async function runAiJob<T>(options: {
  before: () => void;
  run: () => Promise<T>;
  after: (result: { ok: true; value: T } | { ok: false; error: string }) => void;
}): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    options.before();
  } catch (e) {
    const error = e instanceof Error ? e.message : "Quota insuffisant.";
    const fail = { ok: false as const, error };
    options.after(fail);
    return fail;
  }

  try {
    const value = await options.run();
    const ok = { ok: true as const, value };
    options.after(ok);
    return ok;
  } catch (e) {
    const error = e instanceof Error ? e.message : "Échec du job IA.";
    const fail = { ok: false as const, error };
    options.after(fail);
    return fail;
  }
}
