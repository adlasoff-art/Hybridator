import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { planLimit, type UsageLedger } from "@hybridator/licensing-billing";
import { DemoBadge } from "@/components/SiteHeader";
import { CreatorOsLayout } from "@/components/dashboard/DashboardShell";
import { useProductConfig } from "@/config/ProductConfigProvider";
import { defaultProductConfig, formatPrice } from "@/config/product";
import { loadUsageLedger } from "@/lib/usage-store";

const name = defaultProductConfig.brand.name;

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: `Administration — ${name}` },
      { name: "description", content: "Interrupteurs de fonctionnalités, quotas et coûts IA." },
      { property: "og:title", content: `Administration — ${name}` },
      {
        property: "og:description",
        content: "Interrupteurs de fonctionnalités, quotas et coûts IA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

function Admin() {
  const {
    config,
    isFlagOn,
    setFlag,
    activePlan,
    inTrial,
    trialDaysLeft,
    watermark,
    cloudSyncAllowed,
  } = useProductConfig();
  const [ledger, setLedger] = useState<UsageLedger>(() =>
    typeof window !== "undefined" ? loadUsageLedger() : { totals: {}, events: [] },
  );

  useEffect(() => {
    setLedger(loadUsageLedger());
    const id = window.setInterval(() => setLedger(loadUsageLedger()), 3_000);
    return () => window.clearInterval(id);
  }, []);

  const cost = ledger.events.reduce((a, e) => a + e.costUsd, 0);
  const trialCap = inTrial ? config.trial.aiMinutes : undefined;

  return (
    <CreatorOsLayout>
      <div className="dash-page">
        <div className="dash-page-head">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
              <h1>Administration</h1>
              <DemoBadge>Aperçu</DemoBadge>
            </div>
            <p className="dash-page-lead">
              Plan {activePlan.name}
              {inTrial ? ` · essai ${trialDaysLeft} j` : ""}
              {" · "}
              filigrane {watermark ? "oui" : "non"} · sync cloud{" "}
              {cloudSyncAllowed ? "autorisée" : "arrêtée"}
            </p>
          </div>
        </div>

        <div className="dash-admin-grid">
          <section className="dash-card dash-card-pad">
            <h2 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem", fontWeight: 700 }}>
              Interrupteurs de fonctionnalités
            </h2>
            <ul
              style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.45rem" }}
            >
              {Object.keys(config.featureFlags).map((k) => (
                <li key={k} className="dash-switch-row">
                  <code style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.68rem" }}>
                    {k}
                  </code>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isFlagOn(k)}
                    onClick={() => setFlag(k, !isFlagOn(k))}
                    className="dash-btn"
                    style={{
                      minWidth: "3rem",
                      justifyContent: "center",
                      background: isFlagOn(k)
                        ? "linear-gradient(135deg, var(--dash-blue), var(--dash-violet))"
                        : undefined,
                    }}
                  >
                    {isFlagOn(k) ? "On" : "Off"}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="dash-card dash-card-pad">
            <h2 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem", fontWeight: 700 }}>
              Quotas — plan {activePlan.name}
            </h2>
            <ul
              style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.75rem" }}
            >
              {config.quotas.map((q) => {
                const used = ledger.totals[q.key] ?? 0;
                const cap = planLimit(
                  activePlan,
                  q.key,
                  trialCap !== undefined ? { trialAiMinutesCap: trialCap } : undefined,
                );
                const ratio = cap && cap > 0 ? Math.min(1, used / cap) : 0;
                return (
                  <li key={q.key}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.8rem",
                        marginBottom: "0.35rem",
                      }}
                    >
                      <span>{q.label}</span>
                      <span
                        className="dash-muted"
                        style={{ fontFamily: "ui-monospace, monospace" }}
                      >
                        {used} / {cap ?? "—"} {q.unit}
                      </span>
                    </div>
                    <div
                      style={{
                        height: "0.35rem",
                        borderRadius: 999,
                        background: "var(--dash-panel-2)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${ratio * 100}%`,
                          background:
                            ratio > 0.85
                              ? "var(--dash-violet)"
                              : "linear-gradient(90deg, var(--dash-blue), var(--dash-green))",
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="dash-card dash-card-pad dash-span-2">
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                gap: "0.5rem",
                marginBottom: "0.75rem",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>
                Coûts IA (journal usage_events)
              </h2>
              <span className="dash-muted" style={{ fontFamily: "ui-monospace, monospace" }}>
                Coût {cost.toFixed(2)} USD · revenu plan{" "}
                {activePlan.priceMonthly === null
                  ? "sur devis"
                  : formatPrice(config, activePlan.priceMonthly)}
              </span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                <thead>
                  <tr className="dash-muted" style={{ textAlign: "left" }}>
                    <th style={{ padding: "0.45rem 0.35rem" }}>Quand</th>
                    <th style={{ padding: "0.45rem 0.35rem" }}>Fonction</th>
                    <th style={{ padding: "0.45rem 0.35rem" }}>Quantité</th>
                    <th style={{ padding: "0.45rem 0.35rem" }}>Unité</th>
                    <th style={{ padding: "0.45rem 0.35rem" }}>Fournisseur</th>
                    <th style={{ padding: "0.45rem 0.35rem", textAlign: "right" }}>Coût (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.events.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="dash-muted" style={{ padding: "0.85rem 0.35rem" }}>
                        Aucun événement — lancez une transcription pour journaliser la consommation.
                      </td>
                    </tr>
                  ) : (
                    ledger.events.slice(0, 50).map((e) => (
                      <tr key={e.id} style={{ borderTop: "1px solid var(--dash-line)" }}>
                        <td className="dash-muted" style={{ padding: "0.45rem 0.35rem" }}>
                          {new Date(e.at).toLocaleString("fr-FR")}
                        </td>
                        <td style={{ padding: "0.45rem 0.35rem" }}>{e.feature}</td>
                        <td style={{ padding: "0.45rem 0.35rem" }}>{e.quantity}</td>
                        <td style={{ padding: "0.45rem 0.35rem" }}>{e.unit}</td>
                        <td style={{ padding: "0.45rem 0.35rem" }}>{e.provider}</td>
                        <td style={{ padding: "0.45rem 0.35rem", textAlign: "right" }}>
                          {e.costUsd.toFixed(4)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </CreatorOsLayout>
  );
}
