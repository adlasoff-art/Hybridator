import { handleServerStt, type ServerSttRequest } from "./ai-stt.server";
import type { AccountSession } from "@/lib/account-session";
import type { Plan } from "@hybridator/licensing-billing";
import { findPlan, defaultProductConfig, verifyLicenseJwt } from "@hybridator/licensing-billing";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function env(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  const v = process.env[name];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

const memorySessions = new Map<string, AccountSession>();

function defaultSession(): AccountSession {
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

    if (url.pathname === "/api/auth/session") {
      if (request.method === "GET") {
        const cookieId = request.headers.get("x-hybridator-account") ?? "acc_local";
        const session = memorySessions.get(cookieId) ?? defaultSession();
        memorySessions.set(session.accountId, session);
        return json({ ok: true, session });
      }
      if (request.method === "POST") {
        const body = (await request.json()) as Partial<AccountSession>;
        const base = memorySessions.get(body.accountId ?? "acc_local") ?? defaultSession();
        const next: AccountSession = {
          ...base,
          ...(body.email !== undefined ? { email: body.email } : {}),
          ...(body.planId !== undefined ? { planId: body.planId } : {}),
          ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
          ...(body.trialStartedAt !== undefined ? { trialStartedAt: body.trialStartedAt } : {}),
        };
        memorySessions.set(next.accountId, next);
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
      if (!secret || !body.deviceId || !body.accountId || !body.planId) {
        return json({ ok: false, reason: "Paramètres licence incomplets." }, 400);
      }
      const { issueLicenseJwt, defaultLicenseTtlSec } =
        await import("@hybridator/licensing-billing");
      const now = Math.floor(Date.now() / 1000);
      const token = await issueLicenseJwt(
        {
          sub: body.accountId,
          planId: body.planId,
          deviceId: body.deviceId,
          iat: now,
          exp: now + defaultLicenseTtlSec(),
        },
        secret,
      );
      return json({ ok: true, jwt: token.jwt, claims: token.claims });
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
      const body = (await request.json()) as { planId?: string };
      const plan: Plan = findPlan(defaultProductConfig, body.planId ?? "creator");
      const stripeKey = env("STRIPE_SECRET_KEY");
      if (!stripeKey) {
        return json({
          ok: false,
          configured: false,
          planId: plan.id,
          message:
            "Paiement non configuré : définissez STRIPE_SECRET_KEY uniquement côté serveur. Votre travail local est intact.",
        });
      }
      // Hook Stripe Checkout réel — la clé ne quitte pas le serveur.
      void stripeKey;
      return json({
        ok: true,
        configured: true,
        planId: plan.id,
        checkoutUrl: null,
        message: "Session Checkout à brancher (Stripe) — secret serveur OK.",
      });
    }

    if (url.pathname === "/api/health" && request.method === "GET") {
      return json({
        ok: true,
        sttConfigured: Boolean(env("STT_API_KEY") || env("STT_ALLOW_DEMO_SERVER") === "1"),
        billingConfigured: Boolean(env("STRIPE_SECRET_KEY")),
      });
    }

    return json({ ok: false, error: "Route API inconnue" }, 404);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur API";
    return json({ ok: false, error: message }, 500);
  }
}
