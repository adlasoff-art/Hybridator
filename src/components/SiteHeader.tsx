import { Link } from "@tanstack/react-router";
import { useProductConfig } from "@/config/ProductConfigProvider";

const NAV = [
  { to: "/projects", label: "Projets" },
  { to: "/editor", label: "Éditeur" },
  { to: "/pricing", label: "Tarifs" },
  { to: "/devices", label: "Appareils" },
  { to: "/admin", label: "Admin" },
] as const;

export function BrandMark() {
  const { config } = useProductConfig();
  return (
    <Link to="/" className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
      </span>
      {config.brand.name}
    </Link>
  );
}

export function SiteHeader() {
  const { activePlan, trialDaysLeft } = useProductConfig();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <BrandMark />
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary text-foreground" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 font-mono text-xs">
          <span className="rounded border border-border px-2 py-1 text-muted-foreground">{activePlan.name}</span>
          {trialDaysLeft > 0 && (
            <span className="rounded bg-warning/15 px-2 py-1 text-warning">Essai : {trialDaysLeft} j</span>
          )}
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-border px-2 py-1 md:hidden">
        {NAV.map((n) => (
          <Link key={n.to} to={n.to} className="rounded px-2.5 py-1 text-xs text-muted-foreground" activeProps={{ className: "bg-secondary text-foreground" }}>
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function DemoBadge({ children = "Démonstration" }: { children?: string }) {
  return (
    <span className="rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-warning">
      {children}
    </span>
  );
}
