"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Camera,
  Calendar,
  Users,
  MapPin,
  Search,
  LayoutDashboard,
  Sparkles,
  ArrowRight,
  Video,
  Layers,
  Gamepad2,
} from "lucide-react";
import OnThisDay from "@/components/OnThisDay";
import GenerateMemoryModal from "@/components/GenerateMemoryModal";

interface Stats {
  photoCount: number;
  peopleCount: number;
  placesCount: number;
  latestPhoto: string | null;
  recentPhotos: string[];
}

const NAV_CARDS = [
  { href: "/gallery", label: "Capture", icon: Camera, description: "Live camera snapshot & high-res media upload" },
  { href: "/timeline", label: "Timeline", icon: Calendar, description: "Every memory, chronologically arranged" },
  { href: "/people", label: "People", icon: Users, description: "Faces and social connections in your world" },
  { href: "/places", label: "Places", icon: MapPin, description: "Locations mapped across your life" },
  { href: "/meet", label: "Private Meet", icon: Video, description: "Live encrypted video, audio & text sessions" },
  { href: "/collections", label: "Albums", icon: Layers, description: "Curate journeys, projects & annual archives" },
  { href: "/puzzles", label: "Puzzles", icon: Gamepad2, description: "Playable memory recall & timeline challenges" },
  { href: "/make", label: "Studio", icon: LayoutDashboard, description: "Craft high-resolution collages and posters" },
  { href: "/lab", label: "The Lab", icon: Sparkles, description: "Experimental visual shaders and spectrum analysis" },
  { href: "/search", label: "Search", icon: Search, description: "Find anything across all metadata" },
];

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [visitorMode, setVisitorMode] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mode = localStorage.getItem('pranjal_visitor_mode');
      if (mode) setVisitorMode(mode);
    }
  }, []);

  const toggleVisitorMode = () => {
    if (visitorMode) {
      localStorage.removeItem('pranjal_visitor_mode');
      setVisitorMode(null);
      window.location.reload();
    } else {
      const personId = window.prompt('Enter Friend ID for Restricted Mode:');
      if (personId) {
        localStorage.setItem('pranjal_visitor_mode', personId);
        setVisitorMode(personId);
        window.location.reload();
      }
    }
  };

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  useEffect(() => {
    Promise.all([
      fetch("/api/photos").then(r => r.json()).catch(() => ({ photos: [] })),
      fetch("/api/people").then(r => r.json()).catch(() => ({ people: [], totalPeople: 0 })),
      fetch("/api/places").then(r => r.json()).catch(() => ({ places: [] })),
    ]).then(([photosData, peopleData, placesData]) => {
      const photos: { url: string | null; original_filename: string }[] = photosData.photos || [];
      const withUrls = photos.filter(p => p.url);
      setStats({
        photoCount: photos.length,
        peopleCount: peopleData.totalPeople || (peopleData.people?.length || 0),
        placesCount: placesData.places?.length || 0,
        latestPhoto: withUrls[0]?.url ?? null,
        recentPhotos: withUrls.slice(0, 6).map(p => p.url as string),
      });
    });
  }, []);

  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning, Pranjal" : hour < 17 ? "Good afternoon, Pranjal" : "Good evening, Pranjal";

  const hasContent = stats && stats.photoCount > 0;

  return (
    <main className="min-h-screen flex flex-col">
      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="relative min-h-[85vh] flex flex-col items-center justify-center overflow-hidden">
        {/* Background collage of recent photos */}
        {hasContent && stats.recentPhotos.length > 0 && (
          <div className="absolute inset-0 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-0 opacity-15 mix-blend-screen pointer-events-none">
            {[...stats.recentPhotos, ...stats.recentPhotos].slice(0, 12).map((url, i) => (
              <div key={i} className="overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="w-full h-full object-cover scale-110"
                  style={{ aspectRatio: "1" }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/95 via-background/80 to-background/98" />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center space-y-8 px-6">
          {/* Cloud Health & Status Pill */}
          <div className="flex flex-col md:flex-row items-center gap-3">
    <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono tracking-widest text-muted-foreground uppercase shadow-2xl backdrop-blur-md">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
      <span>Pranjal&apos;s Network</span>
      <span className="text-white/20">|</span>
      <span className="text-emerald-400">Sync Active</span>
    </div>
    <button 
      onClick={toggleVisitorMode}
      className={`inline-flex items-center space-x-2 px-4 py-1.5 rounded-full border text-[10px] font-mono tracking-widest uppercase shadow-2xl backdrop-blur-md transition-all ${visitorMode ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10'}`}
    >
      <span>{visitorMode ? 'Visitor Restricted Mode' : 'Admin Access'}</span>
    </button>
  </div>
  {/* hide old */} <div className="hidden">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Encrypted Memory Universe Active</span>
            <span className="text-white/20">|</span>
            </div>

          {/* Clock / date */}
          <div className="flex flex-col items-center space-y-1">
            <p className="font-mono text-5xl md:text-7xl font-extralight text-foreground tracking-widest tabular-nums">
              {timeStr}
            </p>
            <p className="text-muted-foreground text-xs tracking-[0.35em] uppercase font-medium">{dateStr}</p>
          </div>

          {/* Wordmark & Dynamic Greeting */}
          <div className="flex flex-col items-center space-y-2">
            <h2 className="text-xs font-mono tracking-[0.4em] uppercase text-primary font-medium">
              {greeting}, {visitorMode ? 'Friend' : 'Pranjal'}
            </h2>
            <h1 className="text-2xl md:text-4xl font-extralight tracking-[0.25em] uppercase text-foreground/90">
              <div className="relative group">
    <div className="absolute -inset-2 bg-gradient-to-r from-primary/20 to-blue-500/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
    <span className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Memory</span> Universe
  </div>
            </h1>
            <div className="flex items-center space-x-3 text-muted-foreground/30">
              <div className="w-8 h-px bg-current" />
              <span className="text-[10px] tracking-[0.4em] uppercase font-medium">Archival Ecosystem</span>
              <div className="w-8 h-px bg-current" />
            </div>
          </div>

          {/* Live stats */}
          {stats !== null && (
            <div className="flex items-center space-x-8 md:space-x-12">
              {[
                { value: stats.photoCount, label: "Memories" },
                ...(stats.peopleCount > 0 ? [{ value: stats.peopleCount, label: "People" }] : []),
                ...(stats.placesCount > 0 ? [{ value: stats.placesCount, label: "Places" }] : []),
              ].map((stat, i) => (
                <div key={i} className="flex flex-col items-center">
                  <span className="text-3xl md:text-4xl font-extralight text-foreground tabular-nums">
                    {stat.value}
                  </span>
                  <span className="text-[10px] text-muted-foreground tracking-[0.3em] uppercase mt-1">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Primary Actions */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
            <button
              onClick={() => setGenerateOpen(true)}
              className="flex items-center space-x-2 px-6 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/25"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate Memory</span>
            </button>
            <Link
              href="/gallery"
              className="flex items-center space-x-2 px-6 py-3 rounded-2xl bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-all shadow-lg shadow-white/5"
            >
              <Camera className="w-4 h-4" />
              <span>Live Camera &amp; Ingest</span>
            </Link>
            {hasContent && (
              <Link
                href="/timeline"
                className="flex items-center space-x-2 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-foreground text-sm font-medium hover:bg-white/10 transition-all backdrop-blur-sm"
              >
                <Calendar className="w-4 h-4 opacity-70" />
                <span>Explore Timeline</span>
              </Link>
            )}
          </div>

          {/* Quick Launch Hub */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-xs font-mono">
            <Link
              href="/puzzles"
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-muted-foreground hover:text-foreground transition-all flex items-center space-x-1.5"
            >
              <Gamepad2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Play Assemble Puzzle</span>
            </Link>
            <Link
              href="/meet"
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-muted-foreground hover:text-foreground transition-all flex items-center space-x-1.5"
            >
              <Video className="w-3.5 h-3.5 text-emerald-400" />
              <span>Encrypted Meet</span>
            </Link>
            <Link
              href="/make"
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-muted-foreground hover:text-foreground transition-all flex items-center space-x-1.5"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-sky-400" />
              <span>Creative Studio</span>
            </Link>
            <Link
              href="/search"
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-muted-foreground hover:text-foreground transition-all flex items-center space-x-1.5"
            >
              <Search className="w-3.5 h-3.5 text-primary" />
              <span>Search Universe</span>
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center space-y-2 text-muted-foreground/40">
          <ArrowRight className="w-4 h-4 rotate-90 animate-bounce" />
        </div>
      </section>
      <canvas ref={canvasRef} className="hidden" />

      {/* ── FEATURED PHOTO ────────────────────────────────────────── */}
      {hasContent && stats.latestPhoto && (
        <section className="px-6 md:px-10 py-16 max-w-7xl mx-auto w-full">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-[10px] tracking-[0.35em] text-muted-foreground uppercase mb-1">Latest Memory</p>
              <h2 className="text-2xl font-extralight tracking-wide">Most Recent</h2>
            </div>
            <Link href="/timeline" className="flex items-center space-x-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group">
              <span className="tracking-wider uppercase">View all</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {stats.recentPhotos.map((url, i) => (
              <Link
                href="/timeline"
                key={i}
                className={`group relative overflow-hidden rounded-xl bg-secondary/20 ${
                  i === 0 ? "col-span-2 row-span-2 aspect-square md:aspect-auto" : "aspect-square"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── ON THIS DAY / HISTORICAL FLASHBACK ──────────────────── */}
      <section className="px-6 md:px-10 py-6 max-w-7xl mx-auto w-full">
        <OnThisDay />
      </section>

      {/* ── NAVIGATION CARDS ──────────────────────────────────────── */}
      <section className="px-6 md:px-10 py-16 max-w-7xl mx-auto w-full">
        <div className="mb-10">
          <p className="text-[10px] tracking-[0.35em] text-muted-foreground uppercase mb-1">Navigate</p>
          <h2 className="text-2xl font-extralight tracking-wide">Your Universe</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {NAV_CARDS.map(card => (
            <Link
              key={card.href}
              href={card.href}
              className="group relative flex flex-col justify-between p-5 md:p-7 rounded-2xl border border-white/5 bg-card/40 hover:bg-card/80 hover:border-white/10 transition-all duration-300 overflow-hidden min-h-[140px]"
            >
              {/* Hover glow */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-white/3 to-transparent pointer-events-none" />

              <card.icon className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors duration-200 mb-auto" strokeWidth={1.25} />

              <div>
                <h3 className="text-sm font-medium tracking-wide text-foreground mb-1">{card.label}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{card.description}</p>
              </div>

              <ArrowRight className="absolute top-5 right-5 w-4 h-4 text-muted-foreground/0 group-hover:text-muted-foreground/60 translate-x-1 group-hover:translate-x-0 opacity-0 group-hover:opacity-100 transition-all duration-200" />
            </Link>
          ))}
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────── */}
      <footer className="mt-auto px-6 py-8 border-t border-white/5 text-center">
        <p className="text-[10px] text-muted-foreground/40 tracking-[0.3em] uppercase">
          Private · Local-First · Pranjal&apos;s Universe
        </p>
      </footer>

      {/* AI Memory Generator Modal */}
      <GenerateMemoryModal
        isOpen={generateOpen}
        onClose={() => setGenerateOpen(false)}
      />
    </main>
  );
}
