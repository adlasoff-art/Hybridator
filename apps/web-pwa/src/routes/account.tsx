import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CreatorOsLayout } from "@/components/dashboard/DashboardShell";
import { useProductConfig } from "@/config/ProductConfigProvider";
import { defaultProductConfig } from "@/config/product";
import {
  isAuthenticatedLocally,
  loginAccount,
  logoutAccount,
  registerAccount,
  updateAccountProfile,
} from "@/lib/account-session";

const name = defaultProductConfig.brand.name;

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: `Compte — ${name}` },
      {
        name: "description",
        content: "Inscription, connexion et profil utilisateur SaaS.",
      },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { account, activePlan, trialDaysLeft, cloudSyncAllowed, refreshAccount } =
    useProductConfig();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [profileName, setProfileName] = useState(account?.displayName ?? "");
  const authed = isAuthenticatedLocally() && account?.accountId !== "acc_local";

  const onAuth = async () => {
    setBusy(true);
    const result =
      mode === "login"
        ? await loginAccount({ email, password })
        : await registerAccount({
            email,
            password,
            ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
          });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setProfileName(result.session.displayName);
    await refreshAccount();
    toast.success(mode === "login" ? "Connecté." : "Compte créé.");
    setPassword("");
  };

  const onLogout = async () => {
    setBusy(true);
    await logoutAccount();
    await refreshAccount();
    setBusy(false);
    setProfileName("");
    toast.message("Déconnecté — mode démo local.");
  };

  const onSaveProfile = async () => {
    setBusy(true);
    const result = await updateAccountProfile({ displayName: profileName });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    await refreshAccount();
    toast.success("Profil mis à jour.");
  };

  return (
    <CreatorOsLayout>
      <div className="dash-page dash-page-narrow">
        <div className="dash-page-head">
          <div>
            <h1>Compte</h1>
            <p className="dash-page-lead">
              SaaS : inscription et connexion. Les projets cloud sont liés à votre accountId.
            </p>
          </div>
        </div>

        {authed && account ? (
          <section className="dash-card dash-card-pad" style={{ display: "grid", gap: "0.85rem" }}>
            <span className="dash-badge">Connecté</span>
            <dl style={{ display: "grid", gap: "0.45rem", margin: 0, fontSize: "0.85rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                <dt className="dash-muted">Email</dt>
                <dd style={{ margin: 0 }}>{account.email}</dd>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                <dt className="dash-muted">Account ID</dt>
                <dd
                  style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: "0.75rem" }}
                >
                  {account.accountId}
                </dd>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                <dt className="dash-muted">Plan</dt>
                <dd style={{ margin: 0 }}>
                  {activePlan.name}
                  {trialDaysLeft > 0 ? ` · essai ${trialDaysLeft} j` : ""}
                </dd>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                <dt className="dash-muted">Sync cloud</dt>
                <dd style={{ margin: 0 }}>
                  {cloudSyncAllowed ? "Autorisée" : "Locale uniquement"}
                </dd>
              </div>
            </dl>
            <label className="dash-label">
              Nom affiché
              <input
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="dash-input"
                style={{ marginTop: "0.35rem" }}
              />
            </label>
            <div className="dash-page-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => void onSaveProfile()}
                className="dash-btn dash-btn-primary"
              >
                Enregistrer le profil
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onLogout()}
                className="dash-btn"
              >
                Se déconnecter
              </button>
              <Link to="/projects" className="dash-btn">
                Mes projets
              </Link>
            </div>
          </section>
        ) : (
          <section className="dash-card dash-card-pad" style={{ display: "grid", gap: "0.85rem" }}>
            <div className="dash-page-actions">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`dash-btn${mode === "login" ? " dash-btn-primary" : ""}`}
              >
                Connexion
              </button>
              <button
                type="button"
                onClick={() => setMode("register")}
                className={`dash-btn${mode === "register" ? " dash-btn-primary" : ""}`}
              >
                Inscription
              </button>
            </div>
            {mode === "register" ? (
              <label className="dash-label">
                Nom
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="dash-input"
                  style={{ marginTop: "0.35rem" }}
                  autoComplete="name"
                />
              </label>
            ) : null}
            <label className="dash-label">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="dash-input"
                style={{ marginTop: "0.35rem" }}
                autoComplete="email"
              />
            </label>
            <label className="dash-label">
              Mot de passe
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="dash-input"
                style={{ marginTop: "0.35rem" }}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </label>
            <button
              type="button"
              disabled={busy || !email.trim() || password.length < 8}
              onClick={() => void onAuth()}
              className="dash-btn dash-btn-primary"
              style={{ width: "100%", justifyContent: "center" }}
            >
              {busy ? "…" : mode === "login" ? "Se connecter" : "Créer mon compte"}
            </button>
            <p className="dash-muted" style={{ margin: 0, fontSize: "0.68rem" }}>
              Sans compte : mode démo local ({account?.email ?? "demo@hybridator.local"}). Mot de
              passe min. 8 caractères.
            </p>
          </section>
        )}
      </div>
    </CreatorOsLayout>
  );
}
