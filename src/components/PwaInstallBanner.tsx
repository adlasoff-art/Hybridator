import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { useProductConfig } from "@/config/ProductConfigProvider";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

const DISMISS_KEY = "pwa.bannerDismissed";

export function PwaInstallBanner() {
  const { config } = useProductConfig();
  const [visible, setVisible] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    if (standalone || window.localStorage.getItem(DISMISS_KEY) === "1") return;
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const t = window.setTimeout(() => setVisible(true), 2500);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  if (!visible) return null;
  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 w-[22rem] max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-card p-4 shadow-2xl">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md bg-primary/15 p-2 text-primary">
          <Download className="h-4 w-4" />
        </div>
        <div className="flex-1 text-sm">
          <p className="font-semibold">Installer {config.brand.name}</p>
          <p className="mt-1 text-muted-foreground">
            {deferred
              ? "Installez l'application pour l'ouvrir comme un logiciel et travailler hors ligne sur vos projets locaux."
              : isIos
                ? "Dans Safari, touchez Partager puis « Sur l'écran d'accueil »."
                : "Dans le menu du navigateur, choisissez « Installer l'application »."}
          </p>
          {deferred && (
            <button
              onClick={async () => {
                await deferred.prompt();
                dismiss();
              }}
              className="mt-3 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Installer
            </button>
          )}
        </div>
        <button onClick={dismiss} aria-label="Fermer" className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
