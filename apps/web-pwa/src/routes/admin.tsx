import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { planLimit, type UsageLedger } from "@hybridator/licensing-billing";
import { DemoBadge, SiteHeader } from "@/components/SiteHeader";
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
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-14">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-extrabold">Administration</h1>
          <DemoBadge>Aperçu</DemoBadge>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Plan {activePlan.name}
          {inTrial ? ` · essai ${trialDaysLeft} j` : ""}
          {" · "}
          filigrane {watermark ? "oui" : "non"} · sync cloud{" "}
          {cloudSyncAllowed ? "autorisée" : "arrêtée"}
        </p>
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-bold">Interrupteurs de fonctionnalités</h2>
            <ul className="mt-4 space-y-2">
              {Object.keys(config.featureFlags).map((k) => (
                <li
                  key={k}
                  className="flex items-center justify-between rounded-md bg-muted px-3 py-2"
                >
                  <code className="font-mono text-xs">{k}</code>
                  <button
                    role="switch"
                    aria-checked={isFlagOn(k)}
                    onClick={() => setFlag(k, !isFlagOn(k))}
                    className={`relative h-5 w-9 rounded-full transition ${isFlagOn(k) ? "bg-accent" : "bg-raised"}`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-foreground transition ${isFlagOn(k) ? "left-4.5" : "left-0.5"}`}
                    />
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-bold">Quotas — plan {activePlan.name}</h2>
            <ul className="mt-4 space-y-3">
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
                    <div className="flex justify-between text-sm">
                      <span>{q.label}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {used} / {cap ?? "—"} {q.unit}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded bg-muted">
                      <div
                        className={`h-full rounded ${ratio > 0.85 ? "bg-primary" : "bg-accent"}`}
                        style={{ width: `${ratio * 100}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
            <div className="flex items-baseline justify-between">
              <h2 className="font-bold">Coûts IA (journal usage_events)</h2>
              <span className="font-mono text-sm">
                Coût {cost.toFixed(2)} USD · revenu plan{" "}
                {activePlan.priceMonthly === null
                  ? "sur devis"
                  : formatPrice(config, activePlan.priceMonthly)}
              </span>
            </div>
            <table className="mt-4 w-full text-left text-sm">
              <thead className="font-mono text-xs text-muted-foreground">
                <tr>
                  <th className="py-2">Quand</th>
                  <th>Fonction</th>
                  <th>Quantité</th>
                  <th>Unité</th>
                  <th>Fournisseur</th>
                  <th className="text-right">Coût (USD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ledger.events.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-muted-foreground">
                      Aucun événement — lancez une transcription pour journaliser la consommation.
                    </td>
                  </tr>
                ) : (
                  ledger.events.slice(0, 50).map((e) => (
                    <tr key={e.id}>
                      <td className="py-2 font-mono text-xs text-muted-foreground">
                        {new Date(e.at).toLocaleString("fr-FR")}
                      </td>
                      <td>{e.feature}</td>
                      <td className="font-mono">{e.quantity}</td>
                      <td>{e.unit}</td>
                      <td>{e.provider}</td>
                      <td className="text-right font-mono">{e.costUsd.toFixed(4)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </div>
      </main>
    </div>
  );
}
