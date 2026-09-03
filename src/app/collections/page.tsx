"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Layers,
  Plus,
  Compass,
  Calendar,
  FolderHeart,
  FolderGit2,
  Folder,
  Loader2,
  Image as ImageIcon,
  Check,
  Trash2,
  X,
  Sparkles,
} from "lucide-react";

interface CollectionItem {
  id: string;
  title: string;
  description?: string | null;
  category: "trip" | "event" | "project" | "year" | "custom";
  cover_url?: string | null;
  photo_count: number;
  created_at: string;
}

interface PhotoOption {
  id: string;
  url: string;
  original_filename: string;
}

interface CollectionDetailPhoto {
  id: string;
  url: string;
  original_filename: string;
  photo_metadata?: { ai_title?: string };
}

interface CollectionDetail {
  id: string;
  title: string;
  description?: string;
  category: string;
  cover_url?: string;
  created_at: string;
  photos: CollectionDetailPhoto[];
}

const CATEGORIES = [
  { id: "all", label: "All Albums" },
  { id: "trip", label: "Trips & Journeys", icon: Compass },
  { id: "event", label: "Events & Gatherings", icon: Calendar },
  { id: "project", label: "Projects & Creations", icon: FolderGit2 },
  { id: "custom", label: "Personal Collections", icon: FolderHeart },
];

export default function CollectionsPage() {
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [photos, setPhotos] = useState<PhotoOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");

  // Create Modal State
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"trip" | "event" | "project" | "year" | "custom">("trip");
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Collection Inspection State
  const [selectedCollection, setSelectedCollection] = useState<CollectionDetail | null>(null);

  const fetchCollections = async () => {
    try {
      const res = await fetch("/api/collections");
      const data = await res.json();
      if (data.collections) setCollections(data.collections);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPhotos = async () => {
    try {
      const res = await fetch("/api/photos");
      const data = await res.json();
      if (data.photos) setPhotos(data.photos.filter((p: PhotoOption) => p.url));
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    fetchCollections();
    fetchPhotos();
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          category,
          photo_ids: selectedPhotoIds,
        }),
      });

      if (!res.ok) throw new Error("Creation failed");

      setShowModal(false);
      setTitle("");
      setDescription("");
      setSelectedPhotoIds([]);
      fetchCollections();
    } catch {
      alert("Failed to create collection");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenCollection = async (id: string) => {
    try {
      const res = await fetch(`/api/collections/${id}`);
      const data = await res.json();
      if (data.collection) {
        setSelectedCollection(data.collection as CollectionDetail);
      }
    } catch {
      alert("Failed to load collection details");
    }
  };

  const handleDeleteCollection = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm(
      "Are you sure you want to delete this collection album? Photos will remain safe in your archive."
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/collections/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setCollections((prev) => prev.filter((c) => c.id !== id));
      if (selectedCollection?.id === id) setSelectedCollection(null);
    } catch {
      alert("Failed to delete collection");
    }
  };

  const handleRemovePhoto = async (photoId: string) => {
    if (!selectedCollection) return;
    try {
      const res = await fetch(`/api/collections/${selectedCollection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remove_photo_ids: [photoId] }),
      });
      if (!res.ok) throw new Error("Failed to remove photo");
      setSelectedCollection((prev) =>
        prev
          ? {
              ...prev,
              photos: prev.photos.filter((p) => p.id !== photoId),
            }
          : null
      );
      setCollections((prev) =>
        prev.map((c) =>
          c.id === selectedCollection.id ? { ...c, photo_count: Math.max(0, c.photo_count - 1) } : c
        )
      );
    } catch {
      alert("Failed to remove photo from collection");
    }
  };

  const handleSetCoverPhoto = async (photoId: string) => {
    if (!selectedCollection) return;
    try {
      const res = await fetch(`/api/collections/${selectedCollection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cover_photo_id: photoId }),
      });
      if (!res.ok) throw new Error("Failed to set cover");
      await fetchCollections();
      alert("Album cover updated successfully!");
    } catch {
      alert("Failed to update album cover");
    }
  };

  const handleCreateSmartAlbum = async (preset: "starred" | "recent") => {
    if (photos.length === 0) return;
    const smartTitle = preset === "starred" ? "🌟 Starred Highlights" : "📅 Chronicles 2026";
    const desc =
      preset === "starred"
        ? "Curated collection of all favorited moments in the universe."
        : "Sequential chronological archive of recent memories.";
    const chosenIds = photos.slice(0, 8).map((p) => p.id);

    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: smartTitle,
          description: desc,
          category: "custom",
          cover_photo_id: chosenIds[0],
          photo_ids: chosenIds,
        }),
      });
      if (res.ok) {
        await fetchCollections();
      }
    } catch {
      alert("Failed to generate smart album");
    }
  };

  const togglePhotoSelect = (id: string) => {
    setSelectedPhotoIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const filteredCollections =
    activeCategory === "all"
      ? collections
      : collections.filter((c) => c.category === activeCategory);

  return (
    <main className="min-h-screen max-w-7xl mx-auto px-4 md:px-10 py-8 pb-32">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 pb-6 border-b border-white/5">
        <div>
          <p className="text-[10px] tracking-[0.35em] text-muted-foreground uppercase mb-2">
            Archive Curation
          </p>
          <h1 className="text-3xl font-extralight tracking-[0.12em] uppercase">Albums & Collections</h1>
          <p className="text-muted-foreground text-sm mt-1.5">
            Organize moments into journeys, creative projects, annual archives, and personal storylines.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4" />
          <span>New Collection</span>
        </button>
      </header>

      {/* Smart Auto-Curation Presets Bar */}
      <div className="mb-6 p-4 rounded-3xl bg-zinc-900/40 border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-xs font-mono uppercase text-muted-foreground">
            Smart Auto-Curators:
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleCreateSmartAlbum("starred")}
            className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-muted-foreground hover:text-foreground border border-white/5 transition-all flex items-center space-x-1.5"
          >
            <span>🌟 Starred Highlights</span>
          </button>
          <button
            onClick={() => handleCreateSmartAlbum("recent")}
            className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-muted-foreground hover:text-foreground border border-white/5 transition-all flex items-center space-x-1.5"
          >
            <span>📅 Chronicles 2026</span>
          </button>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-4 mb-6">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-2 rounded-2xl text-xs font-medium whitespace-nowrap transition-all border ${
              activeCategory === cat.id
                ? "bg-white text-zinc-950 border-white shadow-sm font-semibold"
                : "bg-white/5 text-muted-foreground border-white/5 hover:text-foreground hover:bg-white/10"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Collections Grid */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
          <p className="text-[10px] tracking-[0.35em] text-muted-foreground uppercase">
            Loading collections
          </p>
        </div>
      ) : filteredCollections.length === 0 ? (
        <div className="py-24 border border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center text-center space-y-4">
          <Folder className="w-10 h-10 opacity-10" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">No collections yet</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Group your photographs into trips, special events, or personal themes.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs text-white font-medium"
          >
            Create First Album
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCollections.map((col) => (
            <div
              key={col.id}
              onClick={() => handleOpenCollection(col.id)}
              className="group relative rounded-3xl overflow-hidden bg-zinc-900/60 border border-white/5 hover:border-white/20 transition-all flex flex-col cursor-pointer shadow-lg"
            >
              {/* Cover Image */}
              <div className="aspect-[16/10] bg-zinc-950 relative overflow-hidden">
                {col.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={col.cover_url}
                    alt={col.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                    <ImageIcon className="w-8 h-8 stroke-1" />
                  </div>
                )}

                <div className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[9px] font-mono uppercase tracking-wider text-white/90">
                  {col.category}
                </div>

                {/* Delete Collection Button */}
                <button
                  onClick={(e) => handleDeleteCollection(col.id, e)}
                  className="absolute top-3 right-3 p-1.5 rounded-xl bg-black/60 hover:bg-destructive text-white/70 hover:text-white backdrop-blur-md border border-white/10 opacity-0 group-hover:opacity-100 transition-all"
                  title="Delete collection"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Information */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-2">
                <div>
                  <h3 className="text-base font-medium text-foreground group-hover:text-primary transition-colors">
                    {col.title}
                  </h3>
                  {col.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                      {col.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground/70 pt-3 border-t border-white/5 font-mono">
                  <span>
                    {col.photo_count} {col.photo_count === 1 ? "memory" : "memories"}
                  </span>
                  <span>{new Date(col.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Collection Inspection Modal */}
      {selectedCollection && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setSelectedCollection(null)}
        >
          <div className="w-full max-w-3xl bg-zinc-950 border border-white/10 rounded-3xl p-6 space-y-6 shadow-2xl animate-fade-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-mono uppercase tracking-wider">
                    {selectedCollection.category}
                  </span>
                  <h2 className="text-xl font-medium text-foreground">{selectedCollection.title}</h2>
                </div>
                {selectedCollection.description && (
                  <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
                    {selectedCollection.description}
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Link
                  href="/make"
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium text-foreground flex items-center space-x-1.5 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>Open in Studio</span>
                </Link>
                <button
                  onClick={() => setSelectedCollection(null)}
                  className="p-1.5 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Photos inside Collection */}
            <div className="space-y-3">
              <span className="text-xs font-mono uppercase text-muted-foreground">
                Archived Items ({selectedCollection.photos?.length || 0})
              </span>

              {selectedCollection.photos?.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-8 text-center">
                  No photographs attached to this album yet.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {selectedCollection.photos?.map((p) => (
                    <div
                      key={p.id}
                      className="relative group rounded-2xl overflow-hidden aspect-square border border-white/10 bg-zinc-900"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt="" className="w-full h-full object-cover" />
                      <div className="absolute top-2 right-2 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={() => handleSetCoverPhoto(p.id)}
                          className="p-1.5 rounded-xl bg-black/70 hover:bg-primary text-white/70 hover:text-white backdrop-blur-md transition-all"
                          title="Set as Album Cover"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemovePhoto(p.id)}
                          className="p-1.5 rounded-xl bg-black/70 hover:bg-destructive text-white/70 hover:text-white backdrop-blur-md transition-all"
                          title="Remove from album"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="absolute bottom-0 inset-x-0 p-2 bg-black/80 backdrop-blur-md text-[10px] text-white/80 truncate">
                        {p.photo_metadata?.ai_title || p.original_filename}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="w-full max-w-lg bg-zinc-950 border border-white/10 rounded-3xl p-6 space-y-6 shadow-2xl animate-fade-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-medium uppercase tracking-wider text-foreground flex items-center space-x-2">
                <Layers className="w-4 h-4 text-primary" />
                <span>Create New Collection</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Album Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Winter in Kyoto, Architectural Studies..."
                  className="w-full px-3.5 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-foreground focus:outline-none focus:border-primary/50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["trip", "event", "project", "custom"] as const).map((catKey) => (
                    <button
                      key={catKey}
                      type="button"
                      onClick={() => setCategory(catKey)}
                      className={`p-2 rounded-xl text-xs capitalize border transition-all text-left ${
                        category === catKey
                          ? "bg-white text-zinc-950 border-white font-medium shadow-sm"
                          : "bg-white/5 border-white/5 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {catKey}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Story / Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief narrative of what this collection documents..."
                  className="w-full px-3.5 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-foreground focus:outline-none focus:border-primary/50 resize-none"
                />
              </div>

              {/* Photo Selector */}
              <div className="space-y-2">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                  Select Initial Photos ({selectedPhotoIds.length})
                </label>
                {photos.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No photographs in archive</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1 bg-white/5 rounded-2xl">
                    {photos.map((p) => {
                      const isSelected = selectedPhotoIds.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => togglePhotoSelect(p.id)}
                          className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border transition-all ${
                            isSelected
                              ? "border-primary ring-2 ring-primary/40 scale-95"
                              : "border-white/10 opacity-60 hover:opacity-100"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.url} alt="" className="w-full h-full object-cover" />
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

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-2xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-all flex items-center justify-center space-x-2 shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>Create Collection</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
