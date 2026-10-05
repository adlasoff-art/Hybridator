import { createFileRoute, Link } from "@tanstack/react-router";
import { AudioWaveform, Captions, FileArchive, Layers, MonitorSmartphone, Scissors } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { useProductConfig } from "@/config/ProductConfigProvider";
import { defaultProductConfig } from "@/config/product";

const b = defaultProductConfig.brand;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${b.name} — Montage podcast multi-caméras augmenté par IA` },
      { name: "description", content: b.description },
      { property: "og:title", content: `${b.name} — Montage podcast multi-caméras augmenté par IA` },
      { property: "og:description", content: b.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { config } = useProductConfig();
  const features = [
    { icon: Scissors, title: "Montage par le texte", text: "Supprimez un mot dans le transcript : la coupe se fait sur toutes les pistes, sans jamais toucher vos rushs." },
    { icon: Layers, title: "Multi-caméras", text: "Changez d'angle au clavier, laissez l'IA suivre la personne qui parle." },
    { icon: AudioWaveform, title: "Pistes micro isolées", text: "Un micro par intervenant, mixage et export des pistes séparées." },
    { icon: Captions, title: "Nettoyage IA", text: "Hésitations, silences et répétitions repérés et retirés en un clic." },
    { icon: FileArchive, title: `Projets .${config.brand.projectExtension} portables`, text: "Un format unique pour passer du Mac au PC, au navigateur ou à la tablette." },
    { icon: MonitorSmartphone, title: "Bureau, web et mobile", text: "Installez l'application et travaillez même hors ligne." },
  ];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="scanlines border-b border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 md:grid-cols-[1.2fr_1fr] md:items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary">● REC — Studio non destructif</p>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight md:text-6xl">{config.brand.tagline}</h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">{config.brand.description}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/editor" className="rounded-md bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:bg-primary/90">
                Ouvrir l'éditeur démo
              </Link>
              <Link to="/pricing" className="rounded-md border border-border px-5 py-2.5 font-semibold hover:bg-secondary">
                Essai gratuit {config.trial.days} jours
              </Link>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-panel p-3 shadow-2xl">
            <div className="grid grid-cols-3 gap-2">
              {["bg-cam-1", "bg-cam-2", "bg-cam-3"].map((c, i) => (
                <div key={c} className={`${c} ${i === 1 ? "tally" : ""} flex aspect-video items-end rounded p-1.5 font-mono text-[10px]`}>
                  CAM {i + 1}
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1.5">
              {["bg-track-video", "bg-track-audio", "bg-track-audio", "bg-track-caption"].map((c, i) => (
                <div key={i} className="flex h-5 gap-1">
                  {[30, 18, 40, 12].map((w, j) => (
                    <div key={j} className={`${c} rounded-sm opacity-80`} style={{ width: `${w - i * 2}%` }} />
                  ))}
                </div>
              ))}
            </div>
            <p className="mt-3 font-mono text-xs text-muted-foreground">00:01:23:14 / 00:10:00:00</p>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="bg-background p-6">
              <f.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
