"use client";

import { useState, useEffect } from "react";
import {
  Video,
  Calendar,
  Clock,
  Plus,
  Link as LinkIcon,
  Check,
  Loader2,
  Users,
  MessageSquare,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface PersonOption {
  id: string;
  name: string;
}

interface MeetingItem {
  id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  status: "scheduled" | "live" | "completed";
  notes?: string | null;
  people?: {
    id: string;
    name: string;
  } | null;
}

export default function MeetPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [loading, setLoading] = useState(true);

  // New Meeting Modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [duration, setDuration] = useState(30);
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Copy link feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchMeetings = async () => {
    try {
      const res = await fetch("/api/meetings");
      const data = await res.json();
      if (data.meetings) setMeetings(data.meetings);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPeople = async () => {
    try {
      const res = await fetch("/api/people");
      const data = await res.json();
      if (data.people) setPeople(data.people);
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    fetchMeetings();
    fetchPeople();
  }, []);

  // Instant Meeting
  const startInstantMeeting = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Instant Gathering",
          duration_minutes: 45,
          scheduled_at: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (data.meeting?.id) {
        router.push(`/meet/${data.meeting.id}`);
      }
    } catch {
      alert("Failed to start instant meeting");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMeeting = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to permanently delete this meeting session?")) return;
    try {
      const res = await fetch(`/api/meetings/${id}`, { method: "DELETE" });
      if (res.ok) {
        setMeetings((prev) => prev.filter((m) => m.id !== id));
      } else {
        alert("Failed to delete meeting.");
      }
    } catch {
      alert("Error deleting meeting.");
    }
  };

  // Schedule Meeting
  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          person_id: selectedPersonId || null,
          scheduled_at: scheduledAt || new Date().toISOString(),
          duration_minutes: duration,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) throw new Error("Scheduling failed");

      setShowScheduleModal(false);
      setTitle("");
      setScheduledAt("");
      setNotes("");
      setSelectedPersonId("");
      fetchMeetings();
    } catch {
      alert("Failed to schedule meeting");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyRoomLink = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/meet/${id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <main className="min-h-screen max-w-7xl mx-auto px-4 md:px-10 py-8 pb-32">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 pb-6 border-b border-white/5">
        <div>
          <p className="text-[10px] tracking-[0.35em] text-muted-foreground uppercase mb-2">
            Private Communication
          </p>
          <h1 className="text-3xl font-extralight tracking-[0.12em] uppercase">Private Meetings</h1>
          <p className="text-muted-foreground text-sm mt-1.5">
            Encrypted audio, video, and text sessions connected directly to people and memories in your Universe.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowScheduleModal(true)}
            className="flex items-center space-x-1.5 px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-foreground border border-white/10 text-xs font-medium transition-all"
          >
            <Calendar className="w-3.5 h-3.5 text-primary" />
            <span>Schedule Room</span>
          </button>

          <button
            onClick={startInstantMeeting}
            disabled={isSubmitting}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Video className="w-3.5 h-3.5" />
            )}
            <span>Start Instant Room</span>
          </button>
        </div>
      </header>

      {/* Content Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground flex items-center space-x-2">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span>Rooms & Sessions ({meetings.length})</span>
          </h2>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
            <p className="text-[10px] tracking-[0.35em] text-muted-foreground uppercase">
              Loading rooms
            </p>
          </div>
        ) : meetings.length === 0 ? (
          <div className="py-24 border border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center text-center space-y-4">
            <Video className="w-10 h-10 opacity-10" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">No meetings scheduled yet</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Start an instant session or schedule a private room linked with someone from your People archive.
              </p>
            </div>
            <button
              onClick={startInstantMeeting}
              className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs text-white font-medium"
            >
              Start First Room
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {meetings.map((m) => {
              const dateObj = new Date(m.scheduled_at);
              return (
                <div
                  key={m.id}
                  className="p-5 bg-zinc-900/50 border border-white/5 hover:border-white/15 rounded-3xl transition-all space-y-4 group relative"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-primary">
                        {m.status === "live" ? "Live Now" : m.status}
                      </span>
                      <h3 className="text-base font-medium text-foreground">{m.title}</h3>
                    </div>

                    <button
                      onClick={(e) => copyRoomLink(m.id, e)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground border border-white/5 text-xs transition-all"
                      title="Copy invite link"
                    >
                      {copiedId === m.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <LinkIcon className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <div className="space-y-2 text-xs text-muted-foreground border-t border-white/5 pt-3">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground/60" />
                      <span>
                        {dateObj.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span>•</span>
                      <span>
                        {dateObj.toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {m.people && (
                      <div className="flex items-center space-x-2 text-foreground/80">
                        <Users className="w-3.5 h-3.5 text-primary" />
                        <span>With {m.people.name}</span>
                      </div>
                    )}

                    {m.notes && (
                      <div className="flex items-start space-x-2 text-muted-foreground/80 pt-1">
                        <MessageSquare className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
                        <p className="line-clamp-2 italic">{m.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex items-center space-x-2">
                    <Link
                      href={`/meet/${m.id}`}
                      className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-primary hover:text-primary-foreground text-foreground text-xs font-medium transition-all flex items-center justify-center space-x-2"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Join Room</span>
                    </Link>
                    <button
                      onClick={(e) => handleDeleteMeeting(m.id, e)}
                      className="p-2.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-muted-foreground hover:text-rose-400 border border-white/5 hover:border-rose-500/30 transition-all"
                      title="Permanently Delete Meeting"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Schedule Meeting Modal */}
      {showScheduleModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setShowScheduleModal(false)}
        >
          <div className="w-full max-w-md bg-zinc-950 border border-white/10 rounded-3xl p-6 space-y-6 shadow-2xl animate-fade-up">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-medium uppercase tracking-wider text-foreground flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span>Schedule Private Session</span>
              </h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Session Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Catch up on travels"
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-foreground focus:outline-none focus:border-primary/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-foreground focus:outline-none focus:border-primary/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Duration (mins)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="180"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-foreground focus:outline-none focus:border-primary/50"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center space-x-1">
                  <Users className="w-3 h-3 text-primary" />
                  <span>Connect with Person (Optional)</span>
                </label>
                <select
                  value={selectedPersonId}
                  onChange={(e) => setSelectedPersonId(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-white/10 rounded-xl text-xs text-foreground focus:outline-none focus:border-primary/50"
                >
                  <option value="">No person attached</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Agenda / Memory Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes or topics to discuss..."
                  className="w-full px-3.5 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-foreground focus:outline-none focus:border-primary/50 resize-none"
                />
              </div>

              <div className="pt-2">
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
                  <span>Create Session Room</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
