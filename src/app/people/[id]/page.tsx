"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Camera,
  ChevronRight,
  Edit2,
  Check,
  X,
  Loader2,
  MapPin,
  Sparkles,
  Trash2,
  User,
  Users,
  Image as ImageIcon,
} from "lucide-react";
import Map, { Marker, Popup } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";
import FaceAvatar from "@/components/FaceAvatar";

interface PhotoItem {
  id: string;
  storage_path: string;
  url: string | null;
  original_filename?: string;
  captured_at?: string | null;
  imported_at?: string | null;
  width?: number | null;
  height?: number | null;
  faceBox?: unknown;
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

interface Companion {
  id: string;
  name: string;
  sharedPhotoCount: number;
  coverPhotoUrl: string | null;
  boundingBox: unknown;
}

interface VisitedPlace {
  id: string;
  photo_id: string;
  lat: number;
  lng: number;
  city?: string | null;
  country?: string | null;
  photoUrl?: string | null;
  captured_at?: string | null;
  original_filename?: string | null;
}

interface PersonDetail {
  id: string;
  name: string;
  cover_photo_id: string | null;
  coverPhotoUrl: string | null;
  boundingBox: unknown;
  created_at: string;
  photoCount: number;
  faceCount: number;
  firstSeen: string | null;
  lastSeen: string | null;
}

export default function PersonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const personId = params.id as string;

  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [places, setPlaces] = useState<VisitedPlace[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Name State
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);

  // Delete State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Lightbox Modal
  const [activeLightboxPhoto, setActiveLightboxPhoto] = useState<PhotoItem | null>(null);

  // Map Selected Place
  const [selectedMapPlace, setSelectedMapPlace] = useState<VisitedPlace | null>(null);

  useEffect(() => {
    if (!personId) return;

    setLoading(true);
    fetch(`/api/people/${personId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Person not found");
        return res.json();
      })
      .then((data) => {
        if (data.person) setPerson(data.person);
        if (data.photos) setPhotos(data.photos);
        if (data.companions) setCompanions(data.companions);
        if (data.places) setPlaces(data.places);
      })
      .catch((err) => {
        console.error("Failed to load person:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [personId]);

  // Handle Name Save
  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editNameValue.trim() || !person) return;

    setIsSavingName(true);
    try {
      const res = await fetch(`/api/people/${person.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editNameValue.trim() }),
      });

      if (!res.ok) throw new Error("Failed to update name");

      setPerson((prev) => (prev ? { ...prev, name: editNameValue.trim() } : prev));
      setIsEditingName(false);
    } catch (err) {
      console.error(err);
      alert("Failed to update name. Please try again.");
    } finally {
      setIsSavingName(false);
    }
  };

  // Handle Person Delete
  const handleDeletePerson = async () => {
    if (!person) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/people/${person.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete person");

      router.push("/people");
    } catch (err) {
      console.error(err);
      alert("Failed to delete person.");
      setIsDeleting(false);
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return "N/A";
    try {
      return new Date(isoString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  const mapStyle = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading person memories...</p>
      </main>
    );
  }

  if (!person) {
    return (
      <main className="min-h-screen p-8 max-w-4xl mx-auto flex flex-col items-center justify-center space-y-6">
        <User className="w-16 h-16 text-muted-foreground opacity-30" />
        <h2 className="text-xl font-medium">Person not found</h2>
        <Link
          href="/people"
          className="flex items-center space-x-2 px-4 py-2 bg-secondary rounded-xl text-sm font-medium hover:bg-secondary/80 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to People</span>
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 md:p-10 max-w-7xl mx-auto flex flex-col space-y-12 pb-32">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/people"
          className="flex items-center space-x-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Back to People</span>
        </Link>

        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors border border-destructive/20"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Profile</span>
        </button>
      </div>

      {/* Profile Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-secondary/40 to-card/60 border border-border/60 p-6 md:p-10 backdrop-blur-md shadow-xl">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
          {/* Large Face Avatar */}
          <div className="relative">
            <FaceAvatar
              photoUrl={person.coverPhotoUrl}
              box={person.boundingBox as unknown as undefined}
              size={140}
              alt={person.name}
              className="ring-4 ring-primary/20 shadow-2xl"
            />
          </div>

          {/* Person Info */}
          <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left space-y-4">
            <div className="flex items-center space-x-3">
              {isEditingName ? (
                <form onSubmit={handleSaveName} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={editNameValue}
                    onChange={(e) => setEditNameValue(e.target.value)}
                    autoFocus
                    className="px-3 py-1.5 bg-background border border-primary rounded-xl text-2xl font-light focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isSavingName}
                    className="p-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {isSavingName ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingName(false)}
                    className="p-2 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <div className="flex items-center space-x-3 group">
                  <h1 className="text-3xl md:text-4xl font-light tracking-wide text-foreground">
                    {person.name}
                  </h1>
                  <button
                    onClick={() => {
                      setEditNameValue(person.name);
                      setIsEditingName(true);
                    }}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors opacity-70 group-hover:opacity-100"
                    title="Rename Profile"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Memory Statistics Badges */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs text-muted-foreground">
              <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-secondary/50 border border-border/40">
                <ImageIcon className="w-3.5 h-3.5 text-primary" />
                <span className="font-medium text-foreground">{photos.length}</span>
                <span>{photos.length === 1 ? "Memory" : "Memories"}</span>
              </div>

              {person.firstSeen && (
                <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-secondary/50 border border-border/40">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  <span>Earliest: {formatDate(person.firstSeen)}</span>
                </div>
              )}

              {person.lastSeen && (
                <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-secondary/50 border border-border/40">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  <span>Latest: {formatDate(person.lastSeen)}</span>
                </div>
              )}

              {places.length > 0 && (
                <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-secondary/50 border border-border/40">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  <span className="font-medium text-foreground">{places.length}</span>
                  <span>{places.length === 1 ? "Location" : "Locations"}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Frequently Appeared With (Companions) */}
      {companions.length > 0 && (
        <section className="flex flex-col space-y-4">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-light tracking-wide text-foreground">
              Frequently with {person.name}
            </h2>
          </div>

          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
            {companions.map((comp) => (
              <Link
                key={comp.id}
                href={`/people/${comp.id}`}
                className="flex items-center space-x-3 px-4 py-2.5 rounded-2xl bg-card border border-border/50 hover:border-primary/50 hover:bg-card/80 transition-all flex-shrink-0 shadow-sm group"
              >
                <FaceAvatar
                  photoUrl={comp.coverPhotoUrl}
                  box={comp.boundingBox as unknown as undefined}
                  size={42}
                  alt={comp.name}
                  className="ring-1 ring-border/80 group-hover:scale-105 transition-transform"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {comp.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {comp.sharedPhotoCount} shared{" "}
                    {comp.sharedPhotoCount === 1 ? "memory" : "memories"}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Visited Places Map */}
      {places.length > 0 && (
        <section className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MapPin className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-light tracking-wide text-foreground">
                Places Visited ({places.length})
              </h2>
            </div>
          </div>

          <div className="relative w-full h-80 rounded-3xl overflow-hidden border border-border/60 shadow-lg">
            <Map
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              mapLib={maplibregl as any}
              initialViewState={{
                longitude: places[0]?.lng ?? 0,
                latitude: places[0]?.lat ?? 20,
                zoom: places.length > 1 ? 4 : 8,
              }}
              mapStyle={mapStyle}
            >
              {places.map((place, idx) => (
                <Marker
                  key={place.id + idx}
                  longitude={place.lng}
                  latitude={place.lat}
                  anchor="bottom"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    setSelectedMapPlace(place);
                  }}
                >
                  <div className="w-9 h-9 rounded-full border-2 border-primary overflow-hidden cursor-pointer shadow-lg transform transition-transform hover:scale-115">
                    {place.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={place.photoUrl}
                        alt="Location pin"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-primary flex items-center justify-center text-primary-foreground">
                        <MapPin className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                </Marker>
              ))}

              {selectedMapPlace && (
                <Popup
                  longitude={selectedMapPlace.lng}
                  latitude={selectedMapPlace.lat}
                  anchor="top"
                  closeOnClick={false}
                  onClose={() => setSelectedMapPlace(null)}
                  className="z-50"
                  style={{ borderRadius: "1rem", overflow: "hidden" }}
                >
                  <div className="p-2 flex flex-col items-center bg-card text-card-foreground max-w-xs">
                    {selectedMapPlace.photoUrl && (
                      <div className="w-48 h-36 rounded-lg overflow-hidden mb-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={selectedMapPlace.photoUrl}
                          alt="Memory"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <span className="text-xs font-medium text-foreground">
                      {[selectedMapPlace.city, selectedMapPlace.country]
                        .filter(Boolean)
                        .join(", ") || "Geotagged Location"}
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDate(selectedMapPlace.captured_at)}
                    </span>
                  </div>
                </Popup>
              )}
            </Map>
          </div>
        </section>
      )}

      {/* Chronological Photo Gallery */}
      <section className="flex flex-col space-y-6">
        <div className="flex items-center justify-between border-b border-border/40 pb-4">
          <div className="flex items-center space-x-2">
            <Camera className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-light tracking-wide text-foreground">
              Memories with {person.name}
            </h2>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {photos.length} {photos.length === 1 ? "photo" : "photos"}
          </span>
        </div>

        {photos.length === 0 ? (
          <div className="w-full text-center py-16 bg-secondary/10 border border-dashed border-border/60 rounded-3xl flex flex-col items-center space-y-3">
            <ImageIcon className="w-10 h-10 text-muted-foreground opacity-30" />
            <p className="text-sm text-muted-foreground">No photos assigned to this person yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {photos.map((photo) => {
              const meta = photo.photo_metadata;
              const locationText = [meta?.city, meta?.country].filter(Boolean).join(", ");

              return (
                <div
                  key={photo.id}
                  onClick={() => setActiveLightboxPhoto(photo)}
                  className="group relative flex flex-col rounded-2xl overflow-hidden bg-card border border-border/50 hover:border-border/80 hover:shadow-xl transition-all cursor-pointer"
                >
                  {/* Photo Thumbnail */}
                  <div className="relative aspect-4/3 w-full bg-secondary/30 overflow-hidden">
                    {photo.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo.url}
                        alt={photo.original_filename || "Memory"}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <ImageIcon className="w-8 h-8 opacity-40" />
                      </div>
                    )}

                    {/* AI Tag / Location Badge Overlay */}
                    {locationText && (
                      <div className="absolute top-2.5 left-2.5 flex items-center space-x-1 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] text-white/90">
                        <MapPin className="w-3 h-3 text-primary" />
                        <span className="truncate max-w-[130px]">{locationText}</span>
                      </div>
                    )}
                  </div>

                  {/* Photo Metadata Card Footer */}
                  <div className="p-3.5 flex flex-col space-y-1.5">
                    {meta?.ai_title ? (
                      <p className="text-xs font-medium text-foreground line-clamp-1">
                        {meta.ai_title}
                      </p>
                    ) : (
                      <p className="text-xs font-medium text-muted-foreground truncate">
                        {photo.original_filename || "Memory"}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{formatDate(photo.captured_at || photo.imported_at)}</span>
                      {meta?.make && meta?.model && (
                        <span className="truncate max-w-[110px]">
                          {meta.make} {meta.model}
                        </span>
                      )}
                    </div>

                    {meta?.ai_tags && meta.ai_tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {meta.ai_tags.slice(0, 3).map((tag, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 rounded bg-secondary text-[9px] text-muted-foreground"
                          >
                            #{tag}
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

      {/* Lightbox Modal */}
      {activeLightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 md:p-8"
          onClick={() => setActiveLightboxPhoto(null)}
        >
          <div
            className="relative max-w-5xl max-h-[90vh] flex flex-col md:flex-row bg-card border border-border/80 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveLightboxPhoto(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Photo View */}
            <div className="flex-1 bg-black/40 flex items-center justify-center min-h-[300px] md:min-h-[500px]">
              {activeLightboxPhoto.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeLightboxPhoto.url}
                  alt={activeLightboxPhoto.original_filename || "Memory"}
                  className="max-h-[80vh] w-auto object-contain"
                />
              )}
            </div>

            {/* Photo Details Sidebar */}
            <div className="w-full md:w-80 p-6 flex flex-col space-y-5 overflow-y-auto bg-card">
              <div>
                <h3 className="text-base font-medium text-foreground">
                  {activeLightboxPhoto.photo_metadata?.ai_title ||
                    activeLightboxPhoto.original_filename ||
                    "Memory"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDate(
                    activeLightboxPhoto.captured_at || activeLightboxPhoto.imported_at
                  )}
                </p>
              </div>

              
              <div className="pt-2">
                <button
                  onClick={() => handleSetCoverPhoto(activeLightboxPhoto.id)}
                  disabled={isSettingCover}
                  className="w-full py-2 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-xl text-xs font-medium transition-colors flex items-center justify-center space-x-2"
                >
                  {isSettingCover ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <User className="w-3.5 h-3.5" />
                  )}
                  <span>Set as Profile Picture</span>
                </button>
              </div>

              {activeLightboxPhoto.photo_metadata?.ai_description && (
                <div className="space-y-1.5">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center space-x-1">
                    <Sparkles className="w-3 h-3 text-primary" />
                    <span>AI Narrative</span>
                  </span>
                  <p className="text-xs text-foreground/90 leading-relaxed">
                    {activeLightboxPhoto.photo_metadata.ai_description}
                  </p>
                </div>
              )}

              {/* Technical Metadata */}
              <div className="space-y-2 pt-2 border-t border-border/40 text-xs">
                {activeLightboxPhoto.photo_metadata?.city && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Location</span>
                    <span className="text-foreground font-medium">
                      {[
                        activeLightboxPhoto.photo_metadata.city,
                        activeLightboxPhoto.photo_metadata.country,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </div>
                )}

                {activeLightboxPhoto.photo_metadata?.make && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Camera</span>
                    <span className="text-foreground">
                      {activeLightboxPhoto.photo_metadata.make}{" "}
                      {activeLightboxPhoto.photo_metadata.model}
                    </span>
                  </div>
                )}

                {activeLightboxPhoto.width && activeLightboxPhoto.height && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Resolution</span>
                    <span className="text-foreground font-mono">
                      {activeLightboxPhoto.width} × {activeLightboxPhoto.height}
                    </span>
                  </div>
                )}
              </div>

              {activeLightboxPhoto.photo_metadata?.ai_tags &&
                activeLightboxPhoto.photo_metadata.ai_tags.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border/40">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Tags
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {activeLightboxPhoto.photo_metadata.ai_tags.map((tag, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-secondary text-[11px] text-secondary-foreground"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border/80 shadow-2xl rounded-3xl w-full max-w-md p-6 flex flex-col space-y-4">
            <h3 className="text-lg font-medium text-foreground">Delete Person Profile</h3>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete profile for <strong className="text-foreground">{person.name}</strong>?
              This will unassign all {photos.length} photos and face detections without deleting the actual photographs.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePerson}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 flex items-center space-x-2"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete Profile</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
  const handleSetCoverPhoto = async (photoId: string) => {
    if (!person) return;
    setIsSettingCover(true);
    try {
      const res = await fetch("/api/people/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoId: photoId,
          forceCoverPhotoPersonId: person.id
        })
      });
      if (res.ok) {
        setPerson(prev => prev ? { ...prev, cover_photo_id: photoId } : prev);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSettingCover(false);
    }
  };
  
  
