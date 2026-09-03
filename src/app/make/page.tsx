"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  LayoutDashboard,
  Download,
  Check,
  Type,
  Palette,
  Image as ImageIcon,
  Sparkles,
  RotateCw,
  Maximize2,
  Sliders,
  Ratio,
  Film,
  Sun,
  Award,
  Crop,
  ZoomIn,
  X,
} from "lucide-react";

type PhotoItem = {
  id: string;
  url: string;
  original_filename: string;
  mime_type?: string;
  captured_at?: string;
  photo_metadata?: {
    ai_title?: string;
    city?: string;
    country?: string;
    ai_tags?: string[];
  };
};

type TemplateType =
  | "poster"
  | "magazine"
  | "cinematic"
  | "polaroid"
  | "grid"
  | "compare"
  | "contact";

type AspectRatioPreset = "4:5" | "9:16" | "16:9" | "1:1";

const THEMES = [
  { name: "Obsidian", bg: "#09090b", text: "#f4f4f5", accent: "#ffffff", border: "#27272a" },
  { name: "Warm Parchment", bg: "#1c1917", text: "#f5f5f4", accent: "#fbbf24", border: "#44403c" },
  { name: "Monochrome Film", bg: "#000000", text: "#ffffff", accent: "#a1a1aa", border: "#18181b" },
  { name: "Cyberpunk", bg: "#050814", text: "#e0f2fe", accent: "#38bdf8", border: "#0c4a6e" },
];

const TEMPLATES: { id: TemplateType; label: string; desc: string; category: string }[] = [
  { id: "poster", label: "Hero Poster", desc: "Singular powerful image with cinematic typography", category: "Editorial" },
  { id: "magazine", label: "Magazine Spread", desc: "Editorial layout with hero and supporting frames", category: "Editorial" },
  { id: "cinematic", label: "Cinematic 21:9", desc: "Letterboxed stills resembling a motion picture sequence", category: "Cinematic" },
  { id: "polaroid", label: "Instant Polaroid", desc: "Nostalgic white-bordered prints with custom notes", category: "Minimal" },
  { id: "grid", label: "Balanced Matrix", desc: "Harmonious grid of complementary photographs", category: "Memories" },
  { id: "compare", label: "Before / After", desc: "Dual split comparison frame for evolving perspectives", category: "Comparison" },
  { id: "contact", label: "Contact Sheet", desc: "Classic photographer proof sheet with archival frames", category: "Memories" },
];

const ARCHIVAL_BADGES = [
  "NONE",
  "35MM ARCHIVAL PROOF",
  "FUJIFILM COLOR SCIENCE",
  "PRANJAL CHRONICLES 2026",
  "LIMITED EDITION 1 OF 1",
  "AUTHENTIC METROPOLITAN",
];

interface PhotoAdjustment {
  cropFit?: "cover" | "contain";
  zoom: number;
  rotation: number;
  panX: number;
  panY: number;
  polaroidCaption?: string;
  filterPreset?: "none" | "vintage" | "bw" | "vibrant" | "cool";
}

export default function MakePage() {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhotos, setSelectedPhotos] = useState<PhotoItem[]>([]);
  const [template, setTemplate] = useState<TemplateType>("poster");
  const [aspectRatio, setAspectRatio] = useState<AspectRatioPreset>("4:5");
  const [mode, setMode] = useState<"template" | "freeform">("template");

  // Individual photo frame adjustments
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [photoAdjustments, setPhotoAdjustments] = useState<Record<string, PhotoAdjustment>>({});

  const getAdjustment = useCallback(
    (photoId: string): PhotoAdjustment => {
      return (
        photoAdjustments[photoId] || {
          cropFit: "cover",
          zoom: 1,
          rotation: 0,
          panX: 0,
          panY: 0,
          polaroidCaption: "",
          filterPreset: "none",
        }
      );
    },
    [photoAdjustments]
  );

  const updateActiveAdjustment = (patch: Partial<PhotoAdjustment>) => {
    if (!activePhotoId) return;
    setPhotoAdjustments((prev) => ({
      ...prev,
      [activePhotoId]: {
        ...getAdjustment(activePhotoId),
        ...patch,
      },
    }));
  };

  // Freeform layer controls
  const [layerRotation, setLayerRotation] = useState<number>(0);
  const [layerScale, setLayerScale] = useState<number>(1);

  // Drag state for touch panning
  const [dragStart, setDragStart] = useState<{ id: string, startX: number, startY: number, startPanX: number, startPanY: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent, photoId: string) => {
    e.stopPropagation();
    setActivePhotoId(photoId);
    const adj = getAdjustment(photoId);
    setDragStart({
      id: photoId,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: adj.panX,
      startPanY: adj.panY,
    });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent, photoId: string) => {
    if (dragStart && dragStart.id === photoId) {
      e.preventDefault();
      const dx = e.clientX - dragStart.startX;
      const dy = e.clientY - dragStart.startY;
      updateActiveAdjustment({ panX: dragStart.startPanX + dx, panY: dragStart.startPanY + dy });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setDragStart(null);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // Customization Options
  const [customTitle, setCustomTitle] = useState("A Moment in Time");
  const [customSubtitle, setCustomSubtitle] = useState(
    new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })
  );
  const [selectedTheme, setSelectedTheme] = useState(THEMES[0]);
  const [borderSpacing, setBorderSpacing] = useState(16);

  // Analogue Darkroom Optics & Typography
  const [filmGrain, setFilmGrain] = useState(false);
  const [vignette, setVignette] = useState(false);
  const [lightLeak, setLightLeak] = useState(false);
  const [fontFamily, setFontFamily] = useState<"serif" | "sans" | "mono">("serif");
  const [archivalBadge, setArchivalBadge] = useState<string>("35MM ARCHIVAL PROOF");

  // AI Assistant State
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiRationale, setAiRationale] = useState<string | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/photos")
      .then((res) => res.json())
      .then((data) => {
        if (data.photos) {
          const valid = data.photos.filter(
            (p: PhotoItem) => p.url && (!p.mime_type || p.mime_type.startsWith("image/"))
          );
          setPhotos(valid);
          if (valid.length > 0) {
            setSelectedPhotos(valid.slice(0, 3));
          }
        }
        setLoading(false);
      });
  }, []);

  const toggleSelect = (photo: PhotoItem) => {
    setSelectedPhotos((prev) => {
      const exists = prev.some((p) => p.id === photo.id);
      if (exists) return prev.filter((p) => p.id !== photo.id);
      if (prev.length >= 6) return prev;
      return [...prev, photo];
    });
  };

  // AI Assistant Query
  const handleAskAI = async (promptOverride?: string) => {
    const query = promptOverride || aiPrompt;
    if (!query.trim() || photos.length === 0) return;

    setAiGenerating(true);
    setAiRationale(null);

    try {
      const res = await fetch("/api/ai/studio-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: query,
          photos: photos.map((p) => ({
            id: p.id,
            original_filename: p.original_filename,
            ai_title: p.photo_metadata?.ai_title,
            city: p.photo_metadata?.city,
            country: p.photo_metadata?.country,
            tags: p.photo_metadata?.ai_tags,
            captured_at: p.captured_at,
          })),
        }),
      });

      if (!res.ok) throw new Error("AI Assistant failed to generate layout");
      const data = await res.json();

      if (Array.isArray(data.selectedPhotoIds) && data.selectedPhotoIds.length > 0) {
        const matching = photos.filter((p) => data.selectedPhotoIds.includes(p.id));
        if (matching.length > 0) setSelectedPhotos(matching);
      }

      if (data.template) setTemplate(data.template as TemplateType);
      if (data.themeName) {
        const foundTheme = THEMES.find((t) => t.name.toLowerCase() === data.themeName.toLowerCase());
        if (foundTheme) setSelectedTheme(foundTheme);
      }
      if (data.title) setCustomTitle(data.title);
      if (data.subtitle) setCustomSubtitle(data.subtitle);
      if (typeof data.borderSpacing === "number") setBorderSpacing(data.borderSpacing);
      if (data.rationale) setAiRationale(data.rationale);
    } catch (err) {
      console.warn("AI Assistant error:", err);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleDownload = useCallback(async () => {
    if (selectedPhotos.length === 0) return;
    setIsExporting(true);
    setExportSuccess(false);

    try {
      const canvas = document.createElement("canvas");

      // Dimensions based on Aspect Ratio Preset
      let CANVAS_W = 1600;
      let CANVAS_H = 2000;
      if (aspectRatio === "9:16") {
        CANVAS_W = 1125;
        CANVAS_H = 2000;
      } else if (aspectRatio === "16:9") {
        CANVAS_W = 1920;
        CANVAS_H = 1080;
      } else if (aspectRatio === "1:1") {
        CANVAS_W = 1600;
        CANVAS_H = 1600;
      }

      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context unavailable");

      // Draw Theme Background
      ctx.fillStyle = selectedTheme.bg;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Load Images safely
      const loadedImages = await Promise.all(
        selectedPhotos.map(
          (p) =>
            new Promise<HTMLImageElement>((resolve) => {
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.onload = () => resolve(img);
              img.onerror = () => {
                const dummy = document.createElement("canvas");
                dummy.width = 600;
                dummy.height = 600;
                const dCtx = dummy.getContext("2d");
                if (dCtx) {
                  dCtx.fillStyle = "#27272a";
                  dCtx.fillRect(0, 0, 600, 600);
                }
                const fallbackImg = new Image();
                fallbackImg.src = dummy.toDataURL();
                fallbackImg.onload = () => resolve(fallbackImg);
              };
              img.src = p.url;
            })
        )
      );

      // Archival Badge Stamp
      const headerTop = Math.round(CANVAS_H * 0.05);
      if (archivalBadge !== "NONE") {
        ctx.fillStyle = selectedTheme.accent;
        ctx.font = `600 ${Math.round(CANVAS_W * 0.011)}px monospace`;
        ctx.fillText(`• ${archivalBadge}`, CANVAS_W * 0.06, headerTop + 12);
      }

      // Header Typography with Selected Font Family
      const fontName =
        fontFamily === "serif"
          ? "Georgia, serif"
          : fontFamily === "mono"
          ? "monospace"
          : "system-ui, -apple-system, sans-serif";

      ctx.fillStyle = selectedTheme.text;
      ctx.font = `300 ${Math.round(CANVAS_W * 0.038)}px ${fontName}`;
      ctx.fillText(customTitle.toUpperCase(), CANVAS_W * 0.06, headerTop + 45);

      ctx.fillStyle = selectedTheme.accent;
      ctx.font = `500 ${Math.round(CANVAS_W * 0.016)}px monospace`;
      ctx.fillText(customSubtitle.toUpperCase(), CANVAS_W * 0.06, headerTop + 80);

      // Divider Line
      ctx.strokeStyle = selectedTheme.border;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(CANVAS_W * 0.06, headerTop + 100);
      ctx.lineTo(CANVAS_W * 0.94, headerTop + 100);
      ctx.stroke();

      // Media Stage Bounds
      const stageTop = headerTop + 120;
      const stageLeft = CANVAS_W * 0.06;
      const stageWidth = CANVAS_W * 0.88;
      const stageHeight = CANVAS_H - stageTop - CANVAS_H * 0.06;

      const gap = borderSpacing * 2;

      // Render Layout
      if (mode === "freeform") {
        // Freeform canvas composition with rotation & scale
        const count = loadedImages.length;
        loadedImages.forEach((img, idx) => {
          ctx.save();
          const cx = stageLeft + (stageWidth / (count + 1)) * (idx + 1);
          const cy = stageTop + stageHeight / 2;
          ctx.translate(cx, cy);
          ctx.rotate(((layerRotation + idx * 5) * Math.PI) / 180);
          ctx.scale(layerScale, layerScale);

          const w = Math.min(stageWidth * 0.6, 500);
          const h = (w * img.naturalHeight) / img.naturalWidth;
          ctx.drawImage(img, -w / 2, -h / 2, w, h);

          // Subtle frame
          ctx.strokeStyle = "rgba(255,255,255,0.2)";
          ctx.lineWidth = 3;
          ctx.strokeRect(-w / 2, -h / 2, w, h);
          ctx.restore();
        });
      } else if (template === "poster" || loadedImages.length === 1) {
        const img = loadedImages[0];
        ctx.drawImage(img, stageLeft, stageTop, stageWidth, stageHeight);
      } else if (template === "polaroid") {
        const cols = Math.min(2, loadedImages.length);
        const cellW = (stageWidth - gap) / cols;
        const cellH = (stageHeight - gap) / 2;

        loadedImages.slice(0, 4).forEach((img, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = stageLeft + col * (cellW + gap);
          const y = stageTop + row * (cellH + gap);

          ctx.fillStyle = "#ffffff";
          ctx.fillRect(x, y, cellW, cellH);

          const pad = 16;
          const photoH = cellH - 60;
          ctx.drawImage(img, x + pad, y + pad, cellW - pad * 2, photoH);

          ctx.fillStyle = "#18181b";
          ctx.font = "italic 16px serif";
          ctx.fillText(`Archive Memory #${i + 1}`, x + pad, y + cellH - 22);
        });
      } else if (template === "cinematic") {
        const cellH = (stageHeight - gap * (loadedImages.length - 1)) / loadedImages.length;
        loadedImages.forEach((img, i) => {
          const y = stageTop + i * (cellH + gap);
          ctx.drawImage(img, stageLeft, y, stageWidth, cellH);
        });
      } else if (template === "compare") {
        const cellW = (stageWidth - gap) / 2;
        ctx.drawImage(loadedImages[0], stageLeft, stageTop, cellW, stageHeight);
        ctx.drawImage(loadedImages[1] || loadedImages[0], stageLeft + cellW + gap, stageTop, cellW, stageHeight);

        // Labels
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(stageLeft + 16, stageTop + 16, 40, 24);
        ctx.fillRect(stageLeft + cellW + gap + 16, stageTop + 16, 40, 24);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px monospace";
        ctx.fillText("I", stageLeft + 30, stageTop + 33);
        ctx.fillText("II", stageLeft + cellW + gap + 28, stageTop + 33);
      } else {
        // Grid & Magazine
        const cols = 2;
        const rows = Math.ceil(loadedImages.length / cols);
        const cellW = (stageWidth - gap) / cols;
        const cellH = (stageHeight - gap * (rows - 1)) / rows;

        loadedImages.forEach((img, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = stageLeft + col * (cellW + gap);
          const y = stageTop + row * (cellH + gap);
          ctx.drawImage(img, x, y, cellW, cellH);
        });
      }

      // ── DARKROOM OPTICS ON EXPORTED CANVAS ──
      // 1. Lens Vignette
      if (vignette) {
        const radGrad = ctx.createRadialGradient(
          CANVAS_W / 2,
          CANVAS_H / 2,
          CANVAS_W * 0.3,
          CANVAS_W / 2,
          CANVAS_H / 2,
          CANVAS_W * 0.8
        );
        radGrad.addColorStop(0, "rgba(0,0,0,0)");
        radGrad.addColorStop(1, "rgba(0,0,0,0.65)");
        ctx.fillStyle = radGrad;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      }

      // 2. Light Leak Prism
      if (lightLeak) {
        const leakGrad = ctx.createRadialGradient(
          CANVAS_W,
          0,
          0,
          CANVAS_W,
          0,
          CANVAS_W * 0.75
        );
        leakGrad.addColorStop(0, "rgba(245, 158, 11, 0.28)");
        leakGrad.addColorStop(0.4, "rgba(244, 63, 94, 0.18)");
        leakGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = leakGrad;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      }

      // 3. 35mm Analogue Grain Simulation
      if (filmGrain) {
        try {
          const imgData = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
          const data = imgData.data;
          for (let i = 0; i < data.length; i += 16) {
            const noise = (Math.random() - 0.5) * 16;
            data[i] = Math.min(255, Math.max(0, data[i] + noise));
            data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
            data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
          }
          ctx.putImageData(imgData, 0, 0);
        } catch {
          // Cross-origin image fallback
        }
      }

      // Trigger Instant High-Res PNG Download
      const link = document.createElement("a");
      link.download = `pranjal_universe_${template}_${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png", 1.0);
      link.click();

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 4000);
    } catch (err) {
      console.error("Studio export failed:", err);
      alert("Failed to render high-resolution canvas. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }, [
    selectedPhotos,
    selectedTheme,
    customTitle,
    customSubtitle,
    template,
    borderSpacing,
    aspectRatio,
    mode,
    layerRotation,
    layerScale,
    filmGrain,
    vignette,
    lightLeak,
    fontFamily,
    archivalBadge,
  ]);

  return (
    <main className="min-h-screen max-w-7xl mx-auto px-4 md:px-10 py-8 pb-36 md:pb-24">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 pb-6 border-b border-white/5">
        <div>
          <p className="text-[10px] tracking-[0.35em] text-muted-foreground uppercase mb-2">
            Creative Generation
          </p>
          <h1 className="text-3xl font-extralight tracking-[0.12em] uppercase flex items-center gap-3">
            <LayoutDashboard className="w-7 h-7 text-primary" />
            Creative Studio
          </h1>
          <p className="text-muted-foreground text-sm mt-1.5">
            Compose fine-art posters, editorial collages, and cinematic prints from your authentic archive.
          </p>
        </div>

        {/* Export & Mode Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center bg-white/5 p-1 rounded-2xl border border-white/10">
            <button
              onClick={() => setMode("template")}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                mode === "template"
                  ? "bg-white text-zinc-950 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Templates
            </button>
            <button
              onClick={() => setMode("freeform")}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                mode === "freeform"
                  ? "bg-white text-zinc-950 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Freeform Canvas
            </button>
          </div>

          {/* Export Button */}
          <button
            onClick={handleDownload}
            disabled={isExporting || selectedPhotos.length === 0}
            className="flex items-center space-x-2 px-5 py-2 rounded-2xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : exportSuccess ? (
              <Check className="w-4 h-4 text-emerald-300" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{isExporting ? "Rendering 2K..." : exportSuccess ? "Exported!" : "Export 2K PNG"}</span>
          </button>
        </div>
      </header>

      {/* ── AI Creative Assistant Bar ──────────────────────────── */}
      <section className="mb-8 p-4 rounded-3xl bg-zinc-900/50 border border-white/10 backdrop-blur-md animate-fade-up">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center space-x-2 text-primary pl-2">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span className="text-xs font-medium tracking-wider uppercase font-mono">Ask AI to Create:</span>
          </div>

          <div className="flex-1 flex items-center bg-black/40 rounded-2xl border border-white/10 px-3 py-1.5">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g. 'Make a cinematic night poster from Tokyo', 'Minimalist black and white memory', 'Polaroid trio'..."
              className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 w-full outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAskAI();
              }}
            />
          </div>

          <button
            onClick={() => handleAskAI()}
            disabled={aiGenerating || !aiPrompt.trim()}
            className="px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-foreground text-xs font-medium transition-all flex items-center justify-center space-x-1.5 shrink-0 border border-white/10 disabled:opacity-40"
          >
            {aiGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>{aiGenerating ? "Reasoning..." : "Generate Layout"}</span>
          </button>
        </div>

        {/* Suggested Quick Prompt Chips */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-white/5 pl-2">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest mr-1">Inspirations:</span>
          {[
            "Cinematic 21:9 night collection",
            "Minimalist polaroid memory",
            "Editorial Tokyo chronicles",
            "Before & after perspective split",
          ].map((chip) => (
            <button
              key={chip}
              onClick={() => {
                setAiPrompt(chip);
                handleAskAI(chip);
              }}
              className="px-2.5 py-0.5 rounded-full bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground text-[10px] font-mono border border-white/5 transition-colors"
            >
              {chip}
            </button>
          ))}
        </div>

        {aiRationale && (
          <p className="text-[11px] text-primary/80 font-mono mt-2 pl-2 border-l-2 border-primary/40">
            {aiRationale}
          </p>
        )}
      </section>

      {/* ── Studio Workspace Layout ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ── LEFT: Tooling & Controls ─────────────────────────── */}
        <div className="lg:col-span-4 flex flex-col space-y-6">
          {/* Aspect Ratio Selector */}
          <div className="p-5 bg-zinc-900/40 border border-white/5 rounded-3xl space-y-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest flex items-center space-x-1.5">
              <Ratio className="w-3.5 h-3.5 text-primary" />
              <span>Canvas Aspect Ratio</span>
            </span>
            <div className="grid grid-cols-4 gap-2">
              {(["4:5", "9:16", "16:9", "1:1"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setAspectRatio(r)}
                  className={`py-2 rounded-xl text-xs font-mono font-medium border transition-all ${
                    aspectRatio === r
                      ? "bg-white text-zinc-950 border-white font-bold shadow-sm"
                      : "bg-white/5 border-white/5 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Templates Library */}
          {mode === "template" && (
            <div className="p-5 bg-zinc-900/40 border border-white/5 rounded-3xl space-y-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest flex items-center space-x-1.5">
                <LayoutDashboard className="w-3.5 h-3.5 text-primary" />
                <span>Layout Template</span>
              </span>

              <div className="grid grid-cols-1 gap-2">
                {TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    onClick={() => setTemplate(tmpl.id)}
                    className={`p-3 rounded-2xl text-left border transition-all flex flex-col ${
                      template === tmpl.id
                        ? "bg-white/10 border-primary/50 text-foreground"
                        : "bg-white/5 border-white/5 text-muted-foreground hover:text-foreground hover:bg-white/[0.08]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">{tmpl.label}</span>
                      <span className="text-[9px] uppercase font-mono px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground">
                        {tmpl.category}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-0.5">{tmpl.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Freeform Canvas Tools */}
          {mode === "freeform" && (
            <div className="p-5 bg-zinc-900/40 border border-white/5 rounded-3xl space-y-4">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest flex items-center space-x-1.5">
                <Sliders className="w-3.5 h-3.5 text-primary" />
                <span>Freeform Layer Tools</span>
              </span>

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <RotateCw className="w-3 h-3" />
                    <span>Rotation</span>
                  </span>
                  <span className="font-mono">{layerRotation}deg</span>
                </div>
                <input
                  type="range"
                  min="-45"
                  max="45"
                  value={layerRotation}
                  onChange={(e) => setLayerRotation(Number(e.target.value))}
                  className="w-full accent-primary h-1.5 bg-white/10 rounded-lg cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Maximize2 className="w-3 h-3" />
                    <span>Scale</span>
                  </span>
                  <span className="font-mono">{layerScale.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  value={layerScale}
                  onChange={(e) => setLayerScale(Number(e.target.value))}
                  className="w-full accent-primary h-1.5 bg-white/10 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Typography Customization */}
          <div className="p-5 bg-zinc-900/40 border border-white/5 rounded-3xl space-y-4">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest flex items-center space-x-1.5">
              <Type className="w-3.5 h-3.5 text-primary" />
              <span>Typography & Titles</span>
            </span>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                  Headline
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-foreground outline-none focus:border-primary/50"
                  placeholder="Headline..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                  Subtitle / Subtext
                </label>
                <input
                  type="text"
                  value={customSubtitle}
                  onChange={(e) => setCustomSubtitle(e.target.value)}
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-foreground outline-none focus:border-primary/50"
                  placeholder="Subtitle or location..."
                />
              </div>
            </div>
          </div>

          {/* Theme & Border Gap */}
          <div className="p-5 bg-zinc-900/40 border border-white/5 rounded-3xl space-y-4">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest flex items-center space-x-1.5">
              <Palette className="w-3.5 h-3.5 text-primary" />
              <span>Color Palette & Styling</span>
            </span>

            <div className="grid grid-cols-2 gap-2">
              {THEMES.map((th) => (
                <button
                  key={th.name}
                  onClick={() => setSelectedTheme(th)}
                  className={`p-2.5 rounded-xl border text-xs flex items-center space-x-2 transition-all ${
                    selectedTheme.name === th.name
                      ? "border-primary bg-white/10 text-foreground"
                      : "border-white/5 bg-white/5 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full border border-white/20 shrink-0"
                    style={{ backgroundColor: th.accent }}
                  />
                  <span className="truncate">{th.name}</span>
                </button>
              ))}
            </div>

            <div className="space-y-1 pt-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Border Gap</span>
                <span className="font-mono">{borderSpacing}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="40"
                value={borderSpacing}
                onChange={(e) => setBorderSpacing(Number(e.target.value))}
                className="w-full accent-primary h-1.5 bg-white/10 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Typography Style & Archival Stamp */}
          <div className="p-5 bg-zinc-900/40 border border-white/5 rounded-3xl space-y-4">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest flex items-center space-x-1.5">
              <Award className="w-3.5 h-3.5 text-primary" />
              <span>Typeface & Archival Badge</span>
            </span>

            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "serif", label: "Serif", font: "font-serif" },
                  { id: "sans", label: "Sans", font: "font-sans" },
                  { id: "mono", label: "Mono", font: "font-mono" },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFontFamily(f.id as "serif" | "sans" | "mono")}
                    className={`py-2 px-2.5 rounded-xl border text-xs text-center transition-all ${
                      fontFamily === f.id
                        ? "bg-white/10 border-primary text-foreground"
                        : "bg-white/5 border-white/5 text-muted-foreground hover:text-foreground"
                    } ${f.font}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                  Archival Provenance Stamp
                </label>
                <select
                  value={archivalBadge}
                  onChange={(e) => setArchivalBadge(e.target.value)}
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-foreground outline-none focus:border-primary/50"
                >
                  {ARCHIVAL_BADGES.map((b) => (
                    <option key={b} value={b} className="bg-zinc-900 text-white">
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Darkroom Optics & Textures */}
          <div className="p-5 bg-zinc-900/40 border border-white/5 rounded-3xl space-y-4">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest flex items-center space-x-1.5">
              <Film className="w-3.5 h-3.5 text-primary" />
              <span>Darkroom Optics & Film Shaders</span>
            </span>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setFilmGrain(!filmGrain)}
                className={`p-2.5 rounded-2xl border text-xs flex flex-col items-center justify-center space-y-1 transition-all ${
                  filmGrain
                    ? "bg-primary/20 border-primary text-primary"
                    : "bg-white/5 border-white/5 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Film className="w-4 h-4" />
                <span className="text-[10px]">35mm Grain</span>
              </button>

              <button
                onClick={() => setVignette(!vignette)}
                className={`p-2.5 rounded-2xl border text-xs flex flex-col items-center justify-center space-y-1 transition-all ${
                  vignette
                    ? "bg-primary/20 border-primary text-primary"
                    : "bg-white/5 border-white/5 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sun className="w-4 h-4" />
                <span className="text-[10px]">Lens Vignette</span>
              </button>

              <button
                onClick={() => setLightLeak(!lightLeak)}
                className={`p-2.5 rounded-2xl border text-xs flex flex-col items-center justify-center space-y-1 transition-all ${
                  lightLeak
                    ? "bg-primary/20 border-primary text-primary"
                    : "bg-white/5 border-white/5 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span className="text-[10px]">Light Leak</span>
              </button>
            </div>
          </div>

          {/* Select Memories Strip */}
          <div className="p-5 bg-zinc-900/40 border border-white/5 rounded-3xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest flex items-center space-x-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-primary" />
                <span>Select Photos ({selectedPhotos.length}/6)</span>
              </span>
            </div>

            {loading ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" />
              </div>
            ) : photos.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No photos yet</p>
            ) : (
              <div className="flex overflow-x-auto gap-3 pb-2 snap-x scrollbar-thin scrollbar-thumb-white/10">
                {photos.map((p) => {
                  const isSelected = selectedPhotos.some((s) => s.id === p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => toggleSelect(p)}
                      className={`relative w-20 h-20 shrink-0 snap-start rounded-xl overflow-hidden cursor-pointer border transition-all ${
                        isSelected
                          ? "border-primary ring-2 ring-primary/40 scale-95"
                          : "border-white/10 opacity-60 hover:opacity-100"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt="" className="w-full h-full object-cover" draggable={false} />
                      {isSelected && (
                        <div className="absolute top-1 right-1 bg-primary text-primary-foreground p-0.5 rounded-full">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Live Canvas Preview ───────────────────────── */}
        <div className="lg:col-span-8 flex flex-col items-center justify-center">
          <div
            className={`w-full max-w-lg rounded-3xl p-8 border shadow-2xl flex flex-col transition-all overflow-hidden relative ${
              aspectRatio === "9:16"
                ? "aspect-[9/16] max-w-sm"
                : aspectRatio === "16:9"
                ? "aspect-[16/9] max-w-xl"
                : aspectRatio === "1:1"
                ? "aspect-square max-w-md"
                : "aspect-[4/5]"
            }`}
            style={{
              backgroundColor: selectedTheme.bg,
              borderColor: selectedTheme.border,
            }}
          >
            {/* Darkroom Optics Overlays */}
            {filmGrain && (
              <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:10px_10px] mix-blend-overlay z-20" />
            )}
            {vignette && (
              <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_90px_rgba(0,0,0,0.85)] z-20" />
            )}
            {lightLeak && (
              <div className="absolute top-0 right-0 w-3/4 h-3/4 pointer-events-none bg-gradient-to-bl from-amber-500/25 via-rose-500/15 to-transparent blur-2xl z-20" />
            )}

            {/* Header typography preview */}
            <div className="mb-6 space-y-1 relative z-10">
              {archivalBadge !== "NONE" && (
                <div
                  className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full border text-[9px] font-mono tracking-widest uppercase mb-2"
                  style={{
                    borderColor: `${selectedTheme.accent}50`,
                    color: selectedTheme.accent,
                    backgroundColor: `${selectedTheme.accent}15`,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: selectedTheme.accent }} />
                  <span>{archivalBadge}</span>
                </div>
              )}
              <h2
                className={`text-2xl md:text-3xl font-light truncate ${
                  fontFamily === "serif"
                    ? "font-serif tracking-normal"
                    : fontFamily === "mono"
                    ? "font-mono tracking-widest uppercase"
                    : "font-sans tracking-tight uppercase"
                }`}
                style={{ color: selectedTheme.text }}
              >
                {customTitle}
              </h2>
              <p
                className="text-[11px] font-medium tracking-[0.25em] uppercase"
                style={{ color: selectedTheme.accent }}
              >
                {customSubtitle}
              </p>
              <div
                className="h-0.5 w-full mt-3 opacity-60"
                style={{ backgroundColor: selectedTheme.border }}
              />
            </div>

            {/* Images stage preview */}
            <div className="flex-1 w-full overflow-hidden flex items-center justify-center relative" onClick={() => setActivePhotoId(null)}>
              {selectedPhotos.length === 0 ? (
                <div className="text-center space-y-2 text-muted-foreground/40">
                  <ImageIcon className="w-12 h-12 mx-auto stroke-1" />
                  <p className="text-xs">Pick photographs from the left panel to compose</p>
                </div>
              ) : mode === "freeform" ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  {selectedPhotos.map((p, idx) => {
                    const adj = getAdjustment(p.id);
                    const isFrameActive = (activePhotoId || selectedPhotos[0]?.id) === p.id;
                    const frameFilter =
                      adj.filterPreset === "bw"
                        ? "grayscale(100%) contrast(110%)"
                        : adj.filterPreset === "vintage"
                        ? "sepia(45%) contrast(95%) brightness(105%)"
                        : adj.filterPreset === "vibrant"
                        ? "saturate(140%) contrast(105%)"
                        : adj.filterPreset === "cool"
                        ? "hue-rotate(180deg) saturate(90%)"
                        : "none";

                    return (
                      <div
                        key={p.id}
                        onPointerDown={(e) => handlePointerDown(e, p.id)}
                        onPointerMove={(e) => handlePointerMove(e, p.id)}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        onClick={(e) => { e.stopPropagation(); setActivePhotoId(p.id); }}
                        className={`absolute rounded-xl overflow-hidden shadow-2xl border transition-all cursor-pointer ${
                          isFrameActive ? "ring-2 ring-primary border-primary" : "border-white/20"
                        }`}
                        style={{
                          width: "55%",
                          height: "55%",
                          transform: `rotate(${layerRotation + adj.rotation + idx * 6}deg) scale(${layerScale * adj.zoom}) translate(${adj.panX}px, ${adj.panY}px)`,
                          zIndex: isFrameActive ? 30 : idx + 1,
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.url}
                          alt=""
                          className="w-full h-full object-cover pointer-events-none"
                          style={{ filter: frameFilter }}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : template === "poster" || selectedPhotos.length === 1 ? (
                <div
                  onPointerDown={(e) => handlePointerDown(e, selectedPhotos[0].id)}
                        onPointerMove={(e) => handlePointerMove(e, selectedPhotos[0].id)}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        onClick={(e) => { e.stopPropagation(); setActivePhotoId(selectedPhotos[0].id); }}
                  className={`w-full h-full rounded-2xl overflow-hidden cursor-pointer transition-all ${
                    activePhotoId === selectedPhotos[0].id ? "ring-2 ring-primary" : ""
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedPhotos[0].url}
                    alt=""
                    className="w-full h-full object-cover transition-transform"
                    style={{
                      transform: `scale(${getAdjustment(selectedPhotos[0].id).zoom}) rotate(${getAdjustment(selectedPhotos[0].id).rotation}deg) translate(${getAdjustment(selectedPhotos[0].id).panX}px, ${getAdjustment(selectedPhotos[0].id).panY}px)`,
                      filter:
                        getAdjustment(selectedPhotos[0].id).filterPreset === "bw"
                          ? "grayscale(100%) contrast(110%)"
                          : getAdjustment(selectedPhotos[0].id).filterPreset === "vintage"
                          ? "sepia(45%) contrast(95%) brightness(105%)"
                          : getAdjustment(selectedPhotos[0].id).filterPreset === "vibrant"
                          ? "saturate(140%) contrast(105%)"
                          : getAdjustment(selectedPhotos[0].id).filterPreset === "cool"
                          ? "hue-rotate(180deg) saturate(90%)"
                          : "none",
                    }}
                  />
                </div>
              ) : template === "polaroid" ? (
                <div className="grid grid-cols-2 gap-3 w-full h-full p-2">
                  {selectedPhotos.slice(0, 4).map((p, i) => {
                    const adj = getAdjustment(p.id);
                    const isSelected = activePhotoId === p.id;
                    const frameFilter =
                      adj.filterPreset === "bw"
                        ? "grayscale(100%) contrast(110%)"
                        : adj.filterPreset === "vintage"
                        ? "sepia(45%) contrast(95%) brightness(105%)"
                        : adj.filterPreset === "vibrant"
                        ? "saturate(140%) contrast(105%)"
                        : adj.filterPreset === "cool"
                        ? "hue-rotate(180deg) saturate(90%)"
                        : "none";

                    return (
                      <div
                        key={p.id}
                        onPointerDown={(e) => handlePointerDown(e, p.id)}
                        onPointerMove={(e) => handlePointerMove(e, p.id)}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        onClick={(e) => { e.stopPropagation(); setActivePhotoId(p.id); }}
                        className={`bg-white rounded-xl p-2 pb-4 flex flex-col shadow-lg cursor-pointer transition-all ${
                          isSelected ? "ring-2 ring-primary scale-[1.02]" : "hover:scale-[0.99]"
                        }`}
                      >
                        <div className="w-full flex-1 overflow-hidden rounded-md bg-zinc-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.url}
                            alt=""
                            className="w-full h-full object-cover transition-transform"
                            style={{
                              transform: `scale(${adj.zoom}) rotate(${adj.rotation}deg) translate(${adj.panX}px, ${adj.panY}px)`,
                              filter: frameFilter,
                            }}
                          />
                        </div>
                        <span className="text-[9px] text-zinc-900 font-serif italic mt-1.5 text-center font-medium truncate px-1">
                          {adj.polaroidCaption || `Memory #${i + 1}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : template === "cinematic" ? (
                <div className="flex flex-col space-y-2 w-full h-full justify-center">
                  {selectedPhotos.slice(0, 3).map((p) => {
                    const adj = getAdjustment(p.id);
                    const isSelected = activePhotoId === p.id;
                    const frameFilter =
                      adj.filterPreset === "bw"
                        ? "grayscale(100%) contrast(110%)"
                        : adj.filterPreset === "vintage"
                        ? "sepia(45%) contrast(95%) brightness(105%)"
                        : adj.filterPreset === "vibrant"
                        ? "saturate(140%) contrast(105%)"
                        : adj.filterPreset === "cool"
                        ? "hue-rotate(180deg) saturate(90%)"
                        : "none";

                    return (
                      <div
                        key={p.id}
                        onPointerDown={(e) => handlePointerDown(e, p.id)}
                        onPointerMove={(e) => handlePointerMove(e, p.id)}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        onClick={(e) => { e.stopPropagation(); setActivePhotoId(p.id); }}
                        className={`w-full aspect-[21/9] rounded-xl overflow-hidden cursor-pointer transition-all ${
                          isSelected ? "ring-2 ring-primary" : ""
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.url}
                          alt=""
                          className="w-full h-full object-cover transition-transform"
                          style={{
                            transform: `scale(${adj.zoom}) rotate(${adj.rotation}deg) translate(${adj.panX}px, ${adj.panY}px)`,
                            filter: frameFilter,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : template === "compare" ? (
                <div className="grid grid-cols-2 gap-2 w-full h-full">
                  {[selectedPhotos[0], selectedPhotos[1] || selectedPhotos[0]].map((p, idx) => {
                    const adj = getAdjustment(p.id);
                    const isSelected = activePhotoId === p.id;
                    const frameFilter =
                      adj.filterPreset === "bw"
                        ? "grayscale(100%) contrast(110%)"
                        : adj.filterPreset === "vintage"
                        ? "sepia(45%) contrast(95%) brightness(105%)"
                        : adj.filterPreset === "vibrant"
                        ? "saturate(140%) contrast(105%)"
                        : adj.filterPreset === "cool"
                        ? "hue-rotate(180deg) saturate(90%)"
                        : "none";

                    return (
                      <div
                        key={idx}
                        onPointerDown={(e) => handlePointerDown(e, p.id)}
                        onPointerMove={(e) => handlePointerMove(e, p.id)}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        onClick={(e) => { e.stopPropagation(); setActivePhotoId(p.id); }}
                        className={`relative rounded-2xl overflow-hidden cursor-pointer transition-all ${
                          isSelected ? "ring-2 ring-primary" : ""
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.url}
                          alt=""
                          className="w-full h-full object-cover transition-transform"
                          style={{
                            transform: `scale(${adj.zoom}) rotate(${adj.rotation}deg) translate(${adj.panX}px, ${adj.panY}px)`,
                            filter: frameFilter,
                          }}
                        />
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[9px] text-white font-mono">
                          {idx === 0 ? "I" : "II"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 w-full h-full">
                  {selectedPhotos.slice(0, 4).map((p) => {
                    const adj = getAdjustment(p.id);
                    const isSelected = activePhotoId === p.id;
                    const frameFilter =
                      adj.filterPreset === "bw"
                        ? "grayscale(100%) contrast(110%)"
                        : adj.filterPreset === "vintage"
                        ? "sepia(45%) contrast(95%) brightness(105%)"
                        : adj.filterPreset === "vibrant"
                        ? "saturate(140%) contrast(105%)"
                        : adj.filterPreset === "cool"
                        ? "hue-rotate(180deg) saturate(90%)"
                        : "none";

                    return (
                      <div
                        key={p.id}
                        onPointerDown={(e) => handlePointerDown(e, p.id)}
                        onPointerMove={(e) => handlePointerMove(e, p.id)}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        onClick={(e) => { e.stopPropagation(); setActivePhotoId(p.id); }}
                        className={`rounded-xl overflow-hidden cursor-pointer transition-all ${
                          isSelected ? "ring-2 ring-primary" : ""
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.url}
                          alt=""
                          className="w-full h-full object-cover transition-transform"
                          style={{
                            transform: `scale(${adj.zoom}) rotate(${adj.rotation}deg) translate(${adj.panX}px, ${adj.panY}px)`,
                            filter: frameFilter,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Frame Inspector Overhaul (Floating) ───────────────── */}
      {activePhotoId && selectedPhotos.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 rounded-t-3xl md:rounded-3xl md:bottom-6 md:right-6 md:left-auto md:w-[340px] bg-zinc-900/95 border border-white/10 shadow-2xl p-5 z-50 backdrop-blur-xl animate-fade-in max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-primary uppercase tracking-widest flex items-center space-x-1.5">
                <Crop className="w-3.5 h-3.5" />
                <span>Frame Inspector</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-mono mt-1">
                {`Frame ${selectedPhotos.findIndex((p) => p.id === activePhotoId) + 1} of ${selectedPhotos.length}`}
              </span>
            </div>
            <button
              onClick={() => setActivePhotoId(null)}
              className="p-1.5 bg-white/5 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground hover:text-white" />
            </button>
          </div>

          <div className="space-y-4 pt-2 border-t border-white/5 text-xs">
            {/* Zoom / Scale */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ZoomIn className="w-3 h-3" />
                  <span>Zoom / Frame Crop</span>
                </span>
                <span className="font-mono">{getAdjustment(activePhotoId).zoom.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="1"
                max="2.5"
                step="0.05"
                value={getAdjustment(activePhotoId).zoom}
                onChange={(e) => updateActiveAdjustment({ zoom: parseFloat(e.target.value) })}
                className="w-full accent-primary h-1.5 bg-white/10 rounded-lg cursor-pointer"
              />
            </div>

            {/* Individual Rotation */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <RotateCw className="w-3 h-3" />
                  <span>Frame Rotation</span>
                </span>
                <span className="font-mono">{getAdjustment(activePhotoId).rotation}°</span>
              </div>
              <input
                type="range"
                min="-45"
                max="45"
                step="1"
                value={getAdjustment(activePhotoId).rotation}
                onChange={(e) => updateActiveAdjustment({ rotation: parseInt(e.target.value) })}
                className="w-full accent-primary h-1.5 bg-white/10 rounded-lg cursor-pointer"
              />
            </div>

            {/* Polaroid Note / Custom Caption */}
            <div className="space-y-1 pt-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                Frame Caption / Polaroid Note
              </label>
              <input
                type="text"
                value={getAdjustment(activePhotoId).polaroidCaption || ""}
                onChange={(e) => updateActiveAdjustment({ polaroidCaption: e.target.value })}
                placeholder="Handwritten note e.g. 'Golden hour in Shibuya'..."
                className="w-full px-3 py-1.5 bg-black/40 border border-white/10 rounded-xl text-xs text-foreground outline-none focus:border-primary/50"
              />
            </div>

            {/* Individual Filter Presets */}
            <div className="space-y-1 pt-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                Frame Color Grade
              </label>
              <div className="flex flex-wrap gap-1">
                {[
                  { id: "none", label: "Natural" },
                  { id: "bw", label: "B&W Mono" },
                  { id: "vintage", label: "Vintage 70s" },
                  { id: "vibrant", label: "Vivid" },
                  { id: "cool", label: "Cool Wave" },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => updateActiveAdjustment({ filterPreset: preset.id as "none" | "bw" | "vintage" | "vibrant" | "cool" })}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-mono border transition-all ${
                      getAdjustment(activePhotoId).filterPreset === preset.id
                        ? "bg-primary/20 text-primary border-primary/50"
                        : "bg-white/5 text-muted-foreground border-white/5 hover:text-white"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reset Frame Button */}
            <button
              onClick={() =>
                updateActiveAdjustment({
                  zoom: 1,
                  rotation: 0,
                  panX: 0,
                  panY: 0,
                  polaroidCaption: "",
                  filterPreset: "none",
                })
              }
              className="w-full py-1.5 mt-2 text-[10px] text-muted-foreground hover:text-foreground border border-white/5 rounded-xl hover:bg-white/5 transition-colors"
            >
              Reset Frame Adjustments
            </button>
          </div>
        </div>
      )}

    </main>
  );
}
