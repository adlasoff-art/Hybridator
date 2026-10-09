import { handleServerStt, type ServerSttRequest } from "./ai-stt.server";
import {
  handleGenerativeEdit,
  handleGenerativeProject,
  isGenerativeLlmConfigured,
} from "./ai-generate.server";
import type { GenerativeEditRequest, GenerativeProjectRequest } from "@hybridator/ai-core";
import { createStripeCheckoutSession, planIdFromStripeEvent } from "./billing-stripe.server";
import { verifyStripeWebhookSignature } from "./stripe-webhook.server";
import {
  sessionGet,
  sessionPut,
  syncDelete,
  syncGet,
  syncList,
  syncPut,
} from "./sync-store.server";
import {
  loginUser,
  logoutSession,
  registerUser,
  resolveSessionToken,
  setUserPlanFromBilling,
  updateUserProfile,
} from "./auth-store.server";
import { checkRateLimit } from "./rate-limit.server";
import type { AccountSession } from "@/lib/account-session";
import type { EditorDoc } from "@hybridator/core-model";
import type { Plan } from "@hybridator/licensing-billing";
import { findPlan, defaultProductConfig, verifyLicenseJwt } from "@hybridator/licensing-billing";

const DEMO_ACCOUNT_ID = "acc_local";

function json(data: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

function env(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  const v = process.env[name];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function defaultSession(): AccountSession {
  const started = new Date();
  started.setUTCDate(started.getUTCDate() - 3);
  return {
    accountId: DEMO_ACCOUNT_ID,
    email: "demo@hybridator.local",
    planId: null,
    trialStartedAt: started.toISOString(),
    displayName: "Compte démo",
  };
}

async function loadSession(accountId: string): Promise<AccountSession> {
  return (await sessionGet(accountId)) ?? { ...defaultSession(), accountId };
}

function bearerToken(request: Request): string | null {
  const h = request.headers.get("authorization");
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m?.[1]?.trim() || null;
}

function clientKey(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("cf-connecting-ip") ||
    "local"
  );
}

function rateLimited(key: string, limit: number, windowMs: number): Response | null {
  const hit = checkRateLimit(key, limit, windowMs);
  if (hit.ok) return null;
  return json({ ok: false, error: "Trop de requêtes. Réessayez plus tard." }, 429, {
    "retry-after": String(hit.retryAfterSec),
  });
}

/**
 * Compte sync : token Bearer → compte authentifié.
 * Sans token : uniquement le bucket démo `acc_local` (header spoofable ignoré).
 */
async function resolveSyncAccountId(
  request: Request,
): Promise<{ ok: true; accountId: string } | { ok: false; response: Response }> {
  const token = bearerToken(request);
  if (token) {
    const session = await resolveSessionToken(token);
    if (!session) {
      return { ok: false, response: json({ ok: false, error: "Session invalide." }, 401) };
    }
    return { ok: true, accountId: session.accountId };
  }
  return { ok: true, accountId: DEMO_ACCOUNT_ID };
}

/** Routeur API V1 — secrets et logique compte uniquement ici. */
export async function handleApiRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;

  try {
    if (url.pathname === "/api/stt" && request.method === "POST") {
      const body = (await request.json()) as ServerSttRequest;
      const transcript = await handleServerStt(body);
      return json(transcript);
    }

    if (url.pathname === "/api/ai/generate" && request.method === "POST") {
      const limited = rateLimited(`ai:${clientKey(request)}`, 40, 60_000);
      if (limited) return limited;
      const token = bearerToken(request);
      const authed = await resolveSessionToken(token);
      if (isGenerativeLlmConfigured() && !authed) {
        return json({ ok: false, error: "Authentification requise pour l'IA LLM." }, 401);
      }
      const body = (await request.json()) as GenerativeProjectRequest;
      if (!body?.prompt?.trim()) return json({ ok: false, error: "Prompt requis." }, 400);
      const plan = await handleGenerativeProject(body);
      return json(plan);
    }

    if (url.pathname === "/api/ai/edit-clip" && request.method === "POST") {
      const limited = rateLimited(`ai:${clientKey(request)}`, 40, 60_000);
      if (limited) return limited;
      const token = bearerToken(request);
      const authed = await resolveSessionToken(token);
      if (isGenerativeLlmConfigured() && !authed) {
        return json({ ok: false, error: "Authentification requise pour l'IA LLM." }, 401);
      }
      const body = (await request.json()) as GenerativeEditRequest;
      if (!body?.clipId || !body?.instruction?.trim()) {
        return json({ ok: false, error: "clipId et instruction requis." }, 400);
      }
      const result = await handleGenerativeEdit(body);
      return json(result);
    }

    if (url.pathname === "/api/auth/register" && request.method === "POST") {
      const limited = rateLimited(`auth-reg:${clientKey(request)}`, 10, 60_000);
      if (limited) return limited;
      const body = (await request.json()) as {
        email?: string;
        password?: string;
        displayName?: string;
      };
      if (!body.email || !body.password) {
        return json({ ok: false, error: "Email et mot de passe requis." }, 400);
      }
      const result = await registerUser({
        email: body.email,
        password: body.password,
        ...(body.displayName ? { displayName: body.displayName } : {}),
      });
      if (!result.ok) return json(result, 400);
      await sessionPut(result.user);
      return json({ ok: true, session: result.user, token: result.token });
    }

    if (url.pathname === "/api/auth/login" && request.method === "POST") {
      const limited = rateLimited(`auth-login:${clientKey(request)}`, 20, 60_000);
      if (limited) return limited;
      const body = (await request.json()) as { email?: string; password?: string };
      if (!body.email || !body.password) {
        return json({ ok: false, error: "Email et mot de passe requis." }, 400);
      }
      const result = await loginUser({ email: body.email, password: body.password });
      if (!result.ok) return json(result, 401);
      await sessionPut(result.user);
      return json({ ok: true, session: result.user, token: result.token });
    }

    if (url.pathname === "/api/auth/logout" && request.method === "POST") {
      const token = bearerToken(request);
      await logoutSession(token);
      return json({ ok: true });
    }

    if (url.pathname === "/api/auth/me" && request.method === "GET") {
      const token = bearerToken(request);
      const authed = await resolveSessionToken(token);
      if (authed) return json({ ok: true, session: authed, authenticated: true });
      // Sans Bearer : session démo uniquement (pas de lecture via header spoofable).
      const session = await loadSession(DEMO_ACCOUNT_ID);
      return json({ ok: true, session, authenticated: false });
    }

    if (url.pathname === "/api/auth/profile" && request.method === "PATCH") {
      const token = bearerToken(request);
      const authed = await resolveSessionToken(token);
      if (!authed) return json({ ok: false, error: "Non authentifié." }, 401);
      const body = (await request.json()) as { displayName?: string };
      const updated = await updateUserProfile(authed.accountId, {
        ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
      });
      if (!updated) return json({ ok: false, error: "Compte introuvable." }, 404);
      await sessionPut(updated);
      return json({ ok: true, session: updated });
    }

    if (url.pathname === "/api/auth/session") {
      if (request.method === "GET") {
        const token = bearerToken(request);
        const authed = await resolveSessionToken(token);
        if (authed) return json({ ok: true, session: authed, authenticated: true });
        const session = await loadSession(DEMO_ACCOUNT_ID);
        await sessionPut(session);
        return json({ ok: true, session, authenticated: false });
      }
      if (request.method === "POST") {
        // Cosmétique démo uniquement — jamais planId / accountId client.
        const body = (await request.json()) as Partial<AccountSession>;
        const token = bearerToken(request);
        const authed = await resolveSessionToken(token);
        if (authed) {
          const updated = await updateUserProfile(authed.accountId, {
            ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
          });
          const session = updated ?? authed;
          await sessionPut(session);
          return json({ ok: true, session });
        }
        const base = await loadSession(DEMO_ACCOUNT_ID);
        const next: AccountSession = {
          ...base,
          accountId: DEMO_ACCOUNT_ID,
          ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
          ...(body.email !== undefined ? { email: body.email } : {}),
        };
        await sessionPut(next);
        return json({ ok: true, session: next });
      }
      return json({ ok: false, error: "Méthode non supportée" }, 405);
    }

    if (url.pathname === "/api/license/issue" && request.method === "POST") {
      const body = (await request.json()) as {
        accountId?: string;
        planId?: string;
        deviceId?: string;
      };
      const secret =
        env("LICENSE_SIGNING_SECRET") ??
        (env("NODE_ENV") === "development" || env("LICENSE_ALLOW_DEV") === "1"
          ? "hybridator-dev-license"
          : undefined);
      if (!secret || !body.deviceId || !body.planId) {
        return json({ ok: false, reason: "Paramètres licence incomplets." }, 400);
      }
      const plan = findPlan(defaultProductConfig, body.planId);

      const token = bearerToken(request);
      const authed = await resolveSessionToken(token);
      let accountId: string;
      let planId: string;
      if (authed) {
        accountId = authed.accountId;
        // Plan JWT = plan facturé si connu, sinon plan actif client (essai).
        planId = authed.planId ?? plan.id;
      } else {
        // Démo uniquement — refuse un accountId arbitraire.
        if (
          body.accountId &&
          body.accountId !== DEMO_ACCOUNT_ID &&
          body.accountId !== "local-demo-account"
        ) {
          return json({ ok: false, reason: "Authentification requise." }, 401);
        }
        accountId = DEMO_ACCOUNT_ID;
        planId = plan.id;
      }

      const { issueLicenseJwt, defaultLicenseTtlSec } =
        await import("@hybridator/licensing-billing");
      const now = Math.floor(Date.now() / 1000);
      const issued = await issueLicenseJwt(
        {
          sub: accountId,
          planId,
          deviceId: body.deviceId,
          iat: now,
          exp: now + defaultLicenseTtlSec(),
        },
        secret,
      );
      return json({ ok: true, jwt: issued.jwt, claims: issued.claims });
    }

    if (url.pathname === "/api/license/verify" && request.method === "POST") {
      const body = (await request.json()) as { jwt?: string; deviceId?: string };
      const secret =
        env("LICENSE_SIGNING_SECRET") ??
        (env("NODE_ENV") === "development" || env("LICENSE_ALLOW_DEV") === "1"
          ? "hybridator-dev-license"
          : undefined);
      if (!body.jwt || !secret) {
        return json({ ok: false, reason: "JWT ou secret licence serveur manquant." }, 400);
      }
      const verified = await verifyLicenseJwt(body.jwt, secret);
      if (!verified.ok) return json(verified);
      if (body.deviceId && verified.claims.deviceId !== body.deviceId) {
        return json({ ok: false, reason: "JWT lié à un autre appareil." });
      }
      return json({ ok: true, claims: verified.claims });
    }

    if (url.pathname === "/api/billing/checkout" && request.method === "POST") {
      const body = (await request.json()) as {
        planId?: string;
        accountId?: string;
        email?: string;
      };
      const token = bearerToken(request);
      const authed = await resolveSessionToken(token);
      const accountId = authed?.accountId ?? DEMO_ACCOUNT_ID;
      if (!authed && body.accountId && body.accountId !== DEMO_ACCOUNT_ID) {
        return json({ ok: false, message: "Authentification requise pour ce compte." }, 401);
      }
      const plan: Plan = findPlan(defaultProductConfig, body.planId ?? "creator");
      const customerEmail = authed?.email ?? body.email;
      const result = await createStripeCheckoutSession({
        planId: plan.id,
        accountId,
        ...(customerEmail ? { customerEmail } : {}),
      });
      if (!result.ok) {
        return json({
          ok: false,
          configured: Boolean(env("STRIPE_SECRET_KEY")),
          planId: plan.id,
          message: result.message,
        });
      }
      return json({
        ok: true,
        configured: true,
        planId: plan.id,
        checkoutUrl: result.checkoutUrl,
        sessionId: result.sessionId,
        message: "Session Checkout créée.",
      });
    }

    if (url.pathname === "/api/billing/webhook" && request.method === "POST") {
      const payload = await request.text();
      const secret = env("STRIPE_WEBHOOK_SECRET");
      const billingEnabled = Boolean(env("STRIPE_SECRET_KEY"));
      if (secret) {
        const verified = await verifyStripeWebhookSignature({
          payload,
          header: request.headers.get("stripe-signature"),
          secret,
        });
        if (!verified.ok) return json({ ok: false, error: verified.reason }, 400);
      } else if (env("NODE_ENV") === "production" || billingEnabled) {
        return json(
          { ok: false, error: "STRIPE_WEBHOOK_SECRET requis lorsque le billing est actif." },
          503,
        );
      }
      let event: unknown;
      try {
        event = JSON.parse(payload) as unknown;
      } catch {
        return json({ ok: false, error: "Corps webhook JSON invalide." }, 400);
      }
      const mapped = planIdFromStripeEvent(event);
      if (!mapped) return json({ ok: true, ignored: true });
      const billed = await setUserPlanFromBilling(mapped.accountId, mapped.planId);
      const base = billed ?? (await loadSession(mapped.accountId));
      const next: AccountSession = { ...base, planId: mapped.planId };
      await sessionPut(next);
      return json({ ok: true, session: next });
    }

    if (url.pathname === "/api/sync/projects" && request.method === "GET") {
      const resolved = await resolveSyncAccountId(request);
      if (!resolved.ok) return resolved.response;
      return json({ ok: true, projects: await syncList(resolved.accountId) });
    }

    if (url.pathname.startsWith("/api/sync/projects/") && request.method === "GET") {
      const resolved = await resolveSyncAccountId(request);
      if (!resolved.ok) return resolved.response;
      const projectId = decodeURIComponent(url.pathname.slice("/api/sync/projects/".length));
      const doc = await syncGet(resolved.accountId, projectId);
      if (!doc) return json({ ok: false, error: "Projet cloud introuvable." }, 404);
      return json({ ok: true, doc });
    }

    if (url.pathname === "/api/sync/projects" && request.method === "PUT") {
      const resolved = await resolveSyncAccountId(request);
      if (!resolved.ok) return resolved.response;
      const body = (await request.json()) as { doc?: EditorDoc };
      if (!body.doc?.id) return json({ ok: false, error: "Document manquant." }, 400);
      await syncPut(resolved.accountId, body.doc);
      return json({ ok: true, id: body.doc.id });
    }

    if (url.pathname.startsWith("/api/sync/projects/") && request.method === "DELETE") {
      const resolved = await resolveSyncAccountId(request);
      if (!resolved.ok) return resolved.response;
      const projectId = decodeURIComponent(url.pathname.slice("/api/sync/projects/".length));
      const removed = await syncDelete(resolved.accountId, projectId);
      return json({ ok: removed });
    }

    if (url.pathname === "/api/health" && request.method === "GET") {
      return json({
        ok: true,
        sttConfigured: Boolean(env("STT_API_KEY") || env("STT_ALLOW_DEMO_SERVER") === "1"),
        sttProvider: env("STT_PROVIDER") ?? "demo",
        generativeConfigured: isGenerativeLlmConfigured(),
        billingConfigured: Boolean(env("STRIPE_SECRET_KEY")),
        webhookConfigured: Boolean(env("STRIPE_WEBHOOK_SECRET")),
        syncPersistent: Boolean(env("SYNC_DATA_DIR")),
      });
    }

    return json({ ok: false, error: "Route API inconnue" }, 404);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur API";
    return json({ ok: false, error: message }, 500);
  }
}
