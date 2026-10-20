import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Bell, Menu, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { OfflineBadge } from "@/components/OfflineBadge";
import { useProductConfig } from "@/config/ProductConfigProvider";
import { DashboardProvider, useDashboard } from "./DashboardContext";
import {
  DASH_ACCOUNT_NAV,
  DASH_PRIMARY_NAV,
  DASH_SPACES_NAV,
  type DashNavItem,
} from "./dashboard-nav";
import { projectInitials, projectThumbStyle } from "./thumb";
import "./dashboard-widgets.css";

const APP_VERSION = "0.1.0";

function NavLink({ item, onNavigate }: { item: DashNavItem; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active =
    item.to === "/app"
      ? pathname === "/app" || pathname === "/app/"
      : pathname === item.to || pathname.startsWith(`${item.to}/`);

  return (
    <Link
      to={item.to}
      className="dash-nav-item"
      data-active={active ? "true" : undefined}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
    >
      <span className="dash-nav-ico" aria-hidden>
        {item.icon}
      </span>
      <span className="dash-nav-label">{item.label}</span>
      {item.badge || item.soon ? (
        <span className="dash-nav-badge">{item.badge ?? "Bientôt"}</span>
      ) : null}
    </Link>
  );
}

function SearchResults() {
  const { searchQuery, searchMatches, projectsStatus, setSearchQuery } = useDashboard();
  const q = searchQuery.trim();
  if (!q) return null;

  return (
    <div className="dash-search-results" role="listbox" aria-label="Résultats de recherche">
      {projectsStatus === "loading" ? (
        <p className="dash-search-empty">Chargement…</p>
      ) : searchMatches.length === 0 ? (
        <p className="dash-search-empty">Aucun projet pour « {q} »</p>
      ) : (
        <ul>
          {searchMatches.slice(0, 8).map((p) => (
            <li key={p.id} role="option">
              <Link
                to="/editor"
                search={{ id: p.id }}
                className="dash-search-hit"
                onClick={() => setSearchQuery("")}
              >
                <span
                  className="dash-thumb dash-thumb-sm"
                  style={projectThumbStyle(p.id, p.name)}
                  aria-hidden
                >
                  {projectInitials(p.name)}
                </span>
                <span>
                  <strong>{p.name}</strong>
                  <small>Ouvrir dans l&apos;éditeur</small>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link to="/projects" className="dash-search-footer" onClick={() => setSearchQuery("")}>
        Voir tous les projets
      </Link>
    </div>
  );
}

function OnlineStatus() {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!online) return <OfflineBadge />;
  return (
    <span className="dash-online">
      <i aria-hidden />
      PWA · En ligne
    </span>
  );
}

function ShellChrome({ children }: { children: ReactNode }) {
  const { config, account, activePlan } = useProductConfig();
  const { searchQuery, setSearchQuery } = useDashboard();
  const [notifOpen, setNotifOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const notifId = useId();
  const searchFieldId = useId();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const displayName = account?.displayName?.trim() || null;
  const initials = displayName
    ? displayName
        .split(/\s+/)
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  // Free / watermarked plans get upgrade CTA; paid plans see current plan (no fake upsell).
  const showUpgrade = activePlan.priceMonthly === 0 || activePlan.watermark === true;

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!notifOpen && !navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setNotifOpen(false);
      setNavOpen(false);
    };
    const onPointer = (e: MouseEvent) => {
      if (notifOpen && notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [notifOpen, navOpen]);

  const closeNav = () => setNavOpen(false);

  const sidebar = (
    <>
      <p className="dash-side-label">Création</p>
      <nav className="dash-nav" aria-label="Création">
        {DASH_PRIMARY_NAV.map((item) => (
          <NavLink key={item.to} item={item} onNavigate={closeNav} />
        ))}
      </nav>

      <p className="dash-side-label">Espaces</p>
      <nav className="dash-nav" aria-label="Espaces">
        {DASH_SPACES_NAV.map((item) => (
          <NavLink key={item.to} item={item} onNavigate={closeNav} />
        ))}
      </nav>

      <p className="dash-side-label">Compte</p>
      <nav className="dash-nav" aria-label="Compte">
        {DASH_ACCOUNT_NAV.map((item) => (
          <NavLink key={item.to} item={item} onNavigate={closeNav} />
        ))}
      </nav>

      {showUpgrade ? (
        <div className="dash-pro-card">
          <p className="dash-pro-title">Passez Pro</p>
          <p className="dash-pro-desc">
            Quotas, exports HD et sync cloud selon le plan — sans faux checkout ici.
          </p>
          <Link to="/pricing" className="dash-pro-btn" onClick={closeNav}>
            Voir les plans
          </Link>
        </div>
      ) : (
        <div className="dash-pro-card dash-pro-card-quiet">
          <p className="dash-pro-title">Plan actuel</p>
          <p className="dash-pro-desc">{activePlan.name}</p>
          <Link to="/account" className="dash-pro-btn" onClick={closeNav}>
            Gérer le compte
          </Link>
        </div>
      )}

      <div className="dash-side-foot">
        <OnlineStatus />
        <span className="dash-version">
          {config.brand.name} v{APP_VERSION}
        </span>
      </div>
    </>
  );

  return (
    <div className="dashboard-shell dash-layout" data-nav-open={navOpen ? "true" : undefined}>
      <header className="dash-topbar">
        <div className="dash-brand">
          <button
            type="button"
            className="dash-menu-btn"
            aria-label={navOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={navOpen}
            aria-controls="dash-sidebar"
            onClick={() => setNavOpen((v) => !v)}
          >
            {navOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          <Link to="/app" className="dash-logo" aria-label={`${config.brand.name} — accueil`}>
            <span className="dash-logo-mark" aria-hidden>
              H
            </span>
            <span>
              <strong>{config.brand.name}</strong>
              <small>Créer · Monter · Partager · Grandir</small>
            </span>
          </Link>
        </div>

        <div className="dash-search-wrap">
          <label className="sr-only" htmlFor={searchFieldId}>
            Rechercher un projet
          </label>
          <Search className="dash-search-ico" aria-hidden />
          <input
            id={searchFieldId}
            type="search"
            className="dash-search"
            placeholder="Rechercher un projet…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
            aria-autocomplete="list"
            aria-controls={searchQuery.trim() ? `${searchFieldId}-list` : undefined}
          />
          <div id={`${searchFieldId}-list`}>
            <SearchResults />
          </div>
        </div>

        <div className="dash-top-actions">
          <div className="dash-notif-wrap" ref={notifRef}>
            <button
              type="button"
              className="dash-icon-btn"
              aria-label="Notifications"
              aria-expanded={notifOpen}
              aria-controls={notifId}
              onClick={() => setNotifOpen((v) => !v)}
            >
              <Bell className="h-4 w-4" />
            </button>
            {notifOpen ? (
              <div id={notifId} className="dash-notif-pop" role="region" aria-label="Notifications">
                <p>Aucune notification pour l&apos;instant.</p>
                <p className="dash-muted-sm">
                  Les alertes publications arriveront avec les intégrations.
                </p>
              </div>
            ) : null}
          </div>

          {account ? (
            <Link to="/account" className="dash-profile" title="Compte">
              <span className="dash-avatar" aria-hidden>
                {initials}
              </span>
              <span className="dash-profile-meta">
                <strong>{displayName ?? "Compte"}</strong>
                <small>{activePlan.name}</small>
              </span>
            </Link>
          ) : (
            <Link to="/account" className="dash-profile dash-profile-cta">
              <span className="dash-avatar" aria-hidden>
                ?
              </span>
              <span className="dash-profile-meta">
                <strong>Créer un compte</strong>
                <small>Session locale</small>
              </span>
            </Link>
          )}
        </div>
      </header>

      {navOpen ? (
        <button
          type="button"
          className="dash-nav-backdrop"
          aria-label="Fermer le menu"
          onClick={closeNav}
        />
      ) : null}

      <div className="dash-body">
        <aside id="dash-sidebar" className="dash-sidebar" aria-label="Navigation Creator OS">
          {sidebar}
        </aside>

        <main className="dash-main">{children}</main>
      </div>
    </div>
  );
}

/** Chrome DA Creator OS partagé (dashboard + pages app hors éditeur/landing). */
export function CreatorOsLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardProvider>
      <ShellChrome>{children}</ShellChrome>
    </DashboardProvider>
  );
}

export function DashboardShell() {
  return (
    <CreatorOsLayout>
      <Outlet />
    </CreatorOsLayout>
  );
}
