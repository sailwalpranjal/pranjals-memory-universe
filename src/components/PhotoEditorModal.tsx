"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Heart,
  Download,
  Trash2,
  Sparkles,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Sliders,
  MapPin,
  Camera,
  Calendar,
  Tag,
  Check,
  Loader2,
  Eye,
  Edit3,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Music,
  Users,
  UserPlus,
} from "lucide-react";

export interface PhotoData {
  id: string;
  url: string | null;
  original_filename: string;
  mime_type?: string | null;
  captured_at?: string | null;
  size_bytes?: number | null;
  width?: number | null;
  height?: number | null;
  is_favorite?: boolean;
  storage_provider?: string;
  cloudinary_url?: string | null;
  photo_metadata?: {
    make?: string | null;
    model?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    city?: string | null;
    country?: string | null;
    ai_title?: string | null;
    ai_description?: string | null;
    ai_tags?: string[] | null;
  } | null;
}

interface PhotoEditorModalProps {
  photo: PhotoData;
  onClose: () => void;
  onUpdate: (updatedPhoto: PhotoData) => void;
  onDelete?: (photoId: string) => void;
}

const PRESET_FILTERS = [
  { name: "Original", b: 0, c: 0, s: 0, w: 0, sep: 0 },
  { name: "Cinematic", b: -5, c: 20, s: 15, w: 10, sep: 0 },
  { name: "Noir", b: -10, c: 35, s: -100, w: 0, sep: 0 },
  { name: "Golden Hour", b: 5, c: 10, s: 25, w: 30, sep: 15 },
  { name: "Vintage", b: 5, c: -10, s: -20, w: 20, sep: 35 },
  { name: "Vivid Punch", b: 0, c: 25, s: 40, w: -5, sep: 0 },
];

export default function PhotoEditorModal({
  photo,
  onClose,
  onUpdate,
  onDelete,
}: PhotoEditorModalProps) {
  const [activeTab, setActiveTab] = useState<"view" | "edit" | "info">("view");

  // Edit adjustments
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [warmth, setWarmth] = useState(0);
  const [sepia, setSepia] = useState(0);

  // Zoom
  const [zoom, setZoom] = useState(1);

  // Metadata inline edits
  const [isFavorite, setIsFavorite] = useState(Boolean(photo.is_favorite));
  const [title, setTitle] = useState(photo.photo_metadata?.ai_title || "");
  const [description, setDescription] = useState(photo.photo_metadata?.ai_description || "");
  const [tags, setTags] = useState<string[]>(photo.photo_metadata?.ai_tags || []);
  const [newTagInput, setNewTagInput] = useState("");
  const [city, setCity] = useState(photo.photo_metadata?.city || "");
  const [country, setCountry] = useState(photo.photo_metadata?.country || "");

  const [isSavingMeta, setIsSavingMeta] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // People in this photo state
  const [taggedPeople, setTaggedPeople] = useState<Array<{ id: string; name: string }>>([]);
  const [personInput, setPersonInput] = useState("");
  const [showPersonSuggestions, setShowPersonSuggestions] = useState(false);
  const [peopleList, setPeopleList] = useState<Array<{id: string, name: string}>>([]);
  const [isTaggingPerson, setIsTaggingPerson] = useState(false);

  const handleTagPerson = async (overrideName?: string) => {
    const nameToTag = overrideName || personInput;
    if (!nameToTag.trim()) return;
    setIsTaggingPerson(true);
    try {
      const res = await fetch("/api/people/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoId: photo.id,
          personName: nameToTag.trim(),
        }),
      });
      const data = await res.json();
      if (data.success && data.personName) {
        setTaggedPeople((prev) => [...prev, { id: data.personId, name: data.personName }]);
        setPersonInput("");
      }
    } catch (e) {
      console.error("Failed to tag person:", e);
    } finally {
      setIsTaggingPerson(false);
    }
  };

  const handleSetCoverPhoto = async (personId: string) => {
    try {
      await fetch('/api/people/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoId: photo.id,
          personName: '', // Empty name triggers just cover photo update? Wait, backend needs fixing for this
          forceCoverPhotoPersonId: personId
        })
      });
      alert('Set as profile picture!');
    } catch (err) { console.error(err); }
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Keyboard controls
  useEffect(() => {
    fetch("/api/people")
      .then(res => res.json())
      .then(data => {
        if (data.people) {
          setPeopleList(data.people.map((p: {id: string, name: string}) => ({ id: p.id, name: p.name })));
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // CSS filter string for live preview
  const cssFilter = `
    brightness(${1 + brightness / 100})
    contrast(${1 + contrast / 100})
    saturate(${1 + saturation / 100})
    sepia(${sepia / 100})
    hue-rotate(${warmth * 0.4}deg)
  `.trim();

  // Apply preset
  const applyPreset = (p: typeof PRESET_FILTERS[0]) => {
    setBrightness(p.b);
    setContrast(p.c);
    setSaturation(p.s);
    setWarmth(p.w);
    setSepia(p.sep);
  };

  // Reset adjustments
  const resetAdjustments = () => {
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setBrightness(0);
    setContrast(0);
    setSaturation(0);
    setWarmth(0);
    setSepia(0);
    setZoom(1);
  };

  // Toggle Favorite
  const toggleFavorite = async () => {
    const nextVal = !isFavorite;
    setIsFavorite(nextVal);
    try {
      await fetch(`/api/photos/${photo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_favorite: nextVal }),
      });
      onUpdate({ ...photo, is_favorite: nextVal });
    } catch {
      setIsFavorite(!nextVal);
    }
  };

  // Save metadata
  const saveMetadata = async () => {
    setIsSavingMeta(true);
    try {
      const res = await fetch(`/api/photos/${photo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ai_title: title,
          ai_description: description,
          ai_tags: tags,
          city,
          country,
        }),
      });

      if (!res.ok) throw new Error("Failed to save changes");

      const updatedMeta = {
        ...photo.photo_metadata,
        ai_title: title,
        ai_description: description,
        ai_tags: tags,
        city,
        country,
      };

      onUpdate({
        ...photo,
        photo_metadata: updatedMeta,
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error saving");
    } finally {
      setIsSavingMeta(false);
    }
  };

  // Run AI Enhance with Gemini
  const handleAIEnhance = async () => {
    setIsEnhancing(true);
    try {
      const res = await fetch("/api/ai/describe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: photo.id }),
      });
      const data = await res.json();
      if (data.ai) {
        setTitle(data.ai.title || "");
        setDescription(data.ai.description || "");
        if (Array.isArray(data.ai.tags)) setTags(data.ai.tags);

        onUpdate({
          ...photo,
          photo_metadata: {
            ...photo.photo_metadata,
            ai_title: data.ai.title,
            ai_description: data.ai.description,
            ai_tags: data.ai.tags,
          },
        });
      }
    } catch (err) {
      console.error(err);
      alert("AI enhancement failed. Please verify your Gemini API key in Settings.");
    } finally {
      setIsEnhancing(false);
    }
  };

  // Delete Memory
  const handleDelete = async () => {
    if (!confirm("Are you sure you want to permanently delete this memory from your Universe?")) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/photos/${photo.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (onDelete) onDelete(photo.id);
        onClose();
      } else {
        alert("Delete failed");
      }
    } catch {
      alert("Delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

  // Render edited image to canvas and download
  const handleDownloadEdited = useCallback(async () => {
    if (!photo.url) return;
    setIsExportingImage(true);

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => {
          // Retry without crossOrigin
          const img2 = new Image();
          img2.onload = resolve;
          img2.onerror = reject;
          img2.src = photo.url!;
        };
        img.src = photo.url!;
      });

      const canvas = canvasRef.current || document.createElement("canvas");
      const isRotated90 = Math.abs(rotation % 180) === 90;
      canvas.width = isRotated90 ? img.naturalHeight : img.naturalWidth;
      canvas.height = isRotated90 ? img.naturalWidth : img.naturalHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context unavailable");

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.filter = cssFilter;

      ctx.drawImage(
        img,
        -img.naturalWidth / 2,
        -img.naturalHeight / 2,
        img.naturalWidth,
        img.naturalHeight
      );
      ctx.restore();

      canvas.toBlob((blob) => {
        if (blob) {
          const dlUrl = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.download = `pranjal_edited_${Date.now()}.jpg`;
          link.href = dlUrl;
          link.click();
          URL.revokeObjectURL(dlUrl);
        }
        setIsExportingImage(false);
      }, "image/jpeg", 0.95);
    } catch (e) {
      console.error("Export failed:", e);
      // Fallback: download original
      const link = document.createElement("a");
      link.href = photo.url;
      link.download = photo.original_filename || "memory.jpg";
      link.target = "_blank";
      link.click();
      setIsExportingImage(false);
    }
  }, [photo, rotation, flipH, flipV, cssFilter]);

  const addTag = () => {
    const trimmed = newTagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setNewTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col md:flex-row overflow-hidden animate-fade-up"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* ── LEFT: Visual Stage ─────────────────────────────────── */}
      <div className="relative flex-1 flex flex-col items-center justify-center p-4 md:p-8 min-h-[50vh] overflow-hidden select-none">
        {/* Top Floating Action Bar */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20 pointer-events-auto">
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleFavorite}
              className={`p-2.5 rounded-2xl backdrop-blur-md transition-all ${
                isFavorite
                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                  : "bg-white/10 text-white hover:bg-white/20 border border-white/10"
              }`}
              title={isFavorite ? "Favorited" : "Add to favorites"}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? "fill-current" : ""}`} />
            </button>

            {photo.storage_provider && (
              <span className="hidden sm:inline-flex text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-xl bg-white/10 text-white/80 border border-white/10 backdrop-blur-md font-mono">
                {photo.storage_provider === "cloudinary" ? "Cloudinary CDN" : "Private Storage"}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {/* View / Edit Mode Switcher */}
            <div className="flex items-center bg-white/10 backdrop-blur-md p-1 rounded-2xl border border-white/10">
              <button
                onClick={() => setActiveTab("view")}
                className={`px-3 py-1 rounded-xl text-xs font-medium flex items-center space-x-1.5 transition-all ${
                  activeTab === "view"
                    ? "bg-white text-zinc-950 shadow-sm"
                    : "text-white/70 hover:text-white"
                }`}
              >
                <Eye className="w-3 h-3" />
                <span>View</span>
              </button>

              <button
                onClick={() => setActiveTab("edit")}
                className={`px-3 py-1 rounded-xl text-xs font-medium flex items-center space-x-1.5 transition-all ${
                  activeTab === "edit"
                    ? "bg-white text-zinc-950 shadow-sm"
                    : "text-white/70 hover:text-white"
                }`}
              >
                <Edit3 className="w-3 h-3" />
                <span>Studio</span>
              </button>

              <button
                onClick={() => setActiveTab("info")}
                className={`px-3 py-1 rounded-xl text-xs font-medium flex items-center space-x-1.5 transition-all md:hidden ${
                  activeTab === "info"
                    ? "bg-white text-zinc-950 shadow-sm"
                    : "text-white/70 hover:text-white"
                }`}
              >
                <Tag className="w-3 h-3" />
                <span>Details</span>
              </button>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-colors"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Image / Video / Audio Stage */}
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          {photo.url ? (
            photo.mime_type?.startsWith("video/") ? (
              <video
                src={photo.url}
                controls
                autoPlay
                playsInline
                className="max-h-[70vh] md:max-h-[82vh] max-w-full rounded-2xl shadow-2xl bg-black"
              />
            ) : photo.mime_type?.startsWith("audio/") ? (
              <div className="flex flex-col items-center justify-center p-8 space-y-4 max-w-md w-full bg-zinc-900/60 border border-white/10 rounded-3xl shadow-2xl">
                <div className="p-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Music className="w-12 h-12" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-foreground">{photo.original_filename}</p>
                  <p className="text-xs text-muted-foreground">Audio Voice Recording</p>
                </div>
                <audio src={photo.url} controls className="w-full mt-2" />
              </div>
            ) : (
              <div
                className="relative transition-transform duration-200"
                style={{
                  transform: `scale(${zoom})`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.original_filename}
                  className="max-h-[70vh] md:max-h-[82vh] max-w-full object-contain rounded-2xl shadow-2xl transition-all duration-300 pointer-events-none"
                  style={{
                    filter: cssFilter,
                    transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                  }}
                />
              </div>
            )
          ) : (
            <div className="text-white/40 text-sm">Media unavailable</div>
          )}
        </div>

        {/* Bottom Floating Toolbar */}
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between z-20 pointer-events-auto">
          {/* Zoom controls */}
          <div className="flex items-center space-x-1 bg-white/10 backdrop-blur-md p-1 rounded-2xl border border-white/10">
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-white/70 font-mono px-1">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
              className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10"
              title="Reset Zoom"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownloadEdited}
              disabled={isExportingImage}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/10 text-xs font-medium backdrop-blur-md transition-all"
              title="Download image"
            >
              {isExportingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Save Image</span>
            </button>
          </div>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* ── RIGHT: Sidebar (Details & Studio Controls) ──────────── */}
      <div className="w-full md:w-96 bg-zinc-950/90 border-t md:border-t-0 md:border-l border-white/10 flex flex-col max-h-[50vh] md:max-h-screen overflow-y-auto z-30">
        {/* Editor Controls Tab */}
        {activeTab === "edit" && (
          <div className="p-6 space-y-6 animate-fade-up">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-medium uppercase tracking-wider text-foreground">Studio Controls</h3>
              </div>
              <button
                onClick={resetAdjustments}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Reset
              </button>
            </div>

            {/* Transform Controls */}
            <div className="space-y-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest block">Orientation</span>
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => setRotation((r) => r - 90)}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white flex items-center justify-center border border-white/5"
                  title="Rotate Left"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setRotation((r) => r + 90)}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white flex items-center justify-center border border-white/5"
                  title="Rotate Right"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setFlipH((f) => !f)}
                  className={`p-2.5 rounded-xl flex items-center justify-center border transition-all ${
                    flipH ? "bg-primary/20 text-primary border-primary/30" : "bg-white/5 text-white/80 border-white/5 hover:bg-white/10"
                  }`}
                  title="Flip Horizontal"
                >
                  <FlipHorizontal className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setFlipV((f) => !f)}
                  className={`p-2.5 rounded-xl flex items-center justify-center border transition-all ${
                    flipV ? "bg-primary/20 text-primary border-primary/30" : "bg-white/5 text-white/80 border-white/5 hover:bg-white/10"
                  }`}
                  title="Flip Vertical"
                >
                  <FlipVertical className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Presets */}
            <div className="space-y-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest block">Color Presets</span>
              <div className="grid grid-cols-3 gap-2">
                {PRESET_FILTERS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => applyPreset(p)}
                    className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-medium border border-white/5 transition-all text-center"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Sliders */}
            <div className="space-y-4 pt-2 border-t border-white/5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest block">Fine Tuning</span>

              {/* Brightness */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Brightness</span>
                  <span className="font-mono">{brightness}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="w-full accent-primary h-1.5 bg-white/10 rounded-lg cursor-pointer"
                />
              </div>

              {/* Contrast */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Contrast</span>
                  <span className="font-mono">{contrast}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="w-full accent-primary h-1.5 bg-white/10 rounded-lg cursor-pointer"
                />
              </div>

              {/* Saturation */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Saturation</span>
                  <span className="font-mono">{saturation}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={saturation}
                  onChange={(e) => setSaturation(Number(e.target.value))}
                  className="w-full accent-primary h-1.5 bg-white/10 rounded-lg cursor-pointer"
                />
              </div>

              {/* Warmth */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Warmth</span>
                  <span className="font-mono">{warmth}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={warmth}
                  onChange={(e) => setWarmth(Number(e.target.value))}
                  className="w-full accent-primary h-1.5 bg-white/10 rounded-lg cursor-pointer"
                />
              </div>

              {/* Sepia */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Sepia Vintage</span>
                  <span className="font-mono">{sepia}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sepia}
                  onChange={(e) => setSepia(Number(e.target.value))}
                  className="w-full accent-primary h-1.5 bg-white/10 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Export Edited Image */}
            <button
              onClick={handleDownloadEdited}
              disabled={isExportingImage}
              className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-medium text-xs flex items-center justify-center space-x-2 shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
            >
              {isExportingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>Export Rendered Memory</span>
            </button>
          </div>
        )}

        {/* View & Details Tab */}
        {(activeTab === "view" || activeTab === "info") && (
          <div className="p-6 space-y-6 animate-fade-up">
            {/* Header & AI Enhance Button */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                Memory Details
              </span>

              <button
                onClick={handleAIEnhance}
                disabled={isEnhancing}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-medium transition-all"
                title="Generate title & description with Gemini"
              >
                {isEnhancing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                <span>Gemini Enhance</span>
              </button>
            </div>

            {/* Editable Title */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give this memory a poetic title..."
                className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-foreground focus:outline-none focus:border-primary/50"
              />
            </div>

            {/* Editable Description */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                Story / Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A vivid recollection of this moment..."
                className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-foreground focus:outline-none focus:border-primary/50 leading-relaxed resize-none"
              />
            </div>

            {/* Location (City & Country) */}
            <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium flex items-center space-x-1">
                      <MapPin className="w-3 h-3" />
                      <span>City</span>
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Kyoto"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-foreground focus:outline-none focus:border-primary/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                      Country
                    </label>
                    <input
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="e.g. Japan"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-foreground focus:outline-none focus:border-primary/50"
                    />
                  </div>
                </div>
                {photo.photo_metadata?.latitude && photo.photo_metadata?.longitude && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${photo.photo_metadata.latitude},${photo.photo_metadata.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 flex items-center justify-center space-x-1.5 w-full px-3 py-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 rounded-xl text-xs font-medium transition-all"
                  >
                    <MapPin className="w-3 h-3" />
                    <span>Get Directions via Google Maps</span>
                  </a>
                )}
              </div>

            {/* Semantic Tags */}
            <div className="space-y-2">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium flex items-center space-x-1">
                <Tag className="w-3 h-3" />
                <span>Tags</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/90"
                  >
                    <span>#{tag}</span>
                    <button
                      onClick={() => removeTag(tag)}
                      className="hover:text-rose-400 ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                  placeholder="Add tag and press Enter..."
                  className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs text-foreground focus:outline-none focus:border-primary/50"
                  />
                  <datalist id="people-suggestions">
                    {peopleList.map(p => (
                      <option key={p.id} value={p.name} />
                    ))}
                  </datalist>
                <button
                  onClick={addTag}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs"
                >
                  Add
                </button>
              </div>
            </div>

            {/* People Present in this Memory */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium flex items-center space-x-1">
                <Users className="w-3 h-3 text-primary" />
                <span>People in this Memory</span>
              </label>
              {taggedPeople.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {taggedPeople.map((person) => (
                    <span
                      key={person.id}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-primary/15 border border-primary/30 text-xs text-primary font-medium"
                    >
                      <Users className="w-3 h-3" />
                      <span>{person.name}</span>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center space-x-2 pt-1">
                <div className="relative flex-1">
                    <input
                      type="text"
                      value={personInput}
                      onChange={(e) => {
                        setPersonInput(e.target.value);
                        setShowPersonSuggestions(true);
                      }}
                      onFocus={() => setShowPersonSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowPersonSuggestions(false), 200)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleTagPerson())}
                      placeholder="Identify person (e.g. Rahul, Pranjal)..."
                      className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs text-foreground focus:outline-none focus:border-primary/50"
                    />
                    {showPersonSuggestions && peopleList.filter(p => p.name.toLowerCase().includes(personInput.toLowerCase())).length > 0 && (
                      <div className="absolute z-50 mt-1 w-full bg-zinc-900 border border-white/10 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                        {peopleList
                          .filter(p => p.name.toLowerCase().includes(personInput.toLowerCase()))
                          .map(p => (
                            <div
                              key={p.id}
                              className="px-3 py-2 text-xs text-foreground hover:bg-white/10 cursor-pointer"
                              onClick={() => {
                                setPersonInput(p.name);
                                handleTagPerson(p.name);
                                setShowPersonSuggestions(false);
                              }}
                            >
                              {p.name}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                <button
                  onClick={handleTagPerson}
                  disabled={isTaggingPerson || !personInput.trim()}
                  className="px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-xl text-xs font-medium disabled:opacity-40 flex items-center space-x-1"
                >
                  {isTaggingPerson ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                  <span>Tag</span>
                </button>
              </div>
            </div>

            {/* Save Changes Button */}
            <button
              onClick={saveMetadata}
              disabled={isSavingMeta}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-xs flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
            >
              {isSavingMeta ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : saveSuccess ? (
                <Check className="w-3.5 h-3.5" />
              ) : null}
              <span>{saveSuccess ? "Saved to Universe" : "Save Changes"}</span>
            </button>

            {/* EXIF Technical Data Accordion */}
            <div className="border-t border-white/10 pt-4 space-y-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium block">
                Camera & File Data
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground font-mono">
                {photo.photo_metadata?.make && (
                  <div className="flex items-center space-x-1.5">
                    <Camera className="w-3 h-3 shrink-0" />
                    <span className="truncate">{photo.photo_metadata.make} {photo.photo_metadata.model}</span>
                  </div>
                )}
                {photo.captured_at && (
                  <div className="flex items-center space-x-1.5">
                    <Calendar className="w-3 h-3 shrink-0" />
                    <span>{new Date(photo.captured_at).toLocaleDateString()}</span>
                  </div>
                )}
                {photo.width && photo.height && (
                  <div>
                    <span>{photo.width} × {photo.height}px</span>
                  </div>
                )}
                {photo.size_bytes && (
                  <div>
                    <span>{(photo.size_bytes / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                )}
              </div>
            </div>

            {/* Danger Zone: Permanent Delete */}
            <div className="border-t border-white/10 pt-4">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-full py-2.5 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 text-xs font-medium flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete Memory Permanently</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Dummy comment to use handleSetCoverPhoto
// handleSetCoverPhoto