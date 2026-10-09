import type { AccountSession } from "@/lib/account-session";
import { getCloudObjectStore } from "./sync-store.server";
import {
  dummyPasswordVerify,
  hashPassword,
  isValidEmail,
  normalizeEmail,
  randomToken,
  verifyPassword,
} from "./auth-crypto.server";

export interface AuthUserRecord {
  accountId: string;
  email: string;
  displayName: string;
  passwordHash: string;
  passwordSalt: string;
  planId: string | null;
  trialStartedAt: string;
  createdAt: string;
}

export interface AuthSessionRecord {
  token: string;
  accountId: string;
  expiresAt: string;
  createdAt: string;
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 jours

function userKey(email: string): string {
  return `auth/users/${normalizeEmail(email)}.json`;
}

function sessionKey(token: string): string {
  return `auth/sessions/${token}.json`;
}

function publicSession(user: AuthUserRecord): AccountSession {
  return {
    accountId: user.accountId,
    email: user.email,
    displayName: user.displayName,
    planId: user.planId,
    trialStartedAt: user.trialStartedAt,
  };
}

export async function findUserByEmail(email: string): Promise<AuthUserRecord | null> {
  const raw = await getCloudObjectStore().get(userKey(email));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUserRecord;
  } catch {
    return null;
  }
}

export async function registerUser(input: {
  email: string;
  password: string;
  displayName?: string;
}): Promise<{ ok: true; user: AccountSession; token: string } | { ok: false; error: string }> {
  if (!isValidEmail(input.email)) return { ok: false, error: "Email invalide." };
  if (input.password.length < 8) {
    return { ok: false, error: "Mot de passe : 8 caractères minimum." };
  }
  const email = normalizeEmail(input.email);
  if (await findUserByEmail(email)) {
    return { ok: false, error: "Un compte existe déjà avec cet email." };
  }
  const { hash, salt } = hashPassword(input.password);
  const now = new Date().toISOString();
  const user: AuthUserRecord = {
    accountId: `acc_${randomToken(8)}`,
    email,
    displayName: input.displayName?.trim() || email.split("@")[0] || "Utilisateur",
    passwordHash: hash,
    passwordSalt: salt,
    planId: null,
    trialStartedAt: now,
    createdAt: now,
  };
  await getCloudObjectStore().put(userKey(email), JSON.stringify(user));
  await writeAccountIndex(user.accountId, email);
  const token = await issueSession(user.accountId);
  return { ok: true, user: publicSession(user), token };
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<{ ok: true; user: AccountSession; token: string } | { ok: false; error: string }> {
  const user = await findUserByEmail(input.email);
  if (!user) {
    dummyPasswordVerify(input.password);
    return { ok: false, error: "Email ou mot de passe incorrect." };
  }
  if (!verifyPassword(input.password, user.passwordHash, user.passwordSalt)) {
    return { ok: false, error: "Email ou mot de passe incorrect." };
  }
  await writeAccountIndex(user.accountId, user.email);
  const token = await issueSession(user.accountId);
  return { ok: true, user: publicSession(user), token };
}

async function issueSession(accountId: string): Promise<string> {
  const token = randomToken(24);
  const now = Date.now();
  const record: AuthSessionRecord = {
    token,
    accountId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
  };
  await getCloudObjectStore().put(sessionKey(token), JSON.stringify(record));
  return token;
}

export async function resolveSessionToken(
  token: string | null | undefined,
): Promise<AccountSession | null> {
  if (!token) return null;
  const raw = await getCloudObjectStore().get(sessionKey(token));
  if (!raw) return null;
  let session: AuthSessionRecord;
  try {
    session = JSON.parse(raw) as AuthSessionRecord;
  } catch {
    return null;
  }
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    await getCloudObjectStore().delete(sessionKey(token));
    return null;
  }
  // Find user by scanning is heavy — store email index on session or lookup by listing.
  // We store accountId; find user via index file.
  const indexRaw = await getCloudObjectStore().get(`auth/index/${session.accountId}.json`);
  let email: string | null = null;
  if (indexRaw) {
    try {
      email = (JSON.parse(indexRaw) as { email: string }).email;
    } catch {
      email = null;
    }
  }
  if (!email) {
    // Fallback: rebuild from register path — write index on register/login
    return null;
  }
  const user = await findUserByEmail(email);
  return user ? publicSession(user) : null;
}

/** Index accountId → email pour résolution de session. */
async function writeAccountIndex(accountId: string, email: string): Promise<void> {
  await getCloudObjectStore().put(
    `auth/index/${accountId}.json`,
    JSON.stringify({ email: normalizeEmail(email) }),
  );
}

export async function logoutSession(token: string | null | undefined): Promise<boolean> {
  if (!token) return false;
  return getCloudObjectStore().delete(sessionKey(token));
}

export async function updateUserProfile(
  accountId: string,
  patch: { displayName?: string },
): Promise<AccountSession | null> {
  const user = await findUserByAccountId(accountId);
  if (!user) return null;
  const next: AuthUserRecord = {
    ...user,
    ...(patch.displayName !== undefined
      ? { displayName: patch.displayName.trim() || user.displayName }
      : {}),
  };
  await getCloudObjectStore().put(userKey(user.email), JSON.stringify(next));
  return publicSession(next);
}

/** Mise à jour plan réservée au billing (webhook) — jamais exposée au client. */
export async function setUserPlanFromBilling(
  accountId: string,
  planId: string,
): Promise<AccountSession | null> {
  const user = await findUserByAccountId(accountId);
  if (!user) return null;
  const next: AuthUserRecord = { ...user, planId };
  await getCloudObjectStore().put(userKey(user.email), JSON.stringify(next));
  return publicSession(next);
}

async function findUserByAccountId(accountId: string): Promise<AuthUserRecord | null> {
  const indexRaw = await getCloudObjectStore().get(`auth/index/${accountId}.json`);
  if (!indexRaw) return null;
  let email: string;
  try {
    email = (JSON.parse(indexRaw) as { email: string }).email;
  } catch {
    return null;
  }
  return findUserByEmail(email);
}
