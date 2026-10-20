import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useProductConfig } from "@/config/ProductConfigProvider";
import { useDashboard } from "./DashboardContext";
import { projectInitials, projectThumbStyle } from "./thumb";

function firstName(displayName: string | undefined | null): string | null {
  if (!displayName?.trim()) return null;
  return displayName.trim().split(/\s+/)[0] ?? null;
}

export function DashboardHome() {
  const { config, account, isFlagOn } = useProductConfig();
  const { searchQuery, projects, projectsStatus, createProject, creating } = useDashboard();
  const aiCenterOn = isFlagOn("enable_ai_center");

  const recent = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base = q ? projects.filter((p) => p.name.toLowerCase().includes(q)) : projects;
    return base.slice(0, 4);
  }, [projects, searchQuery]);

  const greetName = firstName(account?.displayName);

  return (
    <div className="dash-home">
      <section className="dash-hero" aria-labelledby="dash-hero-title">
        <div>
          <h1 id="dash-hero-title">
            {greetName ? `Bonjour, ${greetName}` : `Bienvenue sur ${config.brand.name}`}
          </h1>
          <p>
            Votre espace Creator OS — projets locaux, studio et montage. Les parcours, pubs et
            analytics arriveront quand les intégrations seront branchées.
          </p>
        </div>
        <Link to="/app/journey" className="dash-journey-pill">
          Parcours — bientôt
        </Link>
      </section>

      <section className="dash-actions" aria-label="Actions rapides">
        <Link to="/app/strategy" className="dash-action-card">
          <span className="dash-action-ico" aria-hidden>
            ◇
          </span>
          <strong>Stratégie</strong>
          <span>Cadre éditorial — page en préparation.</span>
        </Link>
        <Link to="/editor" className="dash-action-card">
          <span className="dash-action-ico" aria-hidden>
            ◎
          </span>
          <strong>Studio</strong>
          <span>CaptureStudio (Mode A libre) dans l&apos;éditeur.</span>
        </Link>
        <Link to="/editor" className="dash-action-card">
          <span className="dash-action-ico" aria-hidden>
            ▣
          </span>
          <strong>Montage</strong>
          <span>Timeline non destructive, exports locaux.</span>
        </Link>
        <Link to="/app/publish" className="dash-action-card">
          <span className="dash-action-ico" aria-hidden>
            ▤
          </span>
          <strong>Distribution</strong>
          <span>Publications — intégrations non connectées.</span>
        </Link>
      </section>

      <div className="dash-grid-2">
        <section className="dash-panel" aria-labelledby="dash-projects-title">
          <div className="dash-panel-head">
            <h2 id="dash-projects-title">Projets récents</h2>
            <Link to="/projects" className="dash-panel-link">
              Tout voir
            </Link>
          </div>
          {projectsStatus === "loading" ? (
            <p className="dash-assistant-note">Chargement…</p>
          ) : projectsStatus === "error" ? (
            <div className="dash-empty">
              <p>Impossible de lire les projets locaux pour l&apos;instant.</p>
            </div>
          ) : recent.length === 0 ? (
            <div className="dash-empty">
              <p>
                {searchQuery.trim()
                  ? "Aucun projet ne correspond à cette recherche."
                  : "Aucun projet enregistré sur cet appareil."}
              </p>
              {!searchQuery.trim() ? (
                <button
                  type="button"
                  className="dash-empty-cta"
                  onClick={() => void createProject()}
                  disabled={creating}
                >
                  {creating ? "Création…" : "Créer un projet"}
                </button>
              ) : null}
            </div>
          ) : (
            <ul className="dash-project-list">
              {recent.map((p) => (
                <li key={p.id}>
                  <Link to="/editor" search={{ id: p.id }} className="dash-project-row">
                    <span
                      className="dash-thumb"
                      style={projectThumbStyle(p.id, p.name)}
                      aria-hidden
                    >
                      {projectInitials(p.name)}
                    </span>
                    <span className="dash-project-meta">
                      <strong>{p.name}</strong>
                      <small>Modifié le {new Date(p.updatedAt).toLocaleString("fr-FR")}</small>
                    </span>
                    <span className="dash-project-open">Ouvrir</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dash-panel" aria-labelledby="dash-cal-title">
          <div className="dash-panel-head">
            <h2 id="dash-cal-title">Calendrier</h2>
          </div>
          <div className="dash-empty">
            <p>
              Aucun événement — les intégrations calendrier / publications ne sont pas connectées.
            </p>
            <Link to="/app/publish" className="dash-empty-cta">
              En savoir plus
            </Link>
          </div>
        </section>
      </div>

      <div className="dash-grid-2">
        <section className="dash-panel dash-assistant" aria-labelledby="dash-ai-title">
          <div className="dash-panel-head">
            <h2 id="dash-ai-title">Assistant IA</h2>
          </div>
          <p className="dash-assistant-prompt">
            Les suggestions s&apos;appliquent dans l&apos;éditeur via des opérations non
            destructives — pas de résultat inventé ici.
          </p>
          <div className="dash-chip-row">
            <Link to="/editor" className="dash-chip">
              Ouvrir l&apos;éditeur
            </Link>
            {aiCenterOn ? (
              <Link to="/editor" className="dash-chip" title="Centre IA — preview avant apply">
                Générer un montage
              </Link>
            ) : (
              <button
                type="button"
                className="dash-chip"
                disabled
                title="Centre IA désactivé (feature flag)"
              >
                Générer un montage
              </button>
            )}
            <button
              type="button"
              className="dash-chip"
              disabled
              title="Workflow publications non branché"
            >
              Plan de pub
            </button>
          </div>
          <p className="dash-assistant-note">
            Dans l&apos;éditeur : suggestions → aperçu EditOperation → apply. Jamais de mutation
            source ni de faux résultat ici.
          </p>
        </section>

        <section className="dash-panel" aria-labelledby="dash-pubs-title">
          <div className="dash-panel-head">
            <h2 id="dash-pubs-title">Publications</h2>
          </div>
          <div className="dash-empty">
            <p>Aucune publication — OAuth / plateformes non connectés.</p>
            <Link to="/app/publish" className="dash-empty-cta">
              Voir la feuille de route
            </Link>
          </div>
        </section>
      </div>

      <section className="dash-panel" aria-labelledby="dash-stats-title">
        <div className="dash-panel-head">
          <h2 id="dash-stats-title">Statistiques</h2>
          <Link to="/app/analytics" className="dash-panel-link">
            Détail
          </Link>
        </div>
        <div className="dash-stats">
          <div className="dash-stat">
            <strong>Vues</strong>
            <span>Indisponible — analytics non branché</span>
          </div>
          <div className="dash-stat">
            <strong>Engagement</strong>
            <span>Indisponible — aucune intégration</span>
          </div>
          <div className="dash-stat">
            <strong>Abonnés</strong>
            <span>Indisponible — aucune plateforme</span>
          </div>
        </div>
      </section>
    </div>
  );
}
