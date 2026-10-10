import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Cloud,
  CloudOff,
  Download,
  Eye,
  EyeOff,
  Pause,
  Play,
  Redo2,
  Save,
  SkipBack,
  StepBack,
  StepForward,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { useProductConfig } from "@/config/ProductConfigProvider";
import { defaultProductConfig } from "@/config/product";
import {
  clipAt,
  cloneClipForClipboard,
  createDemoDoc,
  createEmptyNleDoc,
  createSyncAdapter,
  findClip,
  opsForDuplicateClip,
  opsForPasteClip,
  opsForSourceRanges,
  timelineDuration,
  webFileSystemAdapter,
  type Clip,
  type SourceRange,
} from "@/engine";
import { timecode } from "@/lib/timecode";
import { useEditor } from "@/components/editor/useEditor";
import { TimelinePanel, type TimelineTool } from "@/components/editor/TimelinePanel";
import { Inspector } from "@/components/editor/Inspector";
import { CREATIVE_TABS, LeftPanel, type CreativeTabId } from "@/components/editor/LeftPanel";
import { ExportDialog } from "@/components/editor/ExportDialog";
import { PreviewCanvas, type CanvasAspect } from "@/components/editor/PreviewCanvas";
import { OfflineBadge } from "@/components/OfflineBadge";
import { camClass } from "@/components/editor/colors";

const name = defaultProductConfig.brand.name;

const ASPECTS: CanvasAspect[] = ["16:9", "9:16", "1:1"];

export const Route = createFileRoute("/editor")({
  validateSearch: (s: Record<string, unknown>): { id?: string | undefined } =>
    typeof s["id"] === "string" ? { id: s["id"] } : {},
  head: () => ({
    meta: [
      { title: `Éditeur — ${name}` },
      {
        name: "description",
        content: "Éditeur vidéo multipiste — bibliothèque, timeline, export.",
      },
      { property: "og:title", content: `Éditeur — ${name}` },
      {
        property: "og:description",
        content: "Éditeur vidéo multipiste — bibliothèque, timeline, export.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Editor,
});

function Editor() {
  const { id } = Route.useSearch();
  const { config, activePlan, isFlagOn, watermark, cloudSyncAllowed, account } = useProductConfig();
  const editor = useEditor(createEmptyNleDoc({ name: "Sans titre" }));
  const { doc, apply, patchDoc } = editor;
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(40);
  const [selected, setSelected] = useState<string | null>(null);
  const [previewOnly, setPreviewOnly] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saved, setSaved] = useState(true);
  const [creativeTab, setCreativeTab] = useState<CreativeTabId>("media");
  const [aspect, setAspect] = useState<CanvasAspect>("16:9");
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [magneticEnabled, setMagneticEnabled] = useState(true);
  const [editTool, setEditTool] = useState<TimelineTool>("select");
  const clipboardRef = useRef<Clip | null>(null);
  const duration = timelineDuration(doc.timeline);
  const frameStep = 1 / Math.max(1, doc.settings.fps);

  const cloudAllowedRef = useRef(cloudSyncAllowed);
  cloudAllowedRef.current = cloudSyncAllowed;
  const accountIdRef = useRef(account?.accountId ?? "acc_local");
  accountIdRef.current = account?.accountId ?? "acc_local";

  const syncAdapter = useMemo(
    () =>
      createSyncAdapter(() => cloudAllowedRef.current, {
        accountId: () => accountIdRef.current,
      }),
    [],
  );

  useEffect(() => {
    if (!id) return;
    webFileSystemAdapter
      .readProject(id)
      .then(async (d) => {
        if (d) {
          editor.reset(d);
          return;
        }
        const remote = await syncAdapter.pullProject(id);
        if (remote) {
          await webFileSystemAdapter.writeProject(remote);
          editor.reset(remote);
          return;
        }
        toast.error("Projet introuvable sur cet appareil.");
      })
      .catch(() => toast.error("Lecture du projet impossible."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSaved(false);
  }, [doc]);

  useEffect(() => {
    if (time > duration) setTime(duration);
  }, [duration, time]);

  const removeSource = useCallback(
    (ranges: SourceRange[]) => {
      const ops = opsForSourceRanges(doc, ranges);
      if (ops.length) apply(ops);
    },
    [doc, apply],
  );

  const save = useCallback(async () => {
    const toSave = id
      ? doc
      : {
          ...doc,
          id: crypto.randomUUID(),
          settings: { ...doc.settings, name: `${doc.settings.name} (copie)` },
        };
    try {
      await webFileSystemAdapter.writeProject(toSave);
      setSaved(true);
      if (cloudAllowedRef.current) {
        const pushed = await syncAdapter.pushProject(toSave);
        if (pushed.ok) {
          toast.success(
            id ? "Projet enregistré (local + cloud)" : "Copie enregistrée (local + cloud)",
          );
        } else {
          toast.success(
            id
              ? `Projet local OK — cloud : ${pushed.error}`
              : `Copie locale OK — cloud : ${pushed.error}`,
          );
        }
      } else {
        toast.success(
          id ? "Projet enregistré sur cet appareil" : "Copie enregistrée dans vos projets",
        );
      }
    } catch {
      toast.error("Enregistrement impossible. Vos modifications restent ouvertes.");
    }
  }, [doc, id, syncAdapter]);

  const angleAssets = doc.assets
    .filter((a) => a.angle !== undefined)
    .slice(0, activePlan.multicamAngles ?? undefined);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) editor.redo();
        else editor.undo();
      } else if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      } else if (mod && e.key.toLowerCase() === "d" && selected) {
        e.preventDefault();
        const ops = opsForDuplicateClip(doc, selected);
        if (ops.length) {
          apply(ops);
          if (ops[0]?.type === "ADD_CLIP") setSelected(ops[0].clip.id);
        }
      } else if (mod && e.key.toLowerCase() === "c" && selected) {
        e.preventDefault();
        const clip = findClip(doc.timeline, selected);
        if (clip) {
          clipboardRef.current = cloneClipForClipboard(clip);
          toast.message("Clip copié");
        }
      } else if (mod && e.key.toLowerCase() === "v" && clipboardRef.current) {
        e.preventDefault();
        const ops = opsForPasteClip(doc, clipboardRef.current, time);
        if (ops.length) {
          apply(ops);
          if (ops[0]?.type === "ADD_CLIP") setSelected(ops[0].clip.id);
        }
      } else if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key.toLowerCase() === "v" && !mod) {
        setEditTool("select");
      } else if (e.key.toLowerCase() === "b" && !mod) {
        setEditTool("razor");
      } else if (e.key.toLowerCase() === "s" && selected) {
        apply([{ type: "SPLIT_CLIP", clipId: selected, position: time }]);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        e.preventDefault();
        apply([{ type: "DELETE_CLIP", clipId: selected, ripple: magneticEnabled }]);
        setSelected(null);
      } else if (/^[1-9]$/.test(e.key) && isFlagOn("enable_multicam_mixer")) {
        const a = angleAssets[Number(e.key) - 1];
        if (a) apply([{ type: "SWITCH_CAMERA_ANGLE", time, angleId: a.id }]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor, save, selected, time, apply, angleAssets, isFlagOn, magneticEnabled, doc]);

  const anglesTrack = doc.timeline.tracks.find((t) => t.role === "angles");
  const mainTrack = doc.timeline.tracks.find((t) => t.id === "v1");
  const activeVideoTrack = anglesTrack ?? mainTrack;
  const angleClip = activeVideoTrack ? clipAt(activeVideoTrack, time) : undefined;
  const angleAsset = doc.assets.find((a) => a.id === angleClip?.assetId);
  const brollTrack = doc.timeline.tracks.find((t) => t.role === "broll" || t.id === "v2");
  const broll = brollTrack ? clipAt(brollTrack, time) : undefined;
  const caption = doc.timeline.tracks.find((t) => t.role === "captions" || t.id === "t1");
  const captionClip = caption ? clipAt(caption, time) : undefined;
  const sync = syncAdapter.status();
  const t = angleClip?.transform;

  const loadDemo = () => {
    editor.reset(createDemoDoc(config.transcript));
    setSelected(null);
    setTime(0);
    toast.message("Projet démo podcast chargé.");
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-panel px-2">
        <Link
          to="/projects"
          className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Projets"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="max-w-[10rem] truncate font-mono text-xs font-semibold sm:max-w-[16rem]">
          {doc.settings.name}
        </span>
        <span
          className="hidden items-center gap-1 rounded border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex"
          title="État de synchronisation"
        >
          {sync === "synced" ? (
            <Cloud className="h-3 w-3 text-accent" />
          ) : (
            <CloudOff className="h-3 w-3" />
          )}
          {cloudSyncAllowed ? "Cloud" : "Local"}
          {!saved && <span className="text-warning">·</span>}
        </span>

        <nav className="ml-2 hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto lg:flex">
          {CREATIVE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCreativeTab(tab.id)}
              className={`shrink-0 rounded px-2 py-1 text-[11px] ${
                creativeTab === tab.id
                  ? "bg-primary/15 font-semibold text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={editor.undo}
            disabled={!editor.canUndo}
            className="rounded p-1.5 hover:bg-secondary disabled:opacity-30"
            aria-label="Annuler"
            title="Annuler (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={editor.redo}
            disabled={!editor.canRedo}
            className="rounded p-1.5 hover:bg-secondary disabled:opacity-30"
            aria-label="Rétablir"
            title="Rétablir (Ctrl+Maj+Z)"
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <select
            value={aspect}
            onChange={(e) => setAspect(e.target.value as CanvasAspect)}
            className="ml-1 rounded border border-border bg-background px-1.5 py-1 font-mono text-[10px]"
            title="Format / ratio"
            aria-label="Format"
          >
            {ASPECTS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <OfflineBadge />
          <button
            type="button"
            onClick={() => setPreviewOnly((p) => !p)}
            className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-secondary"
          >
            {previewOnly ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}{" "}
            Aperçu
          </button>
          <button
            type="button"
            onClick={save}
            className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-secondary"
          >
            <Save className="h-3.5 w-3.5" /> Enregistrer
          </button>
          <button
            type="button"
            onClick={() => setExporting(true)}
            className="inline-flex items-center gap-1 rounded bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Download className="h-3.5 w-3.5" /> Exporter
          </button>
        </div>
      </header>

      {/* Mobile creative tabs */}
      <div className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-border bg-panel px-2 py-1 lg:hidden">
        {CREATIVE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setCreativeTab(tab.id)}
            className={`shrink-0 rounded px-2 py-1 text-[10px] ${
              creativeTab === tab.id
                ? "bg-primary/15 font-semibold text-primary"
                : "text-muted-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        className={`grid min-h-0 flex-1 ${previewOnly ? "grid-cols-1 grid-rows-[1fr]" : "grid-cols-[18rem_minmax(24rem,1fr)_15rem] grid-rows-[minmax(0,1fr)_15rem]"}`}
      >
        {!previewOnly && (
          <aside className="row-span-2 min-h-0 border-r border-border bg-panel">
            <LeftPanel
              doc={doc}
              time={time}
              tab={creativeTab}
              selectedClipId={selected}
              apply={apply}
              patchDoc={patchDoc}
              removeSource={removeSource}
              onSeek={setTime}
              onLoadDemo={loadDemo}
            />
          </aside>
        )}

        <section className="flex min-h-0 min-w-0 flex-col bg-background p-3">
          <div
            className={`relative min-h-0 w-full flex-1 overflow-hidden rounded border border-border ${camClass(angleAsset)} ${playing ? "tally" : ""}`}
          >
            <PreviewCanvas
              doc={doc}
              time={time}
              playing={playing}
              duration={duration}
              aspect={aspect}
              watermark={watermark}
              brandName={config.brand.name}
              onTime={setTime}
              onPlayingChange={setPlaying}
              overlay={
                <>
                  {broll && (
                    <div className="absolute right-3 top-3 flex h-1/3 w-1/3 items-center justify-center rounded border border-foreground/30 bg-track-broll font-mono text-[10px]">
                      V2
                    </div>
                  )}
                  {captionClip?.label && (
                    <p className="absolute inset-x-6 bottom-4 text-center text-sm font-semibold">
                      <span className="rounded bg-background/80 px-2 py-0.5">
                        {captionClip.label}
                      </span>
                    </p>
                  )}
                  {angleAsset && (
                    <span className="absolute left-2 bottom-2 rounded border border-foreground/10 bg-background/80 px-1.5 py-0.5 font-mono text-[10px]">
                      {angleAsset.name}
                    </span>
                  )}
                  {t && (
                    <span
                      className="pointer-events-none absolute inset-0"
                      style={{
                        transform: `translate(${t.x / 10}px, ${t.y / 10}px) scale(${t.scale}) rotate(${t.rotation}deg)`,
                        opacity: t.opacity,
                      }}
                    />
                  )}
                </>
              }
            />
          </div>
          <div className="relative flex h-12 shrink-0 items-center justify-center gap-3 border-x border-b border-border bg-panel px-3">
            <button
              type="button"
              onClick={() => setTime(0)}
              className="rounded p-1.5 hover:bg-secondary"
              aria-label="Début"
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setTime((t0) => Math.max(0, t0 - frameStep))}
              className="rounded p-1.5 hover:bg-secondary"
              aria-label="Image précédente"
            >
              <StepBack className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="rounded-full bg-foreground p-2 text-background hover:bg-foreground/90"
              aria-label={playing ? "Pause" : "Lecture"}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setTime((t0) => Math.min(duration, t0 + frameStep))}
              className="rounded p-1.5 hover:bg-secondary"
              aria-label="Image suivante"
            >
              <StepForward className="h-4 w-4" />
            </button>
            <span className="absolute left-3 rounded bg-background px-2 py-1 font-mono text-[11px] tabular-nums">
              <span className="text-foreground">{timecode(time, doc.settings.fps)}</span>
              <span className="text-muted-foreground">
                {" "}
                / {timecode(duration, doc.settings.fps)}
              </span>
            </span>
          </div>
        </section>

        {!previewOnly && (
          <>
            <aside className="min-h-0 overflow-y-auto border-l border-border bg-panel">
              <Inspector doc={doc} clipId={selected} time={time} apply={apply} />
            </aside>
            <div className="col-span-2 min-h-0 border-t border-border">
              <TimelinePanel
                doc={doc}
                time={time}
                zoom={zoom}
                setZoom={setZoom}
                selectedClipId={selected}
                onSelect={setSelected}
                onSeek={setTime}
                apply={apply}
                snapEnabled={snapEnabled}
                setSnapEnabled={setSnapEnabled}
                magneticEnabled={magneticEnabled}
                setMagneticEnabled={setMagneticEnabled}
                tool={editTool}
                setTool={setEditTool}
                onCopyClip={(id) => {
                  const clip = findClip(doc.timeline, id);
                  if (clip) {
                    clipboardRef.current = cloneClipForClipboard(clip);
                    toast.message("Clip copié");
                  }
                }}
              />
            </div>
          </>
        )}
      </div>

      {exporting && <ExportDialog doc={doc} onClose={() => setExporting(false)} />}
    </div>
  );
}
