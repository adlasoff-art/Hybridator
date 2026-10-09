export interface AccountSession {
  accountId: string;
  email: string;
  planId: string | null;
  trialStartedAt: string;
  displayName: string;
}

const ACCOUNT_KEY = "hybridator.accountSession";
const TOKEN_KEY = "hybridator.authToken";

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

export function loadAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveAuthToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    "x-hybridator-account": loadLocalAccount()?.accountId ?? "acc_local",
    ...extra,
  };
  const token = loadAuthToken();
  if (token) headers["authorization"] = `Bearer ${token}`;
  return headers;
}

function demoFallback(): AccountSession {
  const started = new Date();
  started.setUTCDate(started.getUTCDate() - 3);
  return {
    accountId: "acc_local",
    email: "demo@hybridator.local",
    planId: null,
    trialStartedAt: started.toISOString(),
    displayName: "Compte démo",
  };
}

/** Charge la session compte via API serveur, avec repli local. */
export async function fetchAccountSession(): Promise<AccountSession> {
  try {
    const res = await fetch("/api/auth/me", { headers: authHeaders() });
    if (res.ok) {
      const data = (await res.json()) as {
        ok: boolean;
        session: AccountSession;
        authenticated?: boolean;
      };
      if (data.ok && data.session) {
        if (data.authenticated !== true) {
          // Token absent/expiré : ne pas rester « connecté » en local.
          saveAuthToken(null);
        }
        saveLocalAccount(data.session);
        return data.session;
      }
    } else if (res.status === 401) {
      saveAuthToken(null);
    }
  } catch {
    /* offline */
  }
  const local = loadLocalAccount();
  if (local && isAuthenticatedLocally()) {
    // Hors ligne avec token : garder le cache local.
    return local;
  }
  if (local && local.accountId === "acc_local") return local;
  const fallback = demoFallback();
  saveLocalAccount(fallback);
  return fallback;
}

export async function registerAccount(input: {
  email: string;
  password: string;
  displayName?: string;
}): Promise<{ ok: true; session: AccountSession } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = (await res.json()) as {
      ok: boolean;
      error?: string;
      session?: AccountSession;
      token?: string;
    };
    if (!data.ok || !data.session || !data.token) {
      return { ok: false, error: data.error ?? "Inscription impossible." };
    }
    saveAuthToken(data.token);
    saveLocalAccount(data.session);
    return { ok: true, session: data.session };
  } catch {
    return { ok: false, error: "Serveur indisponible." };
  }
}

export async function loginAccount(input: {
  email: string;
  password: string;
}): Promise<{ ok: true; session: AccountSession } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = (await res.json()) as {
      ok: boolean;
      error?: string;
      session?: AccountSession;
      token?: string;
    };
    if (!data.ok || !data.session || !data.token) {
      return { ok: false, error: data.error ?? "Connexion impossible." };
    }
    saveAuthToken(data.token);
    saveLocalAccount(data.session);
    return { ok: true, session: data.session };
  } catch {
    return { ok: false, error: "Serveur indisponible." };
  }
}

export async function logoutAccount(): Promise<void> {
  const token = loadAuthToken();
  try {
    if (token) {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: authHeaders(),
      });
    }
  } catch {
    /* ignore */
  }
  saveAuthToken(null);
  const fallback = demoFallback();
  saveLocalAccount(fallback);
}

export async function updateAccountProfile(patch: {
  displayName?: string;
}): Promise<{ ok: true; session: AccountSession } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: authHeaders({ "content-type": "application/json" }),
      body: JSON.stringify(patch),
    });
    const data = (await res.json()) as {
      ok: boolean;
      error?: string;
      session?: AccountSession;
    };
    if (!data.ok || !data.session) {
      return { ok: false, error: data.error ?? "Mise à jour impossible." };
    }
    saveLocalAccount(data.session);
    return { ok: true, session: data.session };
  } catch {
    return { ok: false, error: "Serveur indisponible." };
  }
}

export async function updateAccountSession(
  patch: Partial<Pick<AccountSession, "displayName" | "email">>,
): Promise<AccountSession> {
  const current = await fetchAccountSession();
  // planId / accountId ne sont jamais poussés depuis le client.
  const next: AccountSession = {
    ...current,
    ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
    ...(patch.email !== undefined ? { email: patch.email } : {}),
  };
  try {
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: authHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({
        displayName: next.displayName,
        email: next.email,
      }),
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
  const account = loadLocalAccount();
  try {
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: authHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({
        planId,
        accountId: account?.accountId ?? "acc_local",
        email: account?.email,
      }),
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

export function isAuthenticatedLocally(): boolean {
  return Boolean(loadAuthToken());
}
