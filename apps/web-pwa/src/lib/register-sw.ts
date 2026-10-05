/** Enregistre le Service Worker pour l'installabilité et le mode hors ligne. */
export function registerServiceWorker(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[pwa] SW registration failed", err);
    });
  });
}
