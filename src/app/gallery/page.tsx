"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Loader2,
  Camera,
  Upload,
  Heart,
  CloudUpload,
  Film,
  Music,
  Trash2,
  RotateCcw,
  CheckSquare,
  Square,
  Tag,
  X,
  AlertTriangle,
} from "lucide-react";
import PhotoEditorModal, { PhotoData } from "@/components/PhotoEditorModal";

const PhotoUploader = dynamic(() => import("@/components/PhotoUploader"), { ssr: false });
const CameraCapture = dynamic(() => import("@/components/CameraCapture"), { ssr: false });

export default function GalleryPage() {
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [captureMode, setCaptureMode] = useState<"upload" | "camera">("upload");
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [filterMediaType, setFilterMediaType] = useState<"all" | "photo" | "video" | "audio">("all");
  const [viewTrash, setViewTrash] = useState(false);

  // Multi-select state
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkOperating, setIsBulkOperating] = useState(false);
  const [tagInputOpen, setTagInputOpen] = useState(false);
  const [bulkTagValue, setBulkTagValue] = useState("");

  const [selectedPhoto, setSelectedPhoto] = useState<PhotoData | null>(null);

  const fetchPhotos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (viewTrash) {
        params.append("trash", "true");
      } else if (filterFavorites) {
        params.append("favorites", "true");
      }

      if (filterMediaType !== "all") {
        params.append("type", filterMediaType);
      }

      const res = await fetch(`/api/photos?${params.toString()}`);
      const data = await res.json();
      if (data.photos) setPhotos(data.photos);
    } catch (err) {
      console.error("Failed to fetch photos", err);
    } finally {
      setLoading(false);
    }
  }, [filterFavorites, filterMediaType, viewTrash]);

  useEffect(() => {
    setSelectedIds([]);
    fetchPhotos();
  }, [fetchPhotos]);

  const handlePhotoUpdated = (updated: PhotoData) => {
    setPhotos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setSelectedPhoto(updated);
  };

  const handlePhotoDeleted = (deletedId: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== deletedId));
    setSelectedPhoto(null);
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === photos.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(photos.map((p) => p.id));
    }
  };

  const executeBulkAction = async (action: string, extra: Record<string, unknown> = {}) => {
    if (selectedIds.length === 0) return;
    if (action === "delete") {
      const confirmed = window.confirm(
        `Are you sure you want to PERMANENTLY delete ${selectedIds.length} media item(s)? This will delete original files from cloud storage and cannot be undone.`
      );
      if (!confirmed) return;
    }

    setIsBulkOperating(true);
    try {
      const res = await fetch("/api/photos/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids: selectedIds, ...extra }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Bulk action failed");
      }

      setSelectedIds([]);
      setTagInputOpen(false);
      setBulkTagValue("");
      await fetchPhotos();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error executing bulk action";
      alert(msg);
    } finally {
      setIsBulkOperating(false);
    }
  };

  const emptyRecycleBin = async () => {
    const allTrashIds = photos.map((p) => p.id);
    if (allTrashIds.length === 0) return;
    const confirmed = window.confirm(
      `Permanently purge ALL ${allTrashIds.length} item(s) from the Recycle Bin? Original storage files will be permanently erased.`
    );
    if (!confirmed) return;

    setIsBulkOperating(true);
    try {
      const res = await fetch("/api/photos/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", ids: allTrashIds }),
      });
      if (!res.ok) throw new Error("Failed to empty recycle bin");
      await fetchPhotos();
    } catch {
      alert("Error purging recycle bin");
    } finally {
      setIsBulkOperating(false);
    }
  };

  return (
    <main className="min-h-screen max-w-7xl mx-auto px-4 md:px-10 py-8 pb-36 md:pb-24">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 pb-6 border-b border-white/5">
        <div>
          <p className="text-[10px] tracking-[0.35em] text-muted-foreground uppercase mb-2">
            Universal Media Archive
          </p>
          <h1 className="text-3xl font-extralight tracking-[0.12em] uppercase">
            {viewTrash ? "Recycle Bin" : "Memory Gallery"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1.5">
            {viewTrash
              ? "Safely review, recover, or permanently purge deleted memories."
              : "High-resolution photos, 1080p clips, and voice memos stored in Cloudinary CDN & Private Storage."}
          </p>
        </div>

        {/* Capture Mode & Global Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Recycle Bin Toggle */}
          <button
            onClick={() => {
              setViewTrash(!viewTrash);
              setIsMultiSelect(false);
            }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
              viewTrash
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                : "bg-white/5 text-muted-foreground hover:text-foreground border-white/10"
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{viewTrash ? "Exit Trash" : "Recycle Bin"}</span>
          </button>

          {!viewTrash && (
            <>
              {/* Favorites Filter */}
              <button
                onClick={() => setFilterFavorites(!filterFavorites)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                  filterFavorites
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                    : "bg-white/5 text-muted-foreground hover:text-foreground border-white/10"
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${filterFavorites ? "fill-current" : ""}`} />
                <span>Favorites</span>
              </button>

              {/* Mode Switcher */}
              <div className="flex items-center bg-white/5 p-1 rounded-2xl border border-white/10">
                <button
                  onClick={() => setCaptureMode("upload")}
                  className={`flex items-center space-x-1.5 px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                    captureMode === "upload"
                      ? "bg-white text-zinc-950 shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import</span>
                </button>

                <button
                  onClick={() => setCaptureMode("camera")}
                  className={`flex items-center space-x-1.5 px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                    captureMode === "camera"
                      ? "bg-white text-zinc-950 shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Live Camera</span>
                </button>
              </div>
            </>
          )}

          {/* Multi-Select Toggle */}
          <button
            onClick={() => {
              setIsMultiSelect(!isMultiSelect);
              setSelectedIds([]);
            }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
              isMultiSelect
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-white/5 text-muted-foreground hover:text-foreground border-white/10"
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>{isMultiSelect ? "Done Selecting" : "Select Multiple"}</span>
          </button>
        </div>
      </header>

      {/* Capture Section (Only when not in Recycle Bin) */}
      {!viewTrash && (
        <section className="w-full mb-12 animate-fade-up">
          {captureMode === "upload" ? (
            <div className="max-w-2xl mx-auto">
              <PhotoUploader onUploadSuccess={fetchPhotos} />
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              <CameraCapture
                onCaptureComplete={fetchPhotos}
                onClose={() => setCaptureMode("upload")}
              />
            </div>
          )}
        </section>
      )}

      {/* Trash Alert Banner */}
      {viewTrash && (
        <div className="mb-8 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-up">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-medium text-amber-300">Recycle Bin Active</p>
              <p className="text-[11px] text-amber-400/70 mt-0.5">
                Items here are hidden from the primary timeline. You can restore them or permanently delete them.
              </p>
            </div>
          </div>
          {photos.length > 0 && (
            <button
              onClick={emptyRecycleBin}
              disabled={isBulkOperating}
              className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-medium transition-all shrink-0 flex items-center space-x-1.5 shadow-md"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Empty Recycle Bin</span>
            </button>
          )}
        </div>
      )}

      {/* Universal Media Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-white/5">
        <div className="flex items-center space-x-2">
          {(["all", "photo", "video", "audio"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterMediaType(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-all ${
                filterMediaType === t
                  ? "bg-white text-zinc-950 font-semibold shadow-sm"
                  : "bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10"
              }`}
            >
              {t === "all" ? "All Media" : t === "photo" ? "Photos" : t === "video" ? "Videos" : "Voice Notes"}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-3 text-xs text-muted-foreground font-mono">
          <span>{photos.length} item(s)</span>
          {isMultiSelect && (
            <button
              onClick={toggleSelectAll}
              className="text-primary hover:underline font-medium"
            >
              {selectedIds.length === photos.length ? "Deselect All" : "Select All"}
            </button>
          )}
        </div>
      </div>

      {/* Gallery Section */}
      <section>
        {loading ? (
          <div className="w-full flex flex-col items-center justify-center py-24 space-y-4">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
            <p className="text-[10px] tracking-[0.35em] text-muted-foreground/60 uppercase">
              Loading memories
            </p>
          </div>
        ) : photos.length === 0 ? (
          <div className="w-full flex flex-col items-center justify-center py-24 space-y-5 border border-dashed border-white/5 rounded-3xl">
            <Camera className="w-10 h-10 opacity-10" />
            <div className="text-center">
              <p className="text-foreground font-light">
                {viewTrash
                  ? "Recycle Bin is empty"
                  : filterFavorites
                  ? "No favorited memories yet"
                  : "Nothing captured yet"}
              </p>
              <p className="text-xs text-muted-foreground mt-1.5">
                {viewTrash
                  ? "Deleted media items will appear here for safe recovery."
                  : filterFavorites
                  ? "Click the heart icon on any photo to add it to your favorites."
                  : "Use the live camera or import files above to add your first memory."}
              </p>
            </div>
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-3 space-y-3">
            {photos.map((photo) => {
              const meta = photo.photo_metadata;
              const isSelected = selectedIds.includes(photo.id);

              return (
                <div
                  key={photo.id}
                  onClick={(e) => {
                    if (isMultiSelect) {
                      toggleSelect(photo.id, e);
                    } else {
                      setSelectedPhoto(photo);
                    }
                  }}
                  className={`relative overflow-hidden rounded-2xl break-inside-avoid group cursor-pointer bg-zinc-900 border transition-all duration-300 ${
                    isSelected
                      ? "border-primary ring-2 ring-primary/40 shadow-lg"
                      : "border-white/5 hover:border-white/20"
                  }`}
                >
                  {photo.url ? (
                    photo.mime_type?.startsWith("video/") ? (
                      <div className="relative aspect-[4/3] bg-zinc-950 flex items-center justify-center overflow-hidden">
                        <video src={photo.url} className="w-full h-full object-cover" muted />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="p-3 rounded-full bg-white/20 text-white backdrop-blur-md">
                            <Film className="w-5 h-5" />
                          </div>
                        </div>
                      </div>
                    ) : photo.mime_type?.startsWith("audio/") ? (
                      <div className="aspect-[4/3] bg-zinc-900/90 flex flex-col items-center justify-center p-4 text-center space-y-2 border border-white/5">
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
                        className="w-full h-auto block transition-transform duration-700 group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                    )
                  ) : (
                    <div className="aspect-square flex items-center justify-center">
                      <span className="text-xs text-muted-foreground/40">Unavailable</span>
                    </div>
                  )}

                  {/* Multi-Select Checkbox Badge */}
                  {isMultiSelect && (
                    <button
                      onClick={(e) => toggleSelect(photo.id, e)}
                      className={`absolute top-2.5 right-2.5 z-20 p-1.5 rounded-xl shadow-lg transition-all ${
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-black/60 text-white/70 hover:text-white"
                      }`}
                    >
                      {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </button>
                  )}

                  {/* Badges: Favorite & Cloudinary */}
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

                  {/* Hover Caption Card */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent flex flex-col justify-end p-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <p className="text-xs text-white font-medium leading-snug line-clamp-2">
                      {meta?.ai_title || photo.original_filename}
                    </p>
                    {(meta?.city || meta?.country) && (
                      <p className="text-[10px] text-white/60 mt-0.5 truncate">
                        {[meta.city, meta.country].filter(Boolean).join(", ")}
                      </p>
                    )}
                    {meta?.ai_tags && meta.ai_tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {meta.ai_tags.slice(0, 2).map((t) => (
                          <span
                            key={t}
                            className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/20 text-white/90"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Sticky Bulk Action Floating Bar */}
      {isMultiSelect && selectedIds.length > 0 && (
        <aside aria-label="Bulk actions" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-950/95 backdrop-blur-xl border border-white/15 rounded-3xl p-3 px-5 shadow-2xl flex flex-wrap items-center gap-3 animate-fade-up">
          <span className="text-xs font-mono font-medium text-foreground pr-2 border-r border-white/10">
            {selectedIds.length} selected
          </span>

          {viewTrash ? (
            <>
              {/* Restore Action */}
              <button
                onClick={() => executeBulkAction("restore")}
                disabled={isBulkOperating}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-foreground text-xs font-medium transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                <span>Restore</span>
              </button>

              {/* Permanent Delete Action */}
              <button
                onClick={() => executeBulkAction("delete")}
                disabled={isBulkOperating}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-medium transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Permanently</span>
              </button>
            </>
          ) : (
            <>
              {/* Favorite Action */}
              <button
                onClick={() => executeBulkAction("favorite")}
                disabled={isBulkOperating}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-foreground text-xs font-medium transition-all"
                title="Favorite Selected"
              >
                <Heart className="w-3.5 h-3.5 text-rose-400" />
                <span>Favorite</span>
              </button>

              {/* Add Tag Modal Action */}
              {tagInputOpen ? (
                <div className="flex items-center space-x-1 bg-white/5 p-1 rounded-xl border border-white/10">
                  <input
                    type="text"
                    value={bulkTagValue}
                    onChange={(e) => setBulkTagValue(e.target.value)}
                    placeholder="Tag name"
                    className="bg-transparent text-xs text-foreground px-2 py-0.5 outline-none w-24"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        executeBulkAction("add_tag", { tag: bulkTagValue });
                      }
                    }}
                  />
                  <button
                    onClick={() => executeBulkAction("add_tag", { tag: bulkTagValue })}
                    className="p-1 rounded-lg bg-primary text-primary-foreground text-[10px]"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setTagInputOpen(false)}
                    className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setTagInputOpen(true)}
                  disabled={isBulkOperating}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-foreground text-xs font-medium transition-all"
                >
                  <Tag className="w-3.5 h-3.5 text-sky-400" />
                  <span>Tag</span>
                </button>
              )}

              {/* Move to Recycle Bin */}
              <button
                onClick={() => executeBulkAction("archive")}
                disabled={isBulkOperating}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs font-medium transition-all border border-amber-500/30"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Move to Trash</span>
              </button>
            </>
          )}

          {/* Deselect All */}
          <button
            onClick={() => setSelectedIds([])}
            className="p-1.5 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all ml-1"
            title="Deselect All"
          >
            <X className="w-4 h-4" />
          </button>
        </aside>
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
    </main>
  );
}
