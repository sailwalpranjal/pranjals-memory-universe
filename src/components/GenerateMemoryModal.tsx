"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  X,
  Loader2,
  MapPin,
  Sliders,
  Edit3,
  Layers,
  ArrowRight,
} from "lucide-react";

interface GeneratedMemory {
  id: string;
  title: string;
  narrative: string;
  dateLabel: string;
  locationLabel: string;
  layout: string;
  theme: string;
  photos: Array<{
    id: string;
    url: string;
    original_filename: string;
    photo_metadata?: {
      ai_title?: string;
      city?: string;
      country?: string;
    };
  }>;
}

interface GenerateMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MOODS = [
  { id: "Cinematic & Film", label: "Cinematic & Film", desc: "High contrast, atmospheric shadow, 35mm tone" },
  { id: "Warm & Nostalgic", label: "Warm & Nostalgic", desc: "Golden hour hues, archival sepia warmth" },
  { id: "Quiet & Minimalist", label: "Quiet & Minimalist", desc: "Negative space, clean geometric balance" },
  { id: "Vibrant & Kinetic", label: "Vibrant & Kinetic", desc: "Vivid spectral energy and travel discovery" },
];

export default function GenerateMemoryModal({ isOpen, onClose }: GenerateMemoryModalProps) {
  const router = useRouter();
  const [mood, setMood] = useState(MOODS[0].id);
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);
  const [location, setLocation] = useState("");
  const [limit, setLimit] = useState(4);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Result state
  const [memory, setMemory] = useState<GeneratedMemory | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedNarrative, setEditedNarrative] = useState("");

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mood,
          location: location.trim() || undefined,
          limit,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate memory");

      setMemory(data.memory);
      setEditedTitle(data.memory.title);
      setEditedNarrative(data.memory.narrative);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error generating memory";
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenInStudio = () => {
    if (!memory) return;
    router.push("/make");
    onClose();
  };

  const handleSaveToAlbums = async () => {
    if (!memory) return;
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editedTitle,
          description: editedNarrative,
          category: "custom",
          photo_ids: memory.photos.map((p) => p.id),
        }),
      });
      if (!res.ok) throw new Error("Failed to save album");
      alert("Memory successfully preserved as a curated album!");
      onClose();
    } catch {
      alert("Failed to save collection album.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-2xl bg-zinc-950 border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl animate-fade-up max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center space-x-2.5">
            <span className="p-2 rounded-2xl bg-primary/20 text-primary">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-muted-foreground">
                Autonomous Archival Synthesis
              </p>
              <h2 className="text-xl font-light text-foreground">Generate Memory</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Criteria (when no result yet) */}
        {!memory ? (
          <div className="space-y-6">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Select criteria to synthesize an evocative chapter from your authentic archive. AI retrieves matching
              photographs, analyzes lighting and geography, and authors an editorial narrative.
            </p>

            {/* Mood Selector */}
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block">
                Atmospheric Tone
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {MOODS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMood(m.id)}
                    className={`p-3 rounded-2xl text-left border transition-all flex flex-col ${
                      mood === m.id
                        ? "bg-white/10 border-primary/50 text-foreground"
                        : "bg-white/5 border-white/5 text-muted-foreground hover:text-foreground hover:bg-white/[0.08]"
                    }`}
                  >
                    <span className="text-xs font-medium text-foreground">{m.label}</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">{m.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Location Filter */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block">
                Geographic Filter (Optional)
              </label>
              <div className="flex items-center bg-white/5 border border-white/10 rounded-2xl px-3 py-2">
                <MapPin className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Tokyo, Delhi, Iceland..."
                  className="bg-transparent text-xs text-foreground outline-none w-full"
                />
              </div>
            </div>

            {/* Media Count Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3 h-3" />
                  <span>Photographs to Curate</span>
                </span>
                <span className="font-mono">{limit} frames</span>
              </div>
              <input
                type="range"
                min="2"
                max="6"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full accent-primary h-1.5 bg-white/10 rounded-lg cursor-pointer"
              />
            </div>

            {error && (
              <div className="p-3 bg-destructive/20 border border-destructive/30 rounded-2xl text-xs text-destructive">
                {error}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-all flex items-center justify-center space-x-2 shadow-xl shadow-primary/20 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Memory with Gemini 2.5 Flash...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Archival Memory</span>
                </>
              )}
            </button>
          </div>
        ) : (
          /* Generated Result View */
          <div className="space-y-6 animate-fade-up">
            {/* Header info */}
            <div className="space-y-2 p-5 rounded-3xl bg-zinc-900/60 border border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-[10px] font-mono text-primary uppercase">
                  <span>{memory.dateLabel}</span>
                  <span>•</span>
                  <span>{memory.locationLabel}</span>
                </div>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="flex items-center space-x-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>{isEditing ? "Done" : "Edit"}</span>
                </button>
              </div>

              {isEditing ? (
                <div className="space-y-2 pt-2">
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-1.5 text-base font-light text-foreground"
                  />
                  <textarea
                    value={editedNarrative}
                    onChange={(e) => setEditedNarrative(e.target.value)}
                    rows={3}
                    className="w-full bg-black/60 border border-white/20 rounded-xl p-3 text-xs text-zinc-300 font-light leading-relaxed resize-none"
                  />
                </div>
              ) : (
                <div>
                  <h3 className="text-xl font-light tracking-wide text-foreground">{editedTitle}</h3>
                  <p className="text-xs text-zinc-400 font-light leading-relaxed mt-2">
                    &ldquo;{editedNarrative}&rdquo;
                  </p>
                </div>
              )}
            </div>

            {/* Curated Photographs Grid */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase text-muted-foreground">
                Grounded Archive Frames ({memory.photos.length})
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {memory.photos.map((p) => (
                  <div
                    key={p.id}
                    className="relative aspect-square rounded-2xl overflow-hidden border border-white/10 bg-zinc-900 shadow-md group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 inset-x-0 p-1.5 bg-black/70 backdrop-blur-md text-[9px] text-white truncate">
                      {p.photo_metadata?.ai_title || p.original_filename}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={handleSaveToAlbums}
                className="w-full sm:flex-1 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-foreground text-xs font-medium transition-all flex items-center justify-center space-x-1.5 border border-white/10"
              >
                <Layers className="w-3.5 h-3.5 text-primary" />
                <span>Save to Albums</span>
              </button>

              <button
                onClick={handleOpenInStudio}
                className="w-full sm:flex-1 py-3 rounded-2xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-all flex items-center justify-center space-x-1.5 shadow-lg shadow-primary/20"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Open in Creative Studio</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
