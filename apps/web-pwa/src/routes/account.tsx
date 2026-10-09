import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
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
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-lg px-4 py-10">
        <h1 className="font-display text-2xl font-bold tracking-tight">Compte</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          SaaS : inscription et connexion. Les projets cloud sont liés à votre{" "}
          <span className="font-mono">accountId</span>.
        </p>

        {authed && account ? (
          <section className="mt-8 space-y-4 rounded-lg border border-border bg-panel p-4">
            <p className="font-mono text-[10px] uppercase text-muted-foreground">Connecté</p>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Email</dt>
                <dd>{account.email}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Account ID</dt>
                <dd className="font-mono text-xs">{account.accountId}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Plan</dt>
                <dd>
                  {activePlan.name}
                  {trialDaysLeft > 0 ? ` · essai ${trialDaysLeft} j` : ""}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Sync cloud</dt>
                <dd>{cloudSyncAllowed ? "Autorisée" : "Locale uniquement"}</dd>
              </div>
            </dl>
            <label className="block text-xs text-muted-foreground">
              Nom affiché
              <input
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void onSaveProfile()}
                className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"
              >
                Enregistrer le profil
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onLogout()}
                className="rounded-md border border-border px-3 py-2 text-xs hover:bg-secondary disabled:opacity-40"
              >
                Se déconnecter
              </button>
              <Link
                to="/projects"
                className="rounded-md border border-border px-3 py-2 text-xs hover:bg-secondary"
              >
                Mes projets
              </Link>
            </div>
          </section>
        ) : (
          <section className="mt-8 space-y-4 rounded-lg border border-border bg-panel p-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`rounded px-3 py-1.5 text-xs ${mode === "login" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
              >
                Connexion
              </button>
              <button
                type="button"
                onClick={() => setMode("register")}
                className={`rounded px-3 py-1.5 text-xs ${mode === "register" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
              >
                Inscription
              </button>
            </div>
            {mode === "register" && (
              <label className="block text-xs text-muted-foreground">
                Nom
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                  autoComplete="name"
                />
              </label>
            )}
            <label className="block text-xs text-muted-foreground">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                autoComplete="email"
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              Mot de passe
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </label>
            <button
              type="button"
              disabled={busy || !email.trim() || password.length < 8}
              onClick={() => void onAuth()}
              className="w-full rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"
            >
              {busy ? "…" : mode === "login" ? "Se connecter" : "Créer mon compte"}
            </button>
            <p className="text-[10px] text-muted-foreground">
              Sans compte : mode démo local ({account?.email ?? "demo@hybridator.local"}). Mot de
              passe min. 8 caractères. Stockage serveur (mémoire ou SYNC_DATA_DIR).
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
