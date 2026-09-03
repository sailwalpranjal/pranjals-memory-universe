"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  User,
  Search,
  Loader2,
  Edit2,
  Check,
  X,
  Plus,
  Merge,
  Sparkles,
  Layers,
  ChevronRight,
} from "lucide-react";
import FaceAvatar from "@/components/FaceAvatar";

interface Person {
  id: string;
  name: string;
  photoCount: number;
  faceCount: number;
  coverPhotoUrl: string | null;
  boundingBox: unknown;
  lastSeen: string | null;
  createdAt?: string;
}

interface UnassignedFace {
  id: string;
  photo_id: string;
  photoUrl: string | null;
  boundingBox: unknown;
  filename?: string | null;
  capturedAt?: string | null;
}

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [unassignedFaces, setUnassignedFaces] = useState<UnassignedFace[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Merge Mode state
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [targetPersonId, setTargetPersonId] = useState<string>("");
  const [isMerging, setIsMerging] = useState(false);

  // Inline Rename state
  const [renamingPersonId, setRenamingPersonId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);

  // Assign Face Modal state
  const [identifyingFace, setIdentifyingFace] = useState<UnassignedFace | null>(null);
  const [assignMode, setAssignMode] = useState<"existing" | "new">("existing");
  const [selectedAssignPersonId, setSelectedAssignPersonId] = useState<string>("");
  const [newPersonNameInput, setNewPersonNameInput] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);

  // Direct Create Person modal state
  const [showCreatePersonModal, setShowCreatePersonModal] = useState(false);
  const [createPersonName, setCreatePersonName] = useState("");
  const [isCreatingPerson, setIsCreatingPerson] = useState(false);

  // Fetch people and unassigned faces
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/people");
      const data = await res.json();
      if (data.people) setPeople(data.people);
      if (data.unassignedFaces) setUnassignedFaces(data.unassignedFaces);
    } catch (err) {
      console.error("Failed to load people:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter people by search query
  const filteredPeople = useMemo(() => {
    if (!searchQuery.trim()) return people;
    const query = searchQuery.toLowerCase();
    return people.filter((p) => p.name.toLowerCase().includes(query));
  }, [people, searchQuery]);

  // Handle merge selection toggle
  const togglePersonSelection = (id: string) => {
    setSelectedPersonIds((prev) => {
      let next: string[];
      if (prev.includes(id)) {
        next = prev.filter((pId) => pId !== id);
      } else {
        next = [...prev, id];
      }

      // Automatically set target person if not selected or invalid
      if (next.length > 0 && (!targetPersonId || !next.includes(targetPersonId))) {
        setTargetPersonId(next[0]);
      }
      return next;
    });
  };

  // Execute Merge
  const handleExecuteMerge = async () => {
    if (selectedPersonIds.length < 2 || !targetPersonId) return;

    const sourceIds = selectedPersonIds.filter((id) => id !== targetPersonId);
    if (sourceIds.length === 0) return;

    setIsMerging(true);
    try {
      const res = await fetch("/api/people/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetPersonId,
          sourcePersonIds: sourceIds,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to merge people");
      }

      // Reset selection and reload data
      setSelectedPersonIds([]);
      setTargetPersonId("");
      setMergeMode(false);
      await fetchData();
    } catch (err) {
      console.error("Merge error:", err);
      alert(err instanceof Error ? err.message : "Merge failed");
    } finally {
      setIsMerging(false);
    }
  };

  // Start Inline Rename
  const handleStartRename = (e: React.MouseEvent, person: Person) => {
    e.preventDefault();
    e.stopPropagation();
    setRenamingPersonId(person.id);
    setRenameValue(person.name);
  };

  // Submit Inline Rename
  const handleSaveRename = async (e: React.FormEvent | React.MouseEvent, personId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!renameValue.trim()) return;

    setIsSavingName(true);
    try {
      const res = await fetch(`/api/people/${personId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });

      if (!res.ok) throw new Error("Failed to rename person");

      // Update local state immediately
      setPeople((prev) =>
        prev.map((p) => (p.id === personId ? { ...p, name: renameValue.trim() } : p))
      );
      setRenamingPersonId(null);
    } catch (err) {
      console.error("Rename error:", err);
      alert("Failed to update name");
    } finally {
      setIsSavingName(false);
    }
  };

  // Submit Face Assignment
  const handleAssignFace = async () => {
    if (!identifyingFace) return;

    if (assignMode === "existing" && !selectedAssignPersonId) {
      alert("Please select a person to assign this face to.");
      return;
    }

    if (assignMode === "new" && !newPersonNameInput.trim()) {
      alert("Please enter a name for the new person.");
      return;
    }

    setIsAssigning(true);
    try {
      const payload: { faceId: string; personId?: string; newPersonName?: string } = {
        faceId: identifyingFace.id,
      };

      if (assignMode === "existing") {
        payload.personId = selectedAssignPersonId;
      } else {
        payload.newPersonName = newPersonNameInput.trim();
      }

      const res = await fetch("/api/people/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to assign face");

      // Close modal and refresh
      setIdentifyingFace(null);
      setNewPersonNameInput("");
      setSelectedAssignPersonId("");
      await fetchData();
    } catch (err) {
      console.error("Assign error:", err);
      alert("Failed to assign face. Please try again.");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleDirectCreatePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createPersonName.trim()) return;
    setIsCreatingPerson(true);
    try {
      const res = await fetch("/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createPersonName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create person");
      setShowCreatePersonModal(false);
      setCreatePersonName("");
      await fetchData();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Error creating person");
    } finally {
      setIsCreatingPerson(false);
    }
  };

  return (
    <main className="min-h-screen p-6 md:p-10 max-w-7xl mx-auto flex flex-col space-y-10 pb-32">
      {/* Header & Controls */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-light tracking-wider uppercase text-foreground">
              People
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              {people.length} {people.length === 1 ? "Person" : "People"}
            </span>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Facial recognition and social relationships across your memories.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowCreatePersonModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Person</span>
          </button>

          {people.length > 1 && (
            <button
              onClick={() => {
                setMergeMode(!mergeMode);
                setSelectedPersonIds([]);
              }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                mergeMode
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/50"
              }`}
            >
              <Merge className="w-4 h-4" />
              <span>{mergeMode ? "Cancel Merge" : "Merge People"}</span>
            </button>
          )}

          <Link
            href="/gallery"
            className="flex items-center space-x-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-foreground border border-white/10 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4 text-muted-foreground" />
            <span>Add Memories</span>
          </Link>
        </div>
      </header>

      {/* Search and Filters Bar */}
      {people.length > 0 && (
        <div className="flex items-center space-x-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search people by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-secondary/30 border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="w-full flex flex-col items-center justify-center py-24 space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Discovering people in your universe...</p>
        </div>
      ) : people.length === 0 && unassignedFaces.length === 0 ? (
        <div className="w-full text-center py-20 bg-secondary/10 border border-dashed border-border/60 rounded-3xl flex flex-col items-center space-y-5">
          <div className="p-4 rounded-full bg-secondary/30 text-muted-foreground">
            <Users className="w-12 h-12 opacity-40" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-medium">No people detected yet</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Upload photographs containing faces. Our client-side ML engine will detect faces and
              organize them into social profiles.
            </p>
          </div>
          <Link
            href="/gallery"
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
          >
            Upload Photos
          </Link>
        </div>
      ) : (
        <div className="flex flex-col space-y-12">
          {/* Identified People Grid */}
          {filteredPeople.length > 0 && (
            <section className="flex flex-col space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-light tracking-wide text-foreground flex items-center space-x-2">
                  <span>Identified Profiles</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">
                    {filteredPeople.length}
                  </span>
                </h2>
                {mergeMode && (
                  <p className="text-xs text-amber-400 font-medium">
                    Select 2 or more profiles to merge together
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                {filteredPeople.map((person) => {
                  const isSelected = selectedPersonIds.includes(person.id);
                  const isRenaming = renamingPersonId === person.id;

                  return (
                    <div
                      key={person.id}
                      onClick={() => {
                        if (mergeMode) {
                          togglePersonSelection(person.id);
                        }
                      }}
                      className={`group relative flex flex-col items-center p-4 rounded-2xl bg-card border transition-all ${
                        mergeMode
                          ? isSelected
                            ? "border-primary ring-2 ring-primary/40 bg-primary/5 cursor-pointer"
                            : "border-border/60 hover:border-primary/50 cursor-pointer"
                          : "border-border/40 hover:border-border hover:shadow-lg bg-card/60"
                      }`}
                    >
                      {/* Merge Mode Checkbox */}
                      {mergeMode && (
                        <div
                          className={`absolute top-3 right-3 w-5 h-5 rounded-full border flex items-center justify-center transition-colors z-10 ${
                            isSelected
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground/40 bg-background/80"
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      )}

                      {/* Face Avatar */}
                      {mergeMode ? (
                        <div className="my-2">
                          <FaceAvatar
                            photoUrl={person.coverPhotoUrl}
                            box={person.boundingBox as unknown as undefined}
                            size={100}
                            alt={person.name}
                            className="shadow-md transition-transform group-hover:scale-105"
                          />
                        </div>
                      ) : (
                        <Link href={`/people/${person.id}`} className="my-2 block">
                          <FaceAvatar
                            photoUrl={person.coverPhotoUrl}
                            box={person.boundingBox as unknown as undefined}
                            size={100}
                            alt={person.name}
                            className="shadow-md transition-transform group-hover:scale-105"
                          />
                        </Link>
                      )}

                      {/* Name & Details */}
                      <div className="w-full text-center mt-2 flex flex-col items-center">
                        {isRenaming ? (
                          <form
                            onSubmit={(e) => handleSaveRename(e, person.id)}
                            className="w-full flex items-center space-x-1 mt-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              autoFocus
                              className="w-full px-2 py-1 bg-background border border-primary rounded-lg text-xs font-medium focus:outline-none"
                            />
                            <button
                              type="submit"
                              disabled={isSavingName}
                              className="p-1 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                              title="Save"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setRenamingPersonId(null)}
                              className="p-1 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80"
                              title="Cancel"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </form>
                        ) : (
                          <div className="flex items-center justify-center space-x-1.5 w-full group/name">
                            {mergeMode ? (
                              <span className="font-medium text-sm text-foreground truncate max-w-[120px]">
                                {person.name}
                              </span>
                            ) : (
                              <Link
                                href={`/people/${person.id}`}
                                className="font-medium text-sm text-foreground truncate max-w-[110px] hover:text-primary transition-colors"
                              >
                                {person.name}
                              </Link>
                            )}

                            {!mergeMode && (
                              <button
                                onClick={(e) => handleStartRename(e, person)}
                                className="opacity-0 group-hover/name:opacity-100 p-1 text-muted-foreground hover:text-foreground transition-opacity"
                                title="Rename"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}

                        <span className="text-xs text-muted-foreground mt-0.5">
                          {person.photoCount} {person.photoCount === 1 ? "memory" : "memories"}
                        </span>
                      </div>

                      {/* Detail Link Badge when not in merge mode */}
                      {!mergeMode && !isRenaming && (
                        <Link
                          href={`/people/${person.id}`}
                          className="mt-3 flex items-center space-x-1 text-[11px] text-muted-foreground hover:text-primary transition-colors py-0.5 px-2 rounded-md hover:bg-secondary/40"
                        >
                          <span>View profile</span>
                          <ChevronRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Unassigned Faces Section */}
          {unassignedFaces.length > 0 && (
            <section className="flex flex-col space-y-5 pt-6 border-t border-border/40">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-xl font-light tracking-wide text-foreground flex items-center space-x-2">
                    <span>Unassigned Face Detections</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                      {unassignedFaces.length}
                    </span>
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Faces detected in your memories waiting to be assigned to a person profile.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {unassignedFaces.map((uFace) => (
                  <div
                    key={uFace.id}
                    className="flex flex-col items-center p-3 rounded-2xl bg-secondary/20 border border-border/40 space-y-3"
                  >
                    <FaceAvatar
                      photoUrl={uFace.photoUrl}
                      box={uFace.boundingBox as unknown as undefined}
                      size={90}
                      alt="Unassigned face"
                      className="shadow-sm"
                    />

                    <div className="w-full text-center">
                      <button
                        onClick={() => {
                          setIdentifyingFace(uFace);
                          setAssignMode(people.length > 0 ? "existing" : "new");
                          if (people.length > 0) setSelectedAssignPersonId(people[0].id);
                        }}
                        className="w-full py-1.5 px-3 bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/30 rounded-xl text-xs font-medium transition-all flex items-center justify-center space-x-1.5"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Identify</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Sticky Bottom Merge Bar */}
      {mergeMode && selectedPersonIds.length >= 2 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="bg-card/95 backdrop-blur-md border border-primary/40 shadow-2xl rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Merge {selectedPersonIds.length} Profiles
                </p>
                <div className="flex items-center space-x-1 text-xs text-muted-foreground mt-0.5">
                  <span>Keep as:</span>
                  <select
                    value={targetPersonId}
                    onChange={(e) => setTargetPersonId(e.target.value)}
                    className="bg-secondary/60 border border-border/60 rounded-md px-1.5 py-0.5 text-xs text-foreground focus:outline-none"
                  >
                    {selectedPersonIds.map((id) => {
                      const p = people.find((item) => item.id === id);
                      return (
                        <option key={id} value={id}>
                          {p?.name || "Person"} ({p?.photoCount} photos)
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  setMergeMode(false);
                  setSelectedPersonIds([]);
                }}
                className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteMerge}
                disabled={isMerging}
                className="flex-1 sm:flex-none px-5 py-2 rounded-xl text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center space-x-2 shadow-md disabled:opacity-50"
              >
                {isMerging ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Merge className="w-4 h-4" />
                )}
                <span>Confirm Merge</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Identify / Assign Face Modal Dialog */}
      {identifyingFace && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="bg-card border border-border/80 shadow-2xl rounded-3xl w-full max-w-md p-6 flex flex-col space-y-6 relative animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <div className="flex items-center space-x-2">
                <User className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-medium">Identify Face</h3>
              </div>
              <button
                onClick={() => setIdentifyingFace(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Face Preview */}
            <div className="flex flex-col items-center justify-center space-y-2 py-2">
              <FaceAvatar
                photoUrl={identifyingFace.photoUrl}
                box={identifyingFace.boundingBox as unknown as undefined}
                size={120}
                className="ring-4 ring-primary/20 shadow-lg"
              />
              <p className="text-xs text-muted-foreground">Detected Face</p>
            </div>

            {/* Mode Selection Tabs */}
            <div className="flex p-1 bg-secondary/40 rounded-xl border border-border/50">
              <button
                type="button"
                onClick={() => setAssignMode("existing")}
                disabled={people.length === 0}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  assignMode === "existing"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                } ${people.length === 0 && "opacity-40 cursor-not-allowed"}`}
              >
                Existing Person
              </button>
              <button
                type="button"
                onClick={() => setAssignMode("new")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  assignMode === "new"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Create New Profile
              </button>
            </div>

            {/* Mode Form Fields */}
            {assignMode === "existing" && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Select Person Profile
                </label>
                <select
                  value={selectedAssignPersonId}
                  onChange={(e) => setSelectedAssignPersonId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-secondary/30 border border-border/60 rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="" disabled>
                    -- Choose Person --
                  </option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.photoCount} {p.photoCount === 1 ? "photo" : "photos"})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {assignMode === "new" && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Person Name</label>
                <input
                  type="text"
                  placeholder="e.g. Alex, Maya, Uncle John..."
                  value={newPersonNameInput}
                  onChange={(e) => setNewPersonNameInput(e.target.value)}
                  autoFocus
                  className="w-full px-3 py-2.5 bg-secondary/30 border border-border/60 rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIdentifyingFace(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssignFace}
                disabled={isAssigning}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center space-x-2 shadow-md disabled:opacity-50"
              >
                {isAssigning && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Save & Assign</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE PERSON PROFILE MODAL ───────────────────────── */}
      {showCreatePersonModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => e.target === e.currentTarget && setShowCreatePersonModal(false)}
        >
          <div className="w-full max-w-md bg-zinc-950 border border-white/10 rounded-3xl p-6 space-y-6 shadow-2xl animate-fade-up">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                  New Person Profile
                </span>
              </div>
              <button
                onClick={() => setShowCreatePersonModal(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDirectCreatePerson} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Person&apos;s Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Rahul, Pranjal, Mom, Maya..."
                  value={createPersonName}
                  onChange={(e) => setCreatePersonName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-foreground focus:outline-none focus:border-primary/50"
                />
                <p className="text-[11px] text-muted-foreground">
                  Once created, you can associate photos, 4K clips, and voice notes with this person from any memory or face detection.
                </p>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreatePersonModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-foreground transition-colors border border-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingPerson || !createPersonName.trim()}
                  className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all flex items-center justify-center space-x-1.5 shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  {isCreatingPerson ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Create Profile</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
