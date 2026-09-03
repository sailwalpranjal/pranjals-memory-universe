"use client";

import { useState, useEffect } from "react";
import { Calendar, ArrowRight, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import PhotoEditorModal, { PhotoData } from "@/components/PhotoEditorModal";

interface FlashbackPhoto extends PhotoData {
  yearsAgo?: number;
}

export default function OnThisDay() {
  const [memories, setMemories] = useState<FlashbackPhoto[]>([]);
  const [dateString, setDateString] = useState("");
  const [isFallback, setIsFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoData | null>(null);

  useEffect(() => {
    fetch("/api/on-this-day")
      .then((res) => res.json())
      .then((data) => {
        if (data.memories) {
          setMemories(data.memories.filter((p: FlashbackPhoto) => p.url));
          setDateString(data.dateString || "");
          setIsFallback(data.isMonthFallback || false);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || memories.length === 0) return null;

  return (
    <>
      <div className="w-full p-6 md:p-8 rounded-3xl bg-zinc-900/40 border border-white/5 space-y-6 select-none relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[10px] font-mono tracking-[0.25em] text-primary uppercase flex items-center space-x-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>{isFallback ? "Archival Memory Flashback" : `On This Day: ${dateString}`}</span>
            </span>
            <h2 className="text-xl font-light tracking-wide text-foreground">
              {isFallback ? "Moments Re-surfaced from Your Archive" : `Memories from past years on ${dateString}`}
            </h2>
          </div>

          <Link
            href="/make"
            className="self-start sm:self-auto flex items-center space-x-1.5 px-4 py-2 rounded-2xl bg-white/5 hover:bg-white/10 text-foreground text-xs font-medium border border-white/10 transition-all group"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-primary" />
            <span>Create Studio Poster</span>
            <ArrowRight className="w-3 h-3 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Horizontal Memories Carousel */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {memories.slice(0, 4).map((photo) => (
            <div
              key={photo.id}
              onClick={() => setSelectedPhoto(photo)}
              className="group relative aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-950 border border-white/5 hover:border-white/20 transition-all cursor-pointer shadow-lg"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url!}
                alt={photo.original_filename}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                loading="lazy"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />

              <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                <div className="truncate pr-2">
                  <p className="text-xs font-medium text-white truncate">
                    {photo.photo_metadata?.ai_title || photo.original_filename}
                  </p>
                  <p className="text-[10px] text-white/60 font-mono">
                    {photo.captured_at
                      ? new Date(photo.captured_at).toLocaleDateString("en-US", { year: "numeric", month: "short" })
                      : "Preserved Memory"}
                  </p>
                </div>

                {photo.yearsAgo && photo.yearsAgo > 0 ? (
                  <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 text-[9px] font-mono shrink-0">
                    {photo.yearsAgo}y ago
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-mono shrink-0">
                    This Year
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Photo Studio Modal */}
      {selectedPhoto && (
        <PhotoEditorModal
          photo={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
          onUpdate={() => {}}
        />
      )}
    </>
  );
}
