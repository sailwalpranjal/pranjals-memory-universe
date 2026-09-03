"use client";

import { useEffect, useState, useMemo } from "react";
import { Loader2, Calendar, Sparkles, MapPin, Heart, CloudUpload, Film, Music } from "lucide-react";
import PhotoEditorModal, { PhotoData } from "@/components/PhotoEditorModal";
import OnThisDay from "@/components/OnThisDay";
import GenerateMemoryModal from "@/components/GenerateMemoryModal";

type TimelineGroup = {
  date: string;
  photos: PhotoData[];
};

export default function TimelinePage() {
  const [timeline, setTimeline] = useState<TimelineGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [enhancingId, setEnhancingId] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoData | null>(null);
  const [generateMemoryOpen, setGenerateMemoryOpen] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<"all" | "photos" | "videos" | "audio">("all");

  const fetchTimeline = async () => {
    try {
      const res = await fetch("/api/timeline");
      const data = await res.json();
      if (data.timeline) setTimeline(data.timeline);
    } catch (err) {
      console.error("Failed to fetch timeline", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
  }, []);

  const filteredTimeline = useMemo(() => {
    if (mediaFilter === "all") return timeline;
    return timeline
      .map((group) => ({
        ...group,
        photos: group.photos.filter((p) => {
          if (mediaFilter === "videos") return p.mime_type?.startsWith("video/");
          if (mediaFilter === "audio") return p.mime_type?.startsWith("audio/");
          if (mediaFilter === "photos") return !p.mime_type || p.mime_type.startsWith("image/");
          return true;
        }),
      }))
      .filter((group) => group.photos.length > 0);
  }, [timeline, mediaFilter]);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  const formatShortDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

  const enhanceMemory = async (photoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEnhancingId(photoId);
    try {
      const res = await fetch("/api/ai/describe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId }),
      });
      if (res.ok) await fetchTimeline();
    } catch (err) {
      console.error(err);
    } finally {
      setEnhancingId(null);
    }
  };

  const handlePhotoUpdated = (updated: PhotoData) => {
    setTimeline((prev) =>
      prev.map((g) => ({
        ...g,
        photos: g.photos.map((p) => (p.id === updated.id ? updated : p)),
      }))
    );
    setSelectedPhoto(updated);
  };

  const handlePhotoDeleted = (deletedId: string) => {
    setTimeline((prev) =>
      prev
        .map((g) => ({
          ...g,
          photos: g.photos.filter((p) => p.id !== deletedId),
        }))
        .filter((g) => g.photos.length > 0)
    );
    setSelectedPhoto(null);
  };

  const totalPhotos = timeline.reduce((sum, g) => sum + g.photos.length, 0);

  return (
    <main className="min-h-screen max-w-7xl mx-auto px-4 md:px-10 py-8 pb-28 md:pb-12">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12 pb-6 border-b border-white/5">
        <div>
          <p className="text-[10px] tracking-[0.35em] text-muted-foreground uppercase mb-2">
            Chronological Archive
          </p>
          <h1 className="text-3xl font-extralight tracking-[0.12em] uppercase">Timeline</h1>
          <p className="text-muted-foreground text-sm mt-1.5">Your life moments organized by time.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setGenerateMemoryOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 rounded-2xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Memory</span>
          </button>
          {totalPhotos > 0 && (
            <div className="flex items-center space-x-2 text-xs text-muted-foreground border border-white/10 px-3 py-1.5 rounded-xl bg-white/5">
              <Calendar className="w-3.5 h-3.5" />
              <span className="tabular-nums">
                {totalPhotos} memories ({timeline.length} {timeline.length === 1 ? "day" : "days"})
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t border-white/5">
          {/* Media Format Filter Bar */}
          <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10 text-xs">
            {[
              { key: "all", label: "All Moments" },
              { key: "photos", label: "Photographs" },
              { key: "videos", label: "4K Video" },
              { key: "audio", label: "Voice Memos" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setMediaFilter(tab.key as typeof mediaFilter)}
                className={`px-3 py-1 rounded-lg transition-all ${
                  mediaFilter === tab.key
                    ? "bg-white text-zinc-950 font-medium shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <p className="text-xs text-muted-foreground font-mono">
            Showing {filteredTimeline.reduce((acc, g) => acc + g.photos.length, 0)} items across {filteredTimeline.length} days
          </p>
        </div>
      </header>

      {loading ? (
        <div className="w-full flex flex-col items-center justify-center py-32 space-y-4">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
          <p className="text-[10px] tracking-[0.35em] text-muted-foreground/60 uppercase">
            Loading archive
          </p>
        </div>
      ) : filteredTimeline.length === 0 ? (
        <div className="w-full flex flex-col items-center justify-center py-32 space-y-6 border border-dashed border-white/5 rounded-3xl">
          <Calendar className="w-10 h-10 opacity-10" />
          <div className="text-center space-y-2">
            <p className="text-foreground font-light tracking-wide">No moments found for this filter</p>
            <p className="text-xs text-muted-foreground">Try selecting &apos;All Moments&apos; or capture new media.</p>
          </div>
          <button
            onClick={() => setMediaFilter("all")}
            className="px-6 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-foreground text-xs font-medium transition-colors"
          >
            Clear Filter
          </button>
        </div>
      ) : (
        <div className="flex flex-col space-y-16">
          <OnThisDay />
          {filteredTimeline.map((group) => (
            <section key={group.date}>
              {/* Date Heading */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex flex-col">
                  <p className="text-[10px] text-muted-foreground/60 tracking-[0.3em] uppercase">
                    {formatShortDate(group.date).split(" ")[0]}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-extralight text-foreground tabular-nums leading-none">
                      {formatShortDate(group.date).split(" ")[1]}
                    </span>
                    <div>
                      <p className="text-base font-light text-foreground/90">
                        {formatDate(group.date).split(",")[0]}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {group.photos.length} {group.photos.length === 1 ? "memory" : "memories"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
              </div>

              {/* Photo Grid */}
              <div
                className={`grid gap-3 ${
                  group.photos.length === 1
                    ? "grid-cols-1 max-w-md"
                    : group.photos.length === 2
                    ? "grid-cols-2"
                    : group.photos.length === 3
                    ? "grid-cols-3"
                    : "grid-cols-2 md:grid-cols-4"
                }`}
              >
                {group.photos.map((photo, idx) => {
                  const meta = photo.photo_metadata;
                  const hasAI = Boolean(meta?.ai_title);
                  const isWide = group.photos.length >= 4 && idx === 0;

                  return (
                    <div
                      key={photo.id}
                      onClick={() => setSelectedPhoto(photo)}
                      className={`group relative overflow-hidden rounded-2xl cursor-pointer bg-zinc-900 border border-white/5 hover:border-white/20 transition-all duration-300 ${
                        isWide
                          ? "col-span-2 row-span-2 aspect-square"
                          : group.photos.length === 1
                          ? "aspect-[4/3]"
                          : "aspect-square"
                      }`}
                    >
                      {photo.url ? (
                        photo.mime_type?.startsWith("video/") ? (
                          <div className="relative w-full h-full bg-zinc-950 flex items-center justify-center overflow-hidden">
                            <video src={photo.url} className="w-full h-full object-cover" muted />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <div className="p-3 rounded-full bg-white/20 text-white backdrop-blur-md">
                                <Film className="w-5 h-5" />
                              </div>
                            </div>
                          </div>
                        ) : photo.mime_type?.startsWith("audio/") ? (
                          <div className="w-full h-full bg-zinc-900/90 flex flex-col items-center justify-center p-4 text-center space-y-2 border border-white/5">
                            <div className="p-3 rounded-full bg-emerald-500/15 text-emerald-400">
                              <Music className="w-6 h-6" />
                            </div>
                            <p className="text-xs font-medium text-foreground truncate max-w-full">
                              {photo.original_filename}
                            </p>
                            <span className="text-[9px] text-muted-foreground uppercase font-mono tracking-wider">
                              Voice Memo
                            </span>
                          </div>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={photo.url}
                            alt={photo.original_filename}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                            loading="lazy"
                          />
                        )
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-xs text-muted-foreground/40">Unavailable</span>
                        </div>
                      )}

                      {/* Top Badges */}
                      <div className="absolute top-2.5 left-2.5 flex items-center space-x-1 z-10 pointer-events-none">
                        {photo.is_favorite && (
                          <span className="p-1 rounded-full bg-rose-500/80 text-white shadow-md">
                            <Heart className="w-3 h-3 fill-current" />
                          </span>
                        )}
                        {photo.storage_provider === "cloudinary" && (
                          <span className="p-1 rounded-full bg-sky-500/80 text-white shadow-md" title="Cloudinary CDN">
                            <CloudUpload className="w-3 h-3" />
                          </span>
                        )}
                      </div>

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3.5">
                        {hasAI ? (
                          <div className="space-y-1">
                            <h3 className="text-xs font-semibold text-white leading-snug line-clamp-2">
                              {meta?.ai_title}
                            </h3>
                            {(meta?.city || meta?.country) && (
                              <div className="flex items-center space-x-1 text-white/70">
                                <MapPin className="w-2.5 h-2.5" />
                                <span className="text-[10px] truncate">
                                  {[meta.city, meta.country].filter(Boolean).join(", ")}
                                </span>
                              </div>
                            )}
                            {meta?.ai_tags && meta.ai_tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {meta.ai_tags.slice(0, 3).map((tag) => (
                                  <span
                                    key={tag}
                                    className="text-[8px] uppercase tracking-wider bg-white/20 text-white/90 px-1.5 py-0.5 rounded-full"
                                  >
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={(e) => enhanceMemory(photo.id, e)}
                            disabled={enhancingId === photo.id}
                            className="flex items-center justify-center space-x-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-md text-white text-[10px] py-2 rounded-xl transition-all border border-white/20 tracking-wider uppercase font-medium"
                          >
                            {enhancingId === photo.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Sparkles className="w-3 h-3" />
                            )}
                            <span>AI Enhance</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Photo Editor & Inspector Modal */}
      {selectedPhoto && (
        <PhotoEditorModal
          photo={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
          onUpdate={handlePhotoUpdated}
          onDelete={handlePhotoDeleted}
        />
      )}

      {/* AI Memory Generator Modal */}
      <GenerateMemoryModal
        isOpen={generateMemoryOpen}
        onClose={() => setGenerateMemoryOpen(false)}
      />
    </main>
  );
}
