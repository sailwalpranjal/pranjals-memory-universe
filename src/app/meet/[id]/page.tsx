"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  PhoneOff,
  MessageSquare,
  Copy,
  Check,
  Send,
  Loader2,
  X,
  FileText,
  Edit3,
  Trash2,
  PictureInPicture,
  Puzzle, User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { useWebRTC } from "@/hooks/useWebRTC";

// Minimal Supabase client for signaling
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);


declare global {
  interface DocumentPictureInPicture {
    requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
  }
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

interface MeetingRoomData {
  id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  notes?: string | null;
  people?: {
    id: string;
    name: string;
    cover_photo_id?: string | null;
  } | null;
}

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
}

export default function MeetingRoomPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const roomId = params.id;

  const [meeting, setMeeting] = useState<MeetingRoomData | null>(null);
  const [loading, setLoading] = useState(true);

  // Media Controls
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const videoStageRef = useRef<HTMLDivElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
    const [userId] = useState(() => Math.random().toString(36).substring(7));
    const { remoteStreams, channel } = useWebRTC(params.id as string, supabase, stream, userId);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);

  // Puzzle State
  const [isPuzzleActive, setIsPuzzleActive] = useState(false);

  // Active Tab in Sidebar: chat | people | notes | details
  const [activeSidebar, setActiveSidebar] = useState<"chat" | "people" | "notes" | "details" | null>("chat");

  // Participant display identity
  const [displayName, setDisplayName] = useState("Pranjal");
  const [participants, setParticipants] = useState<Record<string, {name: string, isScreenSharing?: boolean}>>({});
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempNameInput, setTempNameInput] = useState("");

  // Professional notes & minutes
  const [meetingNotes, setMeetingNotes] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesSaveStatus, setNotesSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("pranjal_meet_display_name");
      if (stored) {
        setDisplayName(stored);
      } else {
        fetch("/api/auth/me").then(res => res.json()).then(data => {
          if (data.name) setDisplayName(data.name);
        });
      }
    }
  }, []);

  const handleUpdateDisplayName = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempNameInput.trim()) {
      setDisplayName(tempNameInput.trim());
      if (typeof window !== "undefined") {
        localStorage.setItem("pranjal_meet_display_name", tempNameInput.trim());
      }
    }
    setIsEditingName(false);
  };

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      const res = await fetch(`/api/meetings/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: meetingNotes }),
      });
      if (res.ok) {
        setNotesSaveStatus("Saved to Archive");
        setTimeout(() => setNotesSaveStatus(null), 2500);
      }
    } catch {
      setNotesSaveStatus("Save failed");
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleEndAndDelete = async () => {
    if (!confirm("Are you sure you want to permanently delete this meeting session?")) return;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    try {
      await fetch(`/api/meetings/${roomId}`, { method: "DELETE" });
    } catch {}
    router.push("/meet");
  };

  // In-Room Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      sender: "System",
      text: "Welcome to Pranjal's Private Session. Audio and video are active.",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [copiedLink, setCopiedLink] = useState(false);
  const [elapsedSecs, setElapsedSecs] = useState(0);

  
    const myInfoRef = useRef({ name: displayName, isScreenSharing });
  useEffect(() => {
    myInfoRef.current = { name: displayName, isScreenSharing };
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'user-info',
        payload: { userId, name: displayName, isScreenSharing }
      });
    }
  }, [channel, displayName, isScreenSharing, userId]);

  useEffect(() => {
    if (!channel) return;

    channel.on('broadcast', { event: 'user-info' }, ({ payload }) => {
      setParticipants(prev => ({
        ...prev,
        [payload.userId]: { name: payload.name, isScreenSharing: payload.isScreenSharing }
      }));
      // send mine back
      channel.send({
        type: 'broadcast',
        event: 'user-info-ack',
        payload: { userId, ...myInfoRef.current }
      });
    });

    channel.on('broadcast', { event: 'user-info-ack' }, ({ payload }) => {
      setParticipants(prev => ({
        ...prev,
        [payload.userId]: { name: payload.name, isScreenSharing: payload.isScreenSharing }
      }));
    });

    channel.on('broadcast', { event: 'chat-message' }, ({ payload }) => {
      setMessages(prev => [...prev, payload]);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    });

    // Note: channel cleanup is handled by useWebRTC
  }, [channel, userId]);

  // Fetch meeting details
  useEffect(() => {
    fetch(`/api/meetings/${roomId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.meeting) {
          setMeeting(data.meeting);
          if (data.meeting.notes) setMeetingNotes(data.meeting.notes);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [roomId]);

  // Meeting duration timer
  useEffect(() => {
    const timer = setInterval(() => setElapsedSecs((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const streamRef = useRef<MediaStream | null>(null);

  // WebRTC User Media
  const initMedia = useCallback(async () => {
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = media;
      setStream(media);
      if (videoRef.current) {
        videoRef.current.srcObject = media;
      }
    } catch (err) {
      console.warn("Camera/Mic access denied:", err);
    }
  }, []);

  useEffect(() => {
    initMedia();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (screenTrackRef.current) {
        screenTrackRef.current.stop();
        screenTrackRef.current = null;
      }
    };
  }, [initMedia]);

  // Toggle Video Track
  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };

  // Toggle Audio Track
  const toggleAudio = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  };

  // Toggle Screen Sharing
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenTrackRef.current) {
        screenTrackRef.current.stop();
        screenTrackRef.current = null;
      }
      setIsScreenSharing(false);
      initMedia();
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        screenTrackRef.current = screenTrack;
        setIsScreenSharing(true);

        if (stream) {
          const audioTrack = stream.getAudioTracks()[0];
          if (audioTrack) screenStream.addTrack(audioTrack);
        }

        setStream(screenStream);

        if (videoRef.current) {
          videoRef.current.srcObject = screenStream;
        }

        screenTrack.onended = () => {
          setIsScreenSharing(false);
          initMedia();
        };
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Toggle Picture-in-Picture
  const togglePiP = async () => {
    if (typeof window !== "undefined" && window.documentPictureInPicture) {
      try {
        const pipWindow = await window.documentPictureInPicture.requestWindow({
          width: 400,
          height: 225,
        });

        if (videoContainerRef.current) {
          pipWindow.document.body.append(videoContainerRef.current);
          pipWindow.document.body.style.margin = "0";
          pipWindow.document.body.style.backgroundColor = "black";
          pipWindow.document.body.style.display = "flex";
          pipWindow.document.body.style.alignItems = "center";
          pipWindow.document.body.style.justifyContent = "center";
          
          pipWindow.addEventListener("pagehide", () => {
            if (videoStageRef.current && videoContainerRef.current) {
              videoStageRef.current.append(videoContainerRef.current);
            }
          });
        }
      } catch (error) {
        console.error("Document PiP failed:", error);
      }
    } else if (videoRef.current && document.pictureInPictureEnabled) {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await videoRef.current.requestPictureInPicture();
        }
      } catch (error) {
        console.error("Standard PiP failed:", error);
      }
    }
  };

  // Send Chat Message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const newMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      sender: displayName,
      text: chatInput.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, newMsg]);
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'chat-message',
        payload: newMsg
      });
    }
    setChatInput("");
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  // Copy Invite Link
  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // End / Leave Meeting
  const handleLeave = async () => {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    try {
      await fetch(`/api/meetings/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
    } catch {
      // Ignore
    }
    router.push("/meet");
  };

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-foreground flex flex-col overflow-hidden select-none">
      {/* Top Meeting Bar */}
      <header className="min-h-14 py-2 px-4 bg-zinc-950/80 backdrop-blur-md border-b border-white/5 flex flex-wrap items-center justify-between gap-2 z-20 shrink-0">
        <div className="flex items-center space-x-3">
          <Link
            href="/meet"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
          >
            ← Leave
          </Link>
          <span className="text-white/20">|</span>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-xs uppercase tracking-widest font-medium text-foreground">
              {meeting?.title || "Private Session"}
            </h1>
          </div>
          <span className="text-xs font-mono text-muted-foreground bg-white/5 px-2.5 py-0.5 rounded-full">
            {formatElapsed(elapsedSecs)}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {isEditingName ? (
            <form onSubmit={handleUpdateDisplayName} className="flex items-center space-x-1.5">
              <input
                type="text"
                autoFocus
                value={tempNameInput}
                onChange={(e) => setTempNameInput(e.target.value)}
                placeholder="Your name..."
                className="px-2 py-1 bg-white/10 border border-white/20 rounded-xl text-xs text-white focus:outline-none"
              />
              <button
                type="submit"
                className="px-2.5 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-xl"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsEditingName(false)}
                className="p-1 text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </form>
          ) : (
            <button
              onClick={() => {
                setTempNameInput(displayName);
                setIsEditingName(true);
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-muted-foreground hover:text-foreground border border-white/5 transition-all"
              title="Click to set your display name in this room"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>
                Joined as: <strong className="text-foreground">{displayName}</strong>
              </span>
              <Edit3 className="w-3 h-3 text-muted-foreground ml-0.5" />
            </button>
          )}

          <button
            onClick={copyLink}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-muted-foreground hover:text-foreground border border-white/5 transition-all"
          >
            {copiedLink ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copiedLink ? "Link Copied" : "Invite Link"}</span>
          </button>
        </div>
      </header>

      {/* Main Grid: Video Stage + Sidebar */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* ── LEFT: Stage ────────────────────────────────────────── */}
        <div ref={videoStageRef} className="flex-1 flex items-center justify-center p-4 md:p-6 bg-black relative overflow-hidden">
          
          {isPuzzleActive && (
            <div className="absolute inset-0 z-0 p-4 md:p-6 flex flex-col">
              <div className="w-full h-full rounded-3xl overflow-hidden bg-zinc-950 border border-white/10 shadow-2xl flex flex-col">
                <div className="flex justify-between items-center p-3 bg-zinc-900 border-b border-white/10 shrink-0">
                  <span className="text-xs font-medium text-white flex items-center space-x-2">
                    <Puzzle className="w-4 h-4 text-primary" />
                    <span>Co-op Puzzle Session</span>
                  </span>
                  <button onClick={() => setIsPuzzleActive(false)} className="text-muted-foreground hover:text-white bg-white/5 p-1 rounded-lg">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <iframe src={`/puzzles?room=${roomId}`} className="flex-1 w-full h-full border-none bg-black" />
              </div>
            </div>
          )}

          <div
              ref={videoContainerRef}
              className={`relative transition-all duration-300 ${
                isPuzzleActive
                  ? "absolute bottom-8 right-8 md:bottom-10 md:right-10 w-48 md:w-72 aspect-video z-20 rounded-2xl shadow-2xl border-white/20"
                  : "w-full h-full max-h-[75vh] md:max-h-[82vh] aspect-[16/9] rounded-3xl"
              } overflow-hidden flex items-center justify-center p-2`}
            >
              <div className={`w-full h-full grid gap-4 ${remoteStreams.size === 0 ? 'grid-cols-1' : remoteStreams.size === 1 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                <div className={`relative w-full h-full rounded-2xl overflow-hidden border border-white/10 ${remoteStreams.size > 0 ? '' : 'col-span-full'}`}>
                  {videoEnabled ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                      style={{
                        transform: isScreenSharing ? "none" : "scaleX(-1)",
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900">
                      <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10">
                        <User className="w-8 h-8 text-white/40" />
                      </div>
                      <span className="text-white/50 text-sm font-medium">Camera Off</span>
                    </div>
                  )}
                  <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-xl text-xs font-medium text-white flex items-center space-x-2 border border-white/10">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>You</span>
                  </div>
                  {isScreenSharing && (
                    <div className="absolute top-4 right-4 bg-sky-500/80 text-white px-2.5 py-1 rounded-xl text-[10px] font-mono tracking-wider">
                      SCREEN SHARING ACTIVE
                    </div>
                  )}
                </div>
                
                {Array.from(remoteStreams.entries()).map(([id, s]) => (
                  <RemoteVideo key={id} stream={s} name={participants[id]?.name || "Guest"} isScreenSharing={participants[id]?.isScreenSharing} />
                ))}
              </div>
            </div>
        </div>

        {/* ── RIGHT: Sidebar (Chat / People / Details) ───────────── */}
        {activeSidebar && (
          <aside className="w-full md:w-80 bg-zinc-950 border-t md:border-t-0 md:border-l border-white/5 flex flex-col z-20 shrink-0 h-64 md:h-full">
            {/* Sidebar Tab Header */}
            <div className="flex items-center justify-between p-3 border-b border-white/5 bg-zinc-900/30">
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setActiveSidebar("chat")}
                  className={`px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                    activeSidebar === "chat"
                      ? "bg-white text-zinc-950 shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Chat
                </button>
                <button
                  onClick={() => setActiveSidebar("people")}
                  className={`px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                    activeSidebar === "people"
                      ? "bg-white text-zinc-950 shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  People
                </button>
                <button
                  onClick={() => setActiveSidebar("notes")}
                  className={`px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                    activeSidebar === "notes"
                      ? "bg-white text-zinc-950 shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Notes
                </button>
                <button
                  onClick={() => setActiveSidebar("details")}
                  className={`px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                    activeSidebar === "details"
                      ? "bg-white text-zinc-950 shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Context
                </button>
              </div>

              <button
                onClick={() => setActiveSidebar(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Chat Messages */}
            {activeSidebar === "chat" && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-col space-y-1 ${
                        m.sender === "Pranjal" ? "items-end" : "items-start"
                      }`}
                    >
                      <div className="flex items-baseline space-x-2 text-[10px] text-muted-foreground">
                        <span className="font-medium text-foreground">{m.sender}</span>
                        <span>{m.time}</span>
                      </div>
                      <div
                        className={`px-3 py-2 rounded-2xl text-xs leading-relaxed max-w-[85%] ${
                          m.sender === "Pranjal"
                            ? "bg-primary text-primary-foreground"
                            : "bg-white/5 text-zinc-200 border border-white/5"
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  ))}
                  <div ref={chatBottomRef} />
                </div>

                <form
                  onSubmit={handleSendMessage}
                  className="p-3 border-t border-white/5 flex items-center space-x-2 bg-zinc-950"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Send a private message..."
                    className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-foreground focus:outline-none focus:border-primary/50"
                  />
                  <button
                    type="submit"
                    className="p-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}

            {/* Participants View */}
            {activeSidebar === "people" && (
              <div className="p-4 space-y-4 overflow-y-auto">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest block">
                  Room Members ({Object.keys(participants).length + 1})
                </span>
                
                <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-medium text-xs uppercase">
                      {displayName[0]}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground">{displayName} (You)</p>
                      <p className="text-[10px] text-muted-foreground">Local</p>
                    </div>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>

                {Object.entries(participants).map(([id, p]) => (
                  <div key={id} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-sky-500/20 text-sky-500 flex items-center justify-center font-medium text-xs uppercase">
                        {p.name?.[0] || 'G'}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground">{p.name || 'Guest'}</p>
                        <p className="text-[10px] text-muted-foreground">Remote Participant</p>
                      </div>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-sky-500" />
                  </div>
                ))}
              </div>
            )}

            {/* Professional Meeting Minutes & Collaborative Notes */}
            {activeSidebar === "notes" && (
              <div className="flex-1 flex flex-col p-4 space-y-3 overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    <span>Meeting Minutes</span>
                  </span>
                  {notesSaveStatus && (
                    <span className="text-[10px] text-emerald-400 font-mono">{notesSaveStatus}</span>
                  )}
                </div>
                <textarea
                  value={meetingNotes}
                  onChange={(e) => setMeetingNotes(e.target.value)}
                  placeholder="Record action items, key decisions, or discussion minutes..."
                  className="flex-1 w-full p-3 bg-white/5 border border-white/10 rounded-2xl text-xs text-foreground resize-none focus:outline-none focus:border-primary/50 font-mono leading-relaxed"
                />
                <button
                  onClick={handleSaveNotes}
                  disabled={isSavingNotes}
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-all flex items-center justify-center space-x-1.5 shadow-md shadow-primary/20"
                >
                  {isSavingNotes ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Save Minutes to Archive</span>
                </button>
              </div>
            )}

            {/* Context & Notes View */}
            {activeSidebar === "details" && (
              <div className="p-4 space-y-4 overflow-y-auto">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest block">
                  Session Notes
                </span>
                <p className="text-xs text-foreground/80 leading-relaxed italic bg-white/5 p-3 rounded-2xl border border-white/5">
                  {meeting?.notes || "No notes added for this session."}
                </p>

                <div className="space-y-2 pt-2 border-t border-white/5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest block">
                    Security & Privacy
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    This session is strictly peer-to-peer WebRTC encrypted. No audio, video, or chat transcripts are shared externally.
                  </p>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Bottom Floating Control Bar */}
      <footer className="h-auto min-h-[80px] py-4 bg-zinc-950/90 backdrop-blur-md border-t border-white/5 flex items-center justify-center gap-2 px-4 z-30 shrink-0 flex-wrap">
        
        {/* Features: Puzzle, PIP */}
        <button
          onClick={() => setIsPuzzleActive(!isPuzzleActive)}
          className={`p-3.5 rounded-2xl border transition-all ${
            isPuzzleActive
              ? "bg-primary/20 text-primary border-primary/40"
              : "bg-white/5 hover:bg-white/10 text-foreground border-white/10"
          }`}
          title="Launch Co-op Puzzle"
        >
          <Puzzle className="w-5 h-5" />
        </button>

        <button
          onClick={togglePiP}
          className="p-3.5 rounded-2xl border bg-white/5 hover:bg-white/10 text-foreground border-white/10 transition-all"
          title="Picture-in-Picture"
        >
          <PictureInPicture className="w-5 h-5" />
        </button>
        
        <div className="w-px h-8 bg-white/10 mx-2" />

        {/* Mic Toggle */}
        <button
          onClick={toggleAudio}
          className={`p-3.5 rounded-2xl border transition-all ${
            audioEnabled
              ? "bg-white/5 hover:bg-white/10 text-foreground border-white/10"
              : "bg-rose-500/20 text-rose-400 border-rose-500/40"
          }`}
          title={audioEnabled ? "Mute Microphone" : "Unmute Microphone"}
        >
          {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        {/* Video Toggle */}
        <button
          onClick={toggleVideo}
          className={`p-3.5 rounded-2xl border transition-all ${
            videoEnabled
              ? "bg-white/5 hover:bg-white/10 text-foreground border-white/10"
              : "bg-rose-500/20 text-rose-400 border-rose-500/40"
          }`}
          title={videoEnabled ? "Turn Off Camera" : "Turn On Camera"}
        >
          {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        {/* Screen Share Toggle */}
        <button
          onClick={toggleScreenShare}
          className={`p-3.5 rounded-2xl border transition-all ${
            isScreenSharing
              ? "bg-sky-500/20 text-sky-400 border-sky-500/40"
              : "bg-white/5 hover:bg-white/10 text-foreground border-white/10"
          }`}
          title={isScreenSharing ? "Stop Screen Share" : "Share Screen"}
        >
          <Monitor className="w-5 h-5" />
        </button>

        {/* Chat Toggle */}
        <button
          onClick={() => setActiveSidebar((prev) => (prev === "chat" ? null : "chat"))}
          className={`p-3.5 rounded-2xl border transition-all ${
            activeSidebar === "chat"
              ? "bg-white text-zinc-950 border-white shadow-sm"
              : "bg-white/5 hover:bg-white/10 text-foreground border-white/10"
          }`}
          title="In-Room Chat"
        >
          <MessageSquare className="w-5 h-5" />
        </button>

        {/* End & Delete Meeting */}
        <button
          onClick={handleEndAndDelete}
          className="px-4 py-3.5 rounded-2xl bg-white/5 hover:bg-rose-500/20 text-rose-400 border border-white/10 hover:border-rose-500/30 transition-all font-medium text-xs flex items-center space-x-1.5 ml-2"
          title="End session and delete record"
        >
          <Trash2 className="w-4 h-4" />
          <span className="hidden sm:inline">Delete Session</span>
        </button>

        {/* Leave Meeting */}
        <button
          onClick={handleLeave}
          className="px-5 py-3.5 rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all font-medium text-xs flex items-center space-x-2 shadow-lg shadow-destructive/20 ml-2"
          title="End Session"
        >
          <PhoneOff className="w-4 h-4" />
          <span>Leave</span>
        </button>
      </footer>
    </div>
  );
}
const RemoteVideo = ({ stream, isSpeaking, name, isScreenSharing }: { stream: MediaStream, isSpeaking?: boolean, name?: string, isScreenSharing?: boolean }) => {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <div className={`relative w-full h-full rounded-2xl overflow-hidden border ${isSpeaking ? 'border-primary shadow-[0_0_15px_rgba(var(--primary),0.5)]' : 'border-white/10'}`}>
      <video ref={ref} autoPlay playsInline className={`w-full h-full ${isScreenSharing ? 'object-contain bg-black' : 'object-cover'}`} />
      <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-xl text-xs font-medium text-white flex items-center space-x-2 border border-white/10">
        <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
        <span>{name || "Guest"}</span>
      </div>
      {isScreenSharing && (
        <div className="absolute top-4 right-4 bg-sky-500/80 text-white px-2.5 py-1 rounded-xl text-[10px] font-mono tracking-wider">
          SCREEN SHARING
        </div>
      )}
    </div>
  );
};


