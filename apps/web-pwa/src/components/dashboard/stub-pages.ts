import type { ComingSoonProps } from "./ComingSoonPage";

export const STUB_PAGES = {
  journey: {
    title: "Mon parcours",
    description:
      "Le suivi de progression créateur arrivera ici. Pour l’instant, créez et montez vos projets dans l’éditeur.",
    primaryCta: { to: "/editor", label: "Ouvrir l’éditeur" },
  },
  strategy: {
    title: "Stratégie éditoriale",
    description:
      "Cadres et calendriers éditoriaux — pas encore branchés. Utilisez vos projets locaux comme base de travail.",
    primaryCta: { to: "/projects", label: "Voir mes projets" },
  },
  ideas: {
    title: "Idées & Scripts",
    description:
      "Brainstorm et scripts assistés arriveront plus tard. Les panneaux IA de l’éditeur restent disponibles sur un projet ouvert.",
    primaryCta: { to: "/editor", label: "Aller à l’éditeur" },
  },
  studio: {
    title: "Studio de création",
    description:
      "Le studio multimodal (modes A–E) est en backlog. Aujourd’hui, CaptureStudio vit dans l’éditeur — Mode A (libre) d’abord.",
    primaryCta: { to: "/editor", label: "Ouvrir le studio / éditeur" },
  },
  formats: {
    title: "Déclinaison & Formats",
    description:
      "Versions dérivées (9:16, 1:1…) seront des projets liés non destructifs. Exportez depuis l’éditeur en attendant.",
    primaryCta: { to: "/editor", label: "Exporter depuis l’éditeur" },
  },
  publish: {
    title: "Publications",
    description:
      "OAuth et file de publication : audit des API officielles avant tout code. Aucune plateforme n’est connectée.",
    primaryCta: { to: "/projects", label: "Préparer un projet" },
  },
  analytics: {
    title: "Analytics",
    description:
      "Les métriques seront étiquetées (interne vs plateforme). Aucun chiffre fictif n’est affiché comme réel.",
    primaryCta: { to: "/app", label: "Retour au tableau de bord" },
  },
  library: {
    title: "Bibliothèque",
    description: "Médias OPFS et catalogues — disponibles dans l’éditeur pour le projet ouvert.",
    primaryCta: { to: "/editor", label: "Ouvrir la bibliothèque média" },
  },
  templates: {
    title: "Modèles",
    description:
      "Galerie de modèles Creator OS à venir. Le projet démo reste accessible depuis Projets.",
    primaryCta: { to: "/projects", label: "Mes projets" },
  },
  resources: {
    title: "Ressources",
    description:
      "Guides et assets créateur — page stub. Consultez la tarification pour les quotas du plan actif.",
    primaryCta: { to: "/pricing", label: "Voir les plans" },
  },
} as const satisfies Record<string, ComingSoonProps>;
