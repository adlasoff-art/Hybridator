import { handleServerStt, type ServerSttRequest } from "./ai-stt.server";
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
import type { AccountSession } from "@/lib/account-session";
import type { EditorDoc } from "@hybridator/core-model";
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

async function loadSession(accountId: string): Promise<AccountSession> {
  return (await sessionGet(accountId)) ?? { ...defaultSession(), accountId };
}

function accountIdFrom(request: Request): string {
  return request.headers.get("x-hybridator-account") ?? "acc_local";
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
        const cookieId = accountIdFrom(request);
        const session = await loadSession(cookieId);
        await sessionPut(session);
        return json({ ok: true, session });
      }
      if (request.method === "POST") {
        const body = (await request.json()) as Partial<AccountSession>;
        const base = await loadSession(body.accountId ?? "acc_local");
        const next: AccountSession = {
          ...base,
          ...(body.email !== undefined ? { email: body.email } : {}),
          ...(body.planId !== undefined ? { planId: body.planId } : {}),
          ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
          ...(body.trialStartedAt !== undefined ? { trialStartedAt: body.trialStartedAt } : {}),
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
      const body = (await request.json()) as {
        planId?: string;
        accountId?: string;
        email?: string;
      };
      const plan: Plan = findPlan(defaultProductConfig, body.planId ?? "creator");
      const result = await createStripeCheckoutSession({
        planId: plan.id,
        accountId: body.accountId ?? "acc_local",
        ...(body.email !== undefined ? { customerEmail: body.email } : {}),
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
      if (secret) {
        const verified = await verifyStripeWebhookSignature({
          payload,
          header: request.headers.get("stripe-signature"),
          secret,
        });
        if (!verified.ok) return json({ ok: false, error: verified.reason }, 400);
      } else if (env("NODE_ENV") === "production") {
        return json({ ok: false, error: "STRIPE_WEBHOOK_SECRET requis en production." }, 503);
      }
      let event: unknown;
      try {
        event = JSON.parse(payload) as unknown;
      } catch {
        return json({ ok: false, error: "Corps webhook JSON invalide." }, 400);
      }
      const mapped = planIdFromStripeEvent(event);
      if (!mapped) return json({ ok: true, ignored: true });
      const base = await loadSession(mapped.accountId);
      const next: AccountSession = { ...base, planId: mapped.planId };
      await sessionPut(next);
      return json({ ok: true, session: next });
    }

    if (url.pathname === "/api/sync/projects" && request.method === "GET") {
      const accountId = accountIdFrom(request);
      return json({ ok: true, projects: await syncList(accountId) });
    }

    if (url.pathname.startsWith("/api/sync/projects/") && request.method === "GET") {
      const projectId = decodeURIComponent(url.pathname.slice("/api/sync/projects/".length));
      const doc = await syncGet(accountIdFrom(request), projectId);
      if (!doc) return json({ ok: false, error: "Projet cloud introuvable." }, 404);
      return json({ ok: true, doc });
    }

    if (url.pathname === "/api/sync/projects" && request.method === "PUT") {
      const body = (await request.json()) as { doc?: EditorDoc };
      if (!body.doc?.id) return json({ ok: false, error: "Document manquant." }, 400);
      await syncPut(accountIdFrom(request), body.doc);
      return json({ ok: true, id: body.doc.id });
    }

    if (url.pathname.startsWith("/api/sync/projects/") && request.method === "DELETE") {
      const projectId = decodeURIComponent(url.pathname.slice("/api/sync/projects/".length));
      const removed = await syncDelete(accountIdFrom(request), projectId);
      return json({ ok: removed });
    }

    if (url.pathname === "/api/health" && request.method === "GET") {
      return json({
        ok: true,
        sttConfigured: Boolean(env("STT_API_KEY") || env("STT_ALLOW_DEMO_SERVER") === "1"),
        sttProvider: env("STT_PROVIDER") ?? "demo",
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
