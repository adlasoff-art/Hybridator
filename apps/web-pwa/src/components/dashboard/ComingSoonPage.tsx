import { Link } from "@tanstack/react-router";

/** Routes CTA connues — évite les `to: string` non typés. */
export type ComingSoonTo = "/app" | "/editor" | "/projects" | "/pricing" | "/account";

export type ComingSoonProps = {
  title: string;
  description: string;
  primaryCta?: { to: ComingSoonTo; label: string };
  secondaryCta?: { to: ComingSoonTo; label: string };
};

export function ComingSoonPage({
  title,
  description,
  primaryCta,
  secondaryCta = { to: "/app", label: "Retour au tableau de bord" },
}: ComingSoonProps) {
  return (
    <div className="dash-coming">
      <p className="dash-demo-label">Bientôt</p>
      <h1>{title}</h1>
      <p>{description}</p>
      <div className="dash-coming-actions">
        {primaryCta ? (
          <Link to={primaryCta.to} className="dash-coming-btn dash-coming-btn-primary">
            {primaryCta.label}
          </Link>
        ) : null}
        <Link to={secondaryCta.to} className="dash-coming-btn">
          {secondaryCta.label}
        </Link>
      </div>
    </div>
  );
}
