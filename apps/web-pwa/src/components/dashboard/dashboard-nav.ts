/** Navigation Creator OS — liens réels vs stubs honnêtes. */

export type DashNavItem = {
  to: string;
  label: string;
  icon: string;
  badge?: string;
  soon?: boolean;
};

export const DASH_PRIMARY_NAV: DashNavItem[] = [
  { to: "/app", label: "Accueil", icon: "⌂" },
  { to: "/app/journey", label: "Mon parcours", icon: "♙", badge: "Bientôt", soon: true },
  { to: "/app/strategy", label: "Stratégie éditoriale", icon: "◇", soon: true },
  { to: "/app/ideas", label: "Idées & Scripts", icon: "♢", soon: true },
  // Studio multimodal = stub ; CaptureStudio Mode A est dans /editor (carte action + CTA stub).
  { to: "/app/studio", label: "Studio de création", icon: "◎", soon: true },
  { to: "/editor", label: "Montage vidéo", icon: "▣" },
  { to: "/app/formats", label: "Déclinaison & Formats", icon: "▦", soon: true },
  { to: "/app/publish", label: "Publications", icon: "▤", soon: true },
  { to: "/app/analytics", label: "Analytics", icon: "▥", soon: true },
];

export const DASH_SPACES_NAV: DashNavItem[] = [
  { to: "/projects", label: "Projets", icon: "▱" },
  { to: "/app/library", label: "Bibliothèque", icon: "▧", soon: true },
  { to: "/app/templates", label: "Modèles", icon: "▦", soon: true },
  { to: "/app/resources", label: "Ressources", icon: "◫", soon: true },
];

/** Liens compte / tarifs / appareils (réels, pas stubs). */
export const DASH_ACCOUNT_NAV: DashNavItem[] = [
  { to: "/account", label: "Compte", icon: "◎" },
  { to: "/pricing", label: "Tarifs", icon: "◇" },
  { to: "/devices", label: "Appareils", icon: "▣" },
  { to: "/admin", label: "Admin", icon: "▥" },
];
