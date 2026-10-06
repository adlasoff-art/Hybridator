/**
 * Stripe Checkout — secrets uniquement serveur.
 */
function env(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  const v = process.env[name];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export function stripePriceIdForPlan(planId: string): string | undefined {
  // Mapping plan produit → Price ID Stripe (infra), jamais hardcodé dans l'UI.
  const key = `STRIPE_PRICE_${planId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  return env(key) ?? env(`STRIPE_PRICE_${planId}`);
}

export async function createStripeCheckoutSession(options: {
  planId: string;
  accountId: string;
  customerEmail?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; checkoutUrl: string; sessionId: string } | { ok: false; message: string }> {
  const stripeKey = env("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    return {
      ok: false,
      message:
        "Paiement non configuré : définissez STRIPE_SECRET_KEY uniquement côté serveur. Votre travail local est intact.",
    };
  }
  const priceId = stripePriceIdForPlan(options.planId);
  if (!priceId) {
    return {
      ok: false,
      message: `Aucun STRIPE_PRICE_${options.planId} configuré côté serveur pour ce plan.`,
    };
  }
  const successUrl = env("STRIPE_SUCCESS_URL") ?? "http://localhost:8080/pricing?checkout=success";
  const cancelUrl = env("STRIPE_CANCEL_URL") ?? "http://localhost:8080/pricing?checkout=cancel";
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  const body = new URLSearchParams();
  body.set("mode", "subscription");
  body.set("success_url", successUrl);
  body.set("cancel_url", cancelUrl);
  body.set("client_reference_id", options.accountId);
  body.set("metadata[planId]", options.planId);
  body.set("metadata[accountId]", options.accountId);
  body.set("line_items[0][price]", priceId);
  body.set("line_items[0][quantity]", "1");
  if (options.customerEmail) body.set("customer_email", options.customerEmail);

  const res = await fetchImpl("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    return { ok: false, message: `Stripe Checkout échoué (${res.status}): ${msg || "erreur"}` };
  }
  const json = (await res.json()) as { id?: string; url?: string };
  if (!json.url || !json.id) {
    return { ok: false, message: "Réponse Stripe invalide (url manquante)." };
  }
  return { ok: true, checkoutUrl: json.url, sessionId: json.id };
}

/** Parse minimal d'un événement checkout.session.completed (sans SDK). */
export function planIdFromStripeEvent(event: unknown): {
  planId: string;
  accountId: string;
} | null {
  if (!event || typeof event !== "object") return null;
  const e = event as {
    type?: string;
    data?: { object?: { metadata?: Record<string, string>; client_reference_id?: string } };
  };
  if (e.type !== "checkout.session.completed") return null;
  const obj = e.data?.object;
  const planId = obj?.metadata?.["planId"];
  const accountId = obj?.metadata?.["accountId"] ?? obj?.client_reference_id;
  if (!planId || !accountId) return null;
  return { planId, accountId };
}
