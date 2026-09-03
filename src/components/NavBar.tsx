"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Camera,
  Calendar,
  Users,
  MapPin,
  Search,
  LayoutDashboard,
  Sparkles,
  Settings,
  Video,
  Layers,
  Gamepad2,
  Menu,
  X,
  Compass,
} from "lucide-react";

export const NAV_ITEMS = [
  { href: "/gallery", label: "Capture", icon: Camera, desc: "Photos, 4K clips & voice memos" },
  { href: "/timeline", label: "Timeline", icon: Calendar, desc: "Chronological memory archive" },
  { href: "/people", label: "People", icon: Users, desc: "Face clusters & person tagging" },
  { href: "/places", label: "Places", icon: MapPin, desc: "Interactive travel map & GPS" },
  { href: "/meet", label: "Meet", icon: Video, desc: "Private video & audio sessions" },
  { href: "/collections", label: "Albums", icon: Layers, desc: "Curated smart photo albums" },
  { href: "/puzzles", label: "Puzzles", icon: Gamepad2, desc: "Jigsaw assemble & memory games" },
  { href: "/make", label: "Studio", icon: LayoutDashboard, desc: "Fine-art posters & collage canvas" },
  { href: "/search", label: "Search", icon: Search, desc: "Universal semantic archive lookup" },
  { href: "/lab", label: "Lab", icon: Sparkles, desc: "Archival science & forensic metrics" },
];

export default function NavBar() {
  const pathname = usePathname();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Strict session zero-persistence: Clear auth cookie on tab close/reload


  // Close mobile drawer on route transition
  useEffect(() => {
    setIsDrawerOpen(false);
  }, [pathname]);

  // Handle ESC key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsDrawerOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      {/* ── TOP NAV BAR (Desktop & Mobile Header) ───────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          {/* Brand Logo & Wordmark */}
          <Link
            href="/"
            className="flex items-center space-x-2 text-[11px] font-medium tracking-[0.28em] uppercase text-muted-foreground hover:text-foreground transition-colors group"
          >
            <Compass className="w-4 h-4 text-primary transition-transform group-hover:rotate-45" />
            <span className="font-light text-foreground">Pranjal&apos;s</span>
            <span className="text-muted-foreground">Universe</span>
          </Link>

          {/* Desktop Nav Links (Large screens) */}
          <div className="hidden lg:flex items-center space-x-0.5">
            {NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium tracking-wide transition-all duration-200 ${
                    isActive
                      ? "bg-white/10 text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}
                >
                  <item.icon
                    className={`w-3.5 h-3.5 transition-opacity ${
                      isActive ? "opacity-100 text-primary" : "opacity-60"
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center space-x-1">
            {/* Quick Search Shortcut */}
            <Link
              href="/search"
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
              aria-label="Universal Search"
            >
              <Search className="w-4 h-4" />
            </Link>

            {/* Settings */}
            <Link
              href="/settings"
              className={`p-2 rounded-xl transition-all ${
                pathname === "/settings"
                  ? "bg-white/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </Link>

            {/* Mobile Hamburger Drawer Toggle (Mobile & Tablet) */}
            <button
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
              className="lg:hidden p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
              aria-label="Toggle navigation menu"
            >
              {isDrawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* ── MOBILE SLIDE-OVER DRAWER (All 10 Tabs Accessible) ── */}
      {isDrawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-md animate-fade-in"
          onClick={(e) => e.target === e.currentTarget && setIsDrawerOpen(false)}
        >
          <div className="fixed top-0 right-0 bottom-0 w-full max-w-xs bg-zinc-950 border-l border-white/10 p-6 flex flex-col justify-between shadow-2xl animate-fade-left overflow-y-auto">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center space-x-2">
                  <Compass className="w-4 h-4 text-primary" />
                  <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    Navigation Menu
                  </span>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* All 10 Navigation Items */}
              <div className="space-y-1.5">
                {NAV_ITEMS.map((item) => {
                  const isActive =
                    pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsDrawerOpen(false)}
                      className={`flex items-start space-x-3 p-3 rounded-2xl transition-all ${
                        isActive
                          ? "bg-primary/15 border border-primary/30 text-foreground"
                          : "hover:bg-white/5 text-muted-foreground hover:text-foreground border border-transparent"
                      }`}
                    >
                      <item.icon
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          isActive ? "text-primary" : "opacity-70"
                        }`}
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-foreground">{item.label}</span>
                        <span className="text-[10px] text-muted-foreground">{item.desc}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Drawer Footer with Settings */}
            <div className="border-t border-white/10 pt-4 mt-6">
              <Link
                href="/settings"
                onClick={() => setIsDrawerOpen(false)}
                className="flex items-center space-x-2 p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-foreground text-xs font-medium transition-colors"
              >
                <Settings className="w-4 h-4 text-primary" />
                <span>Archive Maintenance & Settings</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE BOTTOM QUICK NAV (Quick Action Hub) ────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/5 bg-background/90 backdrop-blur-xl pb-safe">
        <div className="flex items-center justify-around px-2 py-2">
          {[
            { href: "/gallery", label: "Capture", icon: Camera },
            { href: "/timeline", label: "Timeline", icon: Calendar },
            { href: "/make", label: "Studio", icon: LayoutDashboard },
            { href: "/puzzles", label: "Puzzles", icon: Gamepad2 },
          ].map((item) => {
            const isActive =
              pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
                  isActive ? "text-primary font-medium" : "text-muted-foreground"
                }`}
              >
                <item.icon
                  className={`w-5 h-5 ${isActive ? "opacity-100" : "opacity-50"}`}
                  strokeWidth={isActive ? 2 : 1.5}
                />
                <span className="text-[9px] tracking-wider uppercase font-medium">{item.label}</span>
              </Link>
            );
          })}

          {/* More Menu Trigger */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-muted-foreground hover:text-foreground transition-all"
          >
            <Menu className="w-5 h-5 opacity-60" strokeWidth={1.5} />
            <span className="text-[9px] tracking-wider uppercase font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
