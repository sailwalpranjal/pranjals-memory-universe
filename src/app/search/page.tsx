"use client";

import { useState, useRef } from "react";
import {
  Loader2,
  Search as SearchIcon,
  MapPin,
  X,
  Users,
  FolderHeart,
  Video,
  Sparkles,
  ArrowRight,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import PhotoEditorModal, { PhotoData } from "@/components/PhotoEditorModal";

interface SearchPhotoItem extends PhotoData {
  metadata?: {
    city?: string;
    country?: string;
    ai_title?: string;
    ai_description?: string;
    ai_tags?: string[];
    make?: string;
    model?: string;
  } | null;
}

interface MatchedPerson {
  id: string;
  name: string;
  created_at: string;
}

interface MatchedCollection {
  id: string;
  title: string;
  description: string | null;
}

interface MatchedMeeting {
  id: string;
  title: string;
  notes: string | null;
  scheduled_at: string;
}

const SUGGESTIONS = [
  "Tokyo",
  "Kyoto",
  "Sunset",
  "Portrait",
  "pranjal_universe",
  "Night",
  "iPhone",
  "Canon",
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "photos" | "people" | "collections" | "meetings">("all");

  const [results, setResults] = useState<SearchPhotoItem[]>([]);
  const [people, setPeople] = useState<MatchedPerson[]>([]);
  const [collections, setCollections] = useState<MatchedCollection[]>([]);
  const [meetings, setMeetings] = useState<MatchedMeeting[]>([]);

  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoData | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const doSearch = async (q: string) => {
    if (!q.trim()) return;
    setQuery(q);
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const rawResults = data.results || [];
      const normalized = rawResults.map((p: SearchPhotoItem) => ({
        ...p,
        photo_metadata: p.metadata || p.photo_metadata || null,
      }));
      setResults(normalized);
      setPeople(data.people || []);
      setCollections(data.collections || []);
      setMeetings(data.meetings || []);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
  };

  const handlePhotoUpdated = (updated: PhotoData) => {
    setResults((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
    setSelectedPhoto(updated);
  };

  const handlePhotoDeleted = (deletedId: string) => {
    setResults((prev) => prev.filter((p) => p.id !== deletedId));
    setSelectedPhoto(null);
  };

  const totalMatches = results.length + people.length + collections.length + meetings.length;

  return (
    <main className="min-h-screen max-w-7xl mx-auto px-4 md:px-10 py-8 pb-28 md:pb-12">
      {/* Header */}
      <header className="mb-10">
        <p className="text-[10px] tracking-[0.35em] text-muted-foreground uppercase mb-2">
          Universal Intelligence Search
        </p>
        <h1 className="text-3xl font-extralight tracking-[0.12em] uppercase mb-1.5 flex items-center gap-3">
          <SearchIcon className="w-7 h-7 text-primary" />
          <span>Search Universe</span>
        </h1>
        <p className="text-muted-foreground text-sm">
          Omni-search across photographs, Gemini vision descriptions, geocoded cities, people profiles, albums, and meeting transcripts.
        </p>
      </header>

      {/* Search Bar */}
      <div className="max-w-3xl mb-8">
        <form onSubmit={handleSearch} className="relative">
          <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/60" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search anything: 'Tokyo sunset', 'Rahul', 'Kyoto album', or 'pranjal_universe'..."
            className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-white/30 rounded-2xl px-6 py-4 pl-14 pr-14 text-base outline-none transition-all placeholder:text-muted-foreground/40 text-foreground"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
                setPeople([]);
                setCollections([]);
                setMeetings([]);
                setHasSearched(false);
                inputRef.current?.focus();
              }}
              className="absolute right-5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>

        {/* Suggestion Chips */}
        {!hasSearched && (
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider self-center">
              Try:
            </span>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => doSearch(s)}
                className="text-xs px-3.5 py-1.5 rounded-full border border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20 hover:bg-white/5 transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Multi-Entity Tab Filter Pills */}
      {hasSearched && !loading && totalMatches > 0 && (
        <div className="flex items-center space-x-2 overflow-x-auto pb-4 mb-8 border-b border-white/5">
          {[
            { id: "all", label: `All Matches (${totalMatches})` },
            { id: "photos", label: `Photos & Media (${results.length})` },
            { id: "people", label: `People (${people.length})` },
            { id: "collections", label: `Albums (${collections.length})` },
            { id: "meetings", label: `Meetings & Notes (${meetings.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as "all" | "photos" | "people" | "collections" | "meetings")}
              className={`px-3.5 py-1.5 rounded-2xl text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "bg-white text-zinc-950 shadow-md font-semibold"
                  : "bg-white/5 text-muted-foreground hover:text-foreground border border-white/5"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 space-y-3">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
            Searching Memory Universe...
          </p>
        </div>
      )}

      {/* Empty State */}
      {hasSearched && !loading && totalMatches === 0 && (
        <div className="flex flex-col items-center justify-center py-24 space-y-3 border border-dashed border-white/10 rounded-3xl p-8">
          <SearchIcon className="w-10 h-10 opacity-20 text-primary" />
          <p className="text-sm font-medium text-foreground">No matches found for &ldquo;{query}&rdquo;</p>
          <p className="text-xs text-muted-foreground max-w-sm text-center">
            Try a broader keyword, check spelling, or search for another date, city, person, or camera model.
          </p>
        </div>
      )}

      {/* Results Content */}
      {hasSearched && !loading && totalMatches > 0 && (
        <div className="space-y-12 animate-fade-up">
          {/* 1. PEOPLE MATCHES */}
          {(activeTab === "all" || activeTab === "people") && people.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-xs font-mono uppercase tracking-widest text-primary flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" />
                  <span>People ({people.length})</span>
                </span>
                <Link
                  href="/people"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <span>View All People</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {people.map((p) => (
                  <Link
                    key={p.id}
                    href="/people"
                    className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-primary/30 transition-all flex items-center space-x-3 group"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-medium text-sm shrink-0">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors truncate">
                        {p.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        Profile in Universe
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* 2. ALBUMS / COLLECTIONS MATCHES */}
          {(activeTab === "all" || activeTab === "collections") && collections.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-xs font-mono uppercase tracking-widest text-primary flex items-center gap-2">
                  <FolderHeart className="w-3.5 h-3.5" />
                  <span>Albums & Collections ({collections.length})</span>
                </span>
                <Link
                  href="/collections"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <span>View All Albums</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {collections.map((col) => (
                  <Link
                    key={col.id}
                    href="/collections"
                    className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-primary/30 transition-all flex flex-col space-y-1 group"
                  >
                    <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                      {col.title}
                    </p>
                    {col.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        {col.description}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* 3. MEETINGS & NOTES MATCHES */}
          {(activeTab === "all" || activeTab === "meetings") && meetings.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-xs font-mono uppercase tracking-widest text-primary flex items-center gap-2">
                  <Video className="w-3.5 h-3.5" />
                  <span>Meeting Sessions & Notes ({meetings.length})</span>
                </span>
                <Link
                  href="/meet"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <span>View All Sessions</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {meetings.map((m) => (
                  <Link
                    key={m.id}
                    href={`/meet/${m.id}`}
                    className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-primary/30 transition-all flex flex-col space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors truncate">
                        {m.title}
                      </p>
                      <span className="text-[9px] font-mono text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(m.scheduled_at).toLocaleDateString()}</span>
                      </span>
                    </div>
                    {m.notes && (
                      <p className="text-[11px] text-muted-foreground/80 line-clamp-2 italic bg-black/30 p-2 rounded-xl">
                        &ldquo;{m.notes}&rdquo;
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* 4. PHOTOGRAPHS & MEDIA MATCHES */}
          {(activeTab === "all" || activeTab === "photos") && results.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-xs font-mono uppercase tracking-widest text-primary flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Photographs & Media ({results.length})</span>
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {results.map((photo) => {
                  const meta = photo.photo_metadata || photo.metadata;
                  return (
                    <div
                      key={photo.id}
                      onClick={() => setSelectedPhoto(photo)}
                      className="group relative aspect-square rounded-2xl overflow-hidden cursor-pointer bg-zinc-900 border border-white/5 hover:border-white/20 transition-all duration-300"
                    >
                      {photo.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photo.url}
                          alt={photo.original_filename}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-[10px] text-muted-foreground/40">Unavailable</span>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3.5">
                        <p className="text-xs text-white font-medium line-clamp-2 leading-snug">
                          {meta?.ai_title || photo.original_filename}
                        </p>
                        {(meta?.city || meta?.country) && (
                          <div className="flex items-center space-x-1 mt-1 text-white/60">
                            <MapPin className="w-2.5 h-2.5" />
                            <span className="text-[10px] truncate">
                              {[meta.city, meta.country].filter(Boolean).join(", ")}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Photo Inspector & Editor Modal */}
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
