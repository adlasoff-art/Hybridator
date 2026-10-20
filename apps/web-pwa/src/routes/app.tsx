import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { defaultProductConfig } from "@/config/product";

const name = defaultProductConfig.brand.name;

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: `Tableau de bord — ${name}` },
      {
        name: "description",
        content: "Creator OS Hybridator — projets, studio et montage sur cet appareil.",
      },
      { property: "og:title", content: `Tableau de bord — ${name}` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardShell,
});
