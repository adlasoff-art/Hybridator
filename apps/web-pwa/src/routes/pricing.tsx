import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { useProductConfig } from "@/config/ProductConfigProvider";
import { defaultProductConfig, formatPrice } from "@/config/product";
import { startCheckout } from "@/lib/account-session";

const name = defaultProductConfig.brand.name;

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: `Tarifs — ${name}` },
      { name: "description", content: `Plans, appareils, quotas IA et essai gratuit de ${name}.` },
      { property: "og:title", content: `Tarifs — ${name}` },
      {
        property: "og:description",
        content: `Plans, appareils, quotas IA et essai gratuit de ${name}.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pricing,
});

const unlimited = (n: number | null, unit: string) => (n === null ? "Illimité" : `${n} ${unit}`);

function Pricing() {
  const { config, activePlan, isFlagOn } = useProductConfig();

  const onCheckout = async (planId: string) => {
    if (!isFlagOn("enable_billing_checkout")) {
      toast.message("Paiement désactivé dans la configuration produit.");
      return;
    }
    const result = await startCheckout(planId);
    if (result.ok && result.checkoutUrl) {
      window.location.href = result.checkoutUrl;
      return;
    }
    toast.message(result.message);
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-14">
        <h1 className="text-4xl font-extrabold">Tarifs</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          {config.trial.days} jours d'accès complet, sans carte bancaire, avec{" "}
          {config.trial.aiMinutes} minutes d'IA. Ensuite, vos projets restent lisibles et
          modifiables en local.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {config.plans.map((p) => (
            <div
              key={p.id}
              className={`flex flex-col rounded-lg border bg-card p-5 ${p.highlighted ? "border-primary tally" : "border-border"}`}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">{p.name}</h2>
                {p.id === activePlan.id && (
                  <span className="font-mono text-[10px] uppercase text-accent">Actuel</span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
              <p className="mt-5 font-display text-3xl font-extrabold">
                {p.priceMonthly === null ? "Sur devis" : formatPrice(config, p.priceMonthly)}
                {p.priceMonthly !== null && p.priceMonthly > 0 && (
                  <span className="text-sm font-normal text-muted-foreground"> / mois</span>
                )}
              </p>
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {[
                  unlimited(p.devices, p.devices === 1 ? "appareil" : "appareils"),
                  p.platforms.join(" + "),
                  p.cloudLabel,
                  p.exportLabel,
                  `Multi-caméras : ${unlimited(p.multicamAngles, "angles")}`,
                  `IA : ${p.aiLabel}`,
                ].map((l) => (
                  <li key={l} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    {l}
                  </li>
                ))}
              </ul>
              {p.priceMonthly === null ? (
                <Link
                  to="/editor"
                  className="mt-6 rounded-md border border-border px-4 py-2 text-center text-sm font-semibold hover:bg-secondary"
                >
                  Nous contacter
                </Link>
              ) : p.priceMonthly === 0 ? (
                <Link
                  to="/editor"
                  className="mt-6 rounded-md border border-border px-4 py-2 text-center text-sm font-semibold hover:bg-secondary"
                >
                  Commencer l'essai
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => void onCheckout(p.id)}
                  className={`mt-6 rounded-md px-4 py-2 text-center text-sm font-semibold ${p.highlighted ? "bg-primary text-primary-foreground" : "border border-border hover:bg-secondary"}`}
                >
                  Choisir {p.name}
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Le checkout passe par le serveur (`/api/billing/checkout`) — aucune clé de paiement dans
          le navigateur.
        </p>
      </main>
    </div>
  );
}
