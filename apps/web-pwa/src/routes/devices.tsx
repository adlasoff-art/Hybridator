import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Globe, Laptop, Smartphone, Tablet } from "lucide-react";
import { toast } from "sonner";
import { DemoBadge, SiteHeader } from "@/components/SiteHeader";
import { useProductConfig } from "@/config/ProductConfigProvider";
import { defaultProductConfig } from "@/config/product";
import { demoDevices, type DemoDevice } from "@/lib/demo-account";

const name = defaultProductConfig.brand.name;

export const Route = createFileRoute("/devices")({
  head: () => ({
    meta: [
      { title: `Appareils connectés — ${name}` },
      {
        name: "description",
        content: "Gérez les ordinateurs, tablettes et navigateurs connectés à votre compte.",
      },
      { property: "og:title", content: `Appareils connectés — ${name}` },
      {
        property: "og:description",
        content: "Gérez les ordinateurs, tablettes et navigateurs connectés à votre compte.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Devices,
});

const ICON = { desktop: Laptop, web: Globe, pwa: Globe, mobile: Smartphone, tablet: Tablet };

function lastSeen(m: number) {
  if (m < 1) return "Actif maintenant";
  if (m < 60) return `Il y a ${m} min`;
  if (m < 60 * 24) return `Il y a ${Math.round(m / 60)} h`;
  return `Il y a ${Math.round(m / 1440)} j`;
}

function Devices() {
  const { activePlan } = useProductConfig();
  const [devices, setDevices] = useState<DemoDevice[]>(demoDevices);
  const limit = activePlan.devices;
  const over = limit !== null && devices.length > limit;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-14">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-extrabold">Appareils</h1>
          <DemoBadge />
        </div>
        <p className="mt-2 text-muted-foreground">
          {devices.length} / {limit ?? "∞"} appareils actifs avec le plan {activePlan.name}.
        </p>
        {over && (
          <div className="mt-4 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
            Limite atteinte : déconnectez un appareil inactif pour en utiliser un nouveau.
          </div>
        )}
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-card">
          {devices.map((d) => {
            const Icon = ICON[d.platform];
            return (
              <li key={d.id} className="flex items-center gap-4 p-4">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium">
                    {d.name}{" "}
                    {d.current && (
                      <span className="ml-1 font-mono text-[10px] uppercase text-accent">
                        Cet appareil
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {d.os} · {lastSeen(d.lastSeenMinutes)}
                  </p>
                </div>
                {!d.current && (
                  <button
                    onClick={() => {
                      setDevices((p) => p.filter((x) => x.id !== d.id));
                      toast.success(`${d.name} déconnecté`);
                    }}
                    className="rounded-md border border-border px-3 py-1.5 text-xs hover:border-destructive hover:text-destructive"
                  >
                    Déconnecter
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
