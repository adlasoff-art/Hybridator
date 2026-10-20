import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { CreatorOsLayout } from "@/components/dashboard/DashboardShell";
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
    <CreatorOsLayout>
      <div className="dash-page">
        <div className="dash-page-head">
          <div>
            <h1>Tarifs</h1>
            <p className="dash-page-lead">
              {config.trial.days} jours d&apos;accès complet, sans carte bancaire, avec{" "}
              {config.trial.aiMinutes} minutes d&apos;IA. Ensuite, vos projets restent lisibles et
              modifiables en local.
            </p>
          </div>
        </div>

        <div className="dash-plan-grid">
          {config.plans.map((p) => (
            <div
              key={p.id}
              className="dash-plan-card"
              data-highlight={p.highlighted ? "true" : undefined}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>{p.name}</h2>
                {p.id === activePlan.id ? <span className="dash-badge">Actuel</span> : null}
              </div>
              <p className="dash-muted" style={{ margin: 0 }}>
                {p.description}
              </p>
              <p className="dash-plan-price">
                {p.priceMonthly === null ? "Sur devis" : formatPrice(config, p.priceMonthly)}
                {p.priceMonthly !== null && p.priceMonthly > 0 ? (
                  <span className="dash-muted" style={{ fontSize: "0.75rem", fontWeight: 500 }}>
                    {" "}
                    / mois
                  </span>
                ) : null}
              </p>
              <ul>
                {[
                  unlimited(p.devices, p.devices === 1 ? "appareil" : "appareils"),
                  p.platforms.join(" + "),
                  p.cloudLabel,
                  p.exportLabel,
                  `Multi-caméras : ${unlimited(p.multicamAngles, "angles")}`,
                  `IA : ${p.aiLabel}`,
                ].map((l) => (
                  <li key={l} style={{ display: "flex", gap: "0.4rem" }}>
                    <Check
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: "var(--dash-green)", marginTop: "0.1rem" }}
                    />
                    {l}
                  </li>
                ))}
              </ul>
              {p.priceMonthly === null ? (
                <Link to="/editor" className="dash-btn" style={{ justifyContent: "center" }}>
                  Nous contacter
                </Link>
              ) : p.priceMonthly === 0 ? (
                <Link
                  to="/editor"
                  className="dash-btn dash-btn-primary"
                  style={{ justifyContent: "center" }}
                >
                  Commencer l&apos;essai
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => void onCheckout(p.id)}
                  className={`dash-btn${p.highlighted ? " dash-btn-primary" : ""}`}
                  style={{ justifyContent: "center" }}
                >
                  Choisir {p.name}
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="dash-muted" style={{ margin: 0, fontSize: "0.72rem" }}>
          Le checkout passe par le serveur (`/api/billing/checkout`) — aucune clé de paiement dans
          le navigateur.
        </p>
      </div>
    </CreatorOsLayout>
  );
}
