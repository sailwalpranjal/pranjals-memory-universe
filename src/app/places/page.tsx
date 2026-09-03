"use client";

import { useEffect, useState, useRef } from "react";
import {
  Loader2,
  MapPin,
  Compass,
  Navigation,
  Camera,
  Copy,
  Check,
  LayoutDashboard,
  X,
} from "lucide-react";
import Link from "next/link";
import Map, { Marker, Popup } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";

interface PlacePoint {
  id: string;
  lat: number;
  lng: number;
  city: string;
  country: string;
  url: string | null;
  filename: string | null;
  aiTitle?: string | null;
  make?: string | null;
  model?: string | null;
  capturedAt?: string | null;
  mimeType?: string;
}

interface CityCluster {
  city: string;
  country: string;
  lat: number;
  lng: number;
  photoCount: number;
  photos: PlacePoint[];
  latestDate: string | null;
}

export default function PlacesPage() {
  const [places, setPlaces] = useState<PlacePoint[]>([]);
  const [cities, setCities] = useState<CityCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"map" | "grid">("map");

  // Selected place for modal inspector
  const [selectedPlace, setSelectedPlace] = useState<PlacePoint | null>(null);
  const [copiedCoords, setCopiedCoords] = useState(false);

  // Active City filter
  const [activeCity, setActiveCity] = useState<string | null>(null);

  // Map viewstate
  const [viewState, setViewState] = useState({
    longitude: 139.6917,
    latitude: 35.6895,
    zoom: 2.5,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);

  useEffect(() => {
    fetch("/api/places")
      .then((res) => res.json())
      .then((data) => {
        if (data.places) setPlaces(data.places);
        if (data.cities) setCities(data.cities);
        if (data.places && data.places.length > 0) {
          setViewState({
            longitude: data.places[0].lng,
            latitude: data.places[0].lat,
            zoom: 4,
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSelectCity = (c: CityCluster) => {
    setActiveCity(c.city);
    setViewState({
      longitude: c.lng,
      latitude: c.lat,
      zoom: 10,
    });
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [c.lng, c.lat],
        zoom: 10,
        duration: 1500,
      });
    }
  };

  const copyCoordinates = (lat: number, lng: number) => {
    navigator.clipboard.writeText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  const mapStyle = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

  return (
    <main className="min-h-screen flex flex-col bg-background pb-20 md:pb-0">
      {/* ── HEADER (In normal flow, below navbar) ──────────────── */}
      <header className="flex-none pt-20 px-4 md:px-8 pb-4 border-b border-white/5 bg-background/90 backdrop-blur-xl z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-[10px] tracking-[0.35em] text-muted-foreground uppercase mb-1 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-primary" />
              <span>Geographic Cartography</span>
            </p>
            <h1 className="text-3xl font-extralight tracking-[0.12em] uppercase">Places</h1>
            <p className="text-muted-foreground text-xs mt-1">
              Interactive travel coordinates, GPS metadata, and location chronicles.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Badges */}
            <div className="flex items-center space-x-2 text-xs font-mono text-muted-foreground bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              <span>{places.length} Geotagged</span>
              <span>•</span>
              <span>{cities.length} Destinations</span>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10 text-xs">
              <button
                onClick={() => setViewMode("map")}
                className={`px-3 py-1 rounded-lg transition-all ${
                  viewMode === "map"
                    ? "bg-white text-zinc-950 font-medium shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Map View
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`px-3 py-1 rounded-lg transition-all ${
                  viewMode === "grid"
                    ? "bg-white text-zinc-950 font-medium shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Destinations
              </button>
            </div>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-32 space-y-3">
          <Loader2 className="w-7 h-7 animate-spin text-primary/70" />
          <p className="text-xs font-mono tracking-widest text-muted-foreground uppercase">
            Loading Cartographic Coordinates...
          </p>
        </div>
      ) : places.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 max-w-md mx-auto my-auto">
          <div className="p-4 rounded-3xl bg-white/5 border border-white/10 text-muted-foreground/40">
            <MapPin className="w-10 h-10" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-light text-foreground">No Geotagged Memories Yet</h3>
            <p className="text-xs text-muted-foreground">
              Photos with embedded GPS coordinates or manual location tags will automatically appear on your personal global map.
            </p>
          </div>
          <Link
            href="/gallery"
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
          >
            Import or Capture Memories
          </Link>
        </div>
      ) : viewMode === "grid" ? (
        /* ── DESTINATIONS GRID VIEW ────────────────────────────── */
        <div className="flex-1 max-w-7xl mx-auto px-4 md:px-8 py-8 w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cities.map((c) => (
              <div
                key={`${c.city}-${c.country}`}
                onClick={() => handleSelectCity(c)}
                className="group p-5 bg-zinc-900/40 border border-white/5 hover:border-primary/40 rounded-3xl cursor-pointer transition-all space-y-4 hover:shadow-2xl"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-light text-foreground group-hover:text-primary transition-colors">
                      {c.city}
                    </h3>
                    <p className="text-xs text-muted-foreground">{c.country}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono">
                    {c.photoCount} {c.photoCount === 1 ? "frame" : "frames"}
                  </span>
                </div>

                {/* City Photo Thumbnails */}
                <div className="grid grid-cols-3 gap-2">
                  {c.photos.slice(0, 3).map((p) => (
                    <div
                      key={p.id}
                      className="aspect-square rounded-xl overflow-hidden bg-black/40 border border-white/5"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url || ""} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 text-[10px] font-mono text-muted-foreground border-t border-white/5">
                  <span>{c.lat.toFixed(3)}°, {c.lng.toFixed(3)}°</span>
                  <span className="flex items-center space-x-1 text-primary group-hover:underline">
                    <span>View on Map</span>
                    <Navigation className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ── INTERACTIVE MAP VIEW WITH SIDEBAR ─────────────────── */
        <div className="flex-1 w-full relative flex flex-col md:flex-row overflow-hidden" style={{ minHeight: "calc(100vh - 120px)" }}>
          {/* Destination Quick-Select Sidebar on desktop */}
          <div className="w-full md:w-80 bg-zinc-950/80 backdrop-blur-md border-r border-white/5 p-4 flex flex-col z-20 md:h-auto overflow-y-auto max-h-56 md:max-h-none shrink-0">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
              <Navigation className="w-3 h-3 text-primary" />
              <span>Travel Directory</span>
            </span>

            <div className="space-y-2">
              {cities.map((c) => (
                <button
                  key={`${c.city}-${c.country}`}
                  onClick={() => handleSelectCity(c)}
                  className={`w-full p-3 rounded-2xl text-left border transition-all flex items-center justify-between ${
                    activeCity === c.city
                      ? "bg-primary/15 border-primary/40 text-foreground"
                      : "bg-white/5 border-white/5 text-muted-foreground hover:text-foreground hover:bg-white/[0.08]"
                  }`}
                >
                  <div>
                    <p className="text-xs font-medium text-foreground">{c.city}</p>
                    <p className="text-[10px] text-muted-foreground">{c.country}</p>
                  </div>
                  <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    {c.photoCount}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Map Area */}
          <div className="flex-1 w-full h-full relative">
            <Map
              ref={mapRef}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              mapLib={maplibregl as any}
              {...viewState}
              onMove={(evt) => setViewState(evt.viewState)}
              mapStyle={mapStyle}
              style={{ width: "100%", height: "100%" }}
            >
              {places.map((place, i) => (
                <Marker
                  key={place.id + i}
                  longitude={place.lng}
                  latitude={place.lat}
                  anchor="bottom"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    setSelectedPlace(place);
                  }}
                >
                  <div className="group relative cursor-pointer transform transition-transform hover:scale-125 z-10">
                    <div className="w-9 h-9 rounded-full border-2 border-primary bg-zinc-950 overflow-hidden shadow-2xl flex items-center justify-center">
                      {place.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={place.url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <MapPin className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    {/* Hover tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-[9px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                      {place.city}
                    </div>
                  </div>
                </Marker>
              ))}

              {selectedPlace && (
                <Popup
                  longitude={selectedPlace.lng}
                  latitude={selectedPlace.lat}
                  anchor="top"
                  closeOnClick={false}
                  onClose={() => setSelectedPlace(null)}
                  className="z-50"
                  style={{ borderRadius: "1.25rem", overflow: "hidden" }}
                >
                  <div className="p-1 flex flex-col bg-zinc-950 text-foreground border border-white/10 rounded-2xl max-w-xs shadow-2xl space-y-2">
                    {selectedPlace.url && (
                      <div className="w-56 h-40 rounded-xl overflow-hidden bg-black">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={selectedPlace.url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="px-2 pb-1 space-y-1">
                      <p className="text-xs font-medium text-white truncate">
                        {selectedPlace.aiTitle || selectedPlace.filename}
                      </p>
                      <p className="text-[10px] text-primary font-mono">
                        {selectedPlace.city}, {selectedPlace.country}
                      </p>
                    </div>
                  </div>
                </Popup>
              )}
            </Map>
          </div>
        </div>
      )}

      {/* ── RICH PLACE INSPECTOR MODAL ────────────────────────── */}
      {selectedPlace && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => e.target === e.currentTarget && setSelectedPlace(null)}
        >
          <div className="w-full max-w-lg bg-zinc-950 border border-white/10 rounded-3xl p-6 space-y-5 shadow-2xl animate-fade-up">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                  Location Chronicle
                </span>
              </div>
              <button
                onClick={() => setSelectedPlace(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Photo Preview */}
            {selectedPlace.url && (
              <div className="relative aspect-[16/10] rounded-2xl overflow-hidden bg-black border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedPlace.url} alt="" className="w-full h-full object-contain" />
              </div>
            )}

            {/* Metadata Grid */}
            <div className="space-y-3">
              <div>
                <h3 className="text-lg font-light text-foreground">
                  {selectedPlace.aiTitle || selectedPlace.filename}
                </h3>
                <p className="text-xs text-primary font-medium">
                  {selectedPlace.city}, {selectedPlace.country}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* Coordinates */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground uppercase">
                    <span>GPS Coordinates</span>
                    <button
                      onClick={() => copyCoordinates(selectedPlace.lat, selectedPlace.lng)}
                      className="hover:text-foreground text-primary flex items-center space-x-0.5"
                    >
                      {copiedCoords ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <p className="font-mono text-[11px] text-white">
                    {selectedPlace.lat.toFixed(5)}°, {selectedPlace.lng.toFixed(5)}°
                  </p>
                </div>

                {/* Date */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase block">
                    Capture Timestamp
                  </span>
                  <p className="text-[11px] text-white">
                    {selectedPlace.capturedAt
                      ? new Date(selectedPlace.capturedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "Preserved"}
                  </p>
                </div>

                {/* Camera Hardware if available */}
                {selectedPlace.make && (
                  <div className="col-span-2 p-3 rounded-xl bg-white/5 border border-white/5 flex items-center space-x-2 text-[11px] text-muted-foreground">
                    <Camera className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Captured on {selectedPlace.make} {selectedPlace.model || ""}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Link
                href="/make"
                onClick={() => setSelectedPlace(null)}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-all flex items-center justify-center space-x-1.5 shadow-lg shadow-primary/20"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Open in Studio</span>
              </Link>
              <button
                onClick={() => setSelectedPlace(null)}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-foreground text-xs font-medium transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
