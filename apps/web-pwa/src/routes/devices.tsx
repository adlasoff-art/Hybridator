import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Globe, Laptop, Smartphone, Tablet } from "lucide-react";
import { toast } from "sonner";
import { minutesSinceHeartbeat, type DeviceSession } from "@hybridator/licensing-billing";
import { DemoBadge } from "@/components/SiteHeader";
import { CreatorOsLayout } from "@/components/dashboard/DashboardShell";
import { useProductConfig } from "@/config/ProductConfigProvider";
import { defaultProductConfig } from "@/config/product";
import { loadDeviceSessions, remoteLogoutSession, tickHeartbeat } from "@/lib/license-session";

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
  const { activePlan, deviceId, licenseValid, licenseReason } = useProductConfig();
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const limit = activePlan.devices;
  const over = limit !== null && devices.length > limit;

  useEffect(() => {
    setDevices(loadDeviceSessions());
    if (deviceId) tickHeartbeat(deviceId);
    const id = window.setInterval(() => setDevices(loadDeviceSessions()), 5_000);
    return () => window.clearInterval(id);
  }, [deviceId]);

  return (
    <CreatorOsLayout>
      <div className="dash-page" style={{ maxWidth: "48rem" }}>
        <div className="dash-page-head">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
              <h1>Appareils</h1>
              <DemoBadge />
            </div>
            <p className="dash-page-lead">
              {devices.length} / {limit ?? "∞"} appareils actifs avec le plan {activePlan.name}.
            </p>
          </div>
        </div>

        {!licenseValid ? (
          <div className="dash-alert dash-alert-danger">
            {licenseReason ?? "Licence invalide sur cet appareil."}
          </div>
        ) : null}
        {over ? (
          <div className="dash-alert dash-alert-warn">
            Limite atteinte : déconnectez un appareil inactif pour en utiliser un nouveau.
          </div>
        ) : null}

        <ul className="dash-card" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {devices.map((d) => {
            const Icon = ICON[d.platform];
            const mins = minutesSinceHeartbeat(d);
            return (
              <li key={d.id} className="dash-list-row">
                <Icon className="h-5 w-5 shrink-0" style={{ color: "var(--dash-muted)" }} />
                <div className="dash-list-meta">
                  <strong>
                    {d.name} {d.current ? <span className="dash-badge">Cet appareil</span> : null}
                  </strong>
                  <small>
                    {d.os} · {lastSeen(mins)}
                  </small>
                </div>
                {!d.current ? (
                  <button
                    type="button"
                    className="dash-btn dash-btn-danger"
                    onClick={() => {
                      setDevices(remoteLogoutSession(d.id));
                      toast.success(`${d.name} déconnecté à distance`);
                    }}
                  >
                    Déconnecter
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </CreatorOsLayout>
  );
}
