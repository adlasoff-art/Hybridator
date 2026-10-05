export interface AccountSession {
  accountId: string;
  email: string;
  planId: string | null;
  trialStartedAt: string;
  displayName: string;
}

const ACCOUNT_KEY = "hybridator.accountSession";

export function loadLocalAccount(): AccountSession | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    return raw ? (JSON.parse(raw) as AccountSession) : null;
  } catch {
    return null;
  }
}

export function saveLocalAccount(session: AccountSession): void {
  try {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

/** Charge la session compte via API serveur, avec repli local. */
export async function fetchAccountSession(): Promise<AccountSession> {
  try {
    const res = await fetch("/api/auth/session", {
      headers: { "x-hybridator-account": loadLocalAccount()?.accountId ?? "acc_local" },
    });
    if (res.ok) {
      const data = (await res.json()) as { ok: boolean; session: AccountSession };
      if (data.ok && data.session) {
        saveLocalAccount(data.session);
        return data.session;
      }
    }
  } catch {
    /* offline */
  }
  const local = loadLocalAccount();
  if (local) return local;
  const started = new Date();
  started.setUTCDate(started.getUTCDate() - 3);
  const fallback: AccountSession = {
    accountId: "acc_local",
    email: "demo@hybridator.local",
    planId: null,
    trialStartedAt: started.toISOString(),
    displayName: "Compte démo",
  };
  saveLocalAccount(fallback);
  return fallback;
}

export async function updateAccountSession(
  patch: Partial<AccountSession>,
): Promise<AccountSession> {
  const current = (await fetchAccountSession()) ?? loadLocalAccount()!;
  const next = { ...current, ...patch };
  try {
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next),
    });
    if (res.ok) {
      const data = (await res.json()) as { session: AccountSession };
      saveLocalAccount(data.session);
      return data.session;
    }
  } catch {
    /* offline — local only */
  }
  saveLocalAccount(next);
  return next;
}

export async function startCheckout(planId: string): Promise<{
  ok: boolean;
  message: string;
  checkoutUrl?: string | null;
}> {
  try {
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    const data = (await res.json()) as {
      ok: boolean;
      message: string;
      checkoutUrl?: string | null;
    };
    return data;
  } catch {
    return {
      ok: false,
      message: "Paiement indisponible hors ligne. Votre travail local est conservé.",
    };
  }
}
