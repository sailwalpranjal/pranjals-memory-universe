"use client";
import * as faceapi from "@vladmandic/face-api";

import { useEffect, useState, useRef, Suspense } from "react";
import Link from "next/link";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars, Float, OrbitControls, Sparkles as DreiSparkles } from "@react-three/drei";
import Webcam from "react-webcam";
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
  Lock,
  Unlock,
  Compass
} from "lucide-react";
import OnThisDay from "@/components/OnThisDay";
import GenerateMemoryModal from "@/components/GenerateMemoryModal";

import * as THREE from 'three';

// --- 3D Scene Components ---
function MemoryNodes() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.getElapsedTime() * 0.05;
      groupRef.current.rotation.x = clock.getElapsedTime() * 0.02;
    }
  });

  return (
    <group ref={groupRef}>
      <DreiSparkles count={500} scale={20} size={2} speed={0.4} opacity={0.6} color="#4fd1c5" />
      <DreiSparkles count={300} scale={15} size={3} speed={0.2} opacity={0.4} color="#6366f1" />
      <DreiSparkles count={100} scale={25} size={4} speed={0.5} opacity={0.3} color="#f472b6" />
    </group>
  );
}

function UniverseScene() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <Stars radius={100} depth={50} count={7000} factor={4} saturation={0} fade speed={1} />
      <MemoryNodes />
      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
        <mesh position={[0, 0, -5]}>
          <octahedronGeometry args={[1.5, 0]} />
          <meshStandardMaterial color="#6366f1" wireframe emissive="#3b82f6" emissiveIntensity={0.5} transparent opacity={0.2} />
        </mesh>
      </Float>
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.5} />
    </>
  );
}

// --- Stunning Icon Logo ---
const UniverseLogo = () => (
  <div className="flex items-center justify-center mb-8 relative">
    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full w-32 h-32 mx-auto animate-pulse" />
    <div className="relative bg-black/40 backdrop-blur-md p-6 rounded-full border border-white/10 shadow-2xl">
      <Compass className="w-16 h-16 text-primary transition-transform duration-700 hover:rotate-90" strokeWidth={1.5} />
    </div>
  </div>
);



// --- Liveness Utils ---
function getYawRatio(landmarks: faceapi.FaceLandmarks68) {
  const jaw = landmarks.getJawOutline();
  const nose = landmarks.getNose();
  // Nose tip is index 3 of nose array (overall index 30). Jaw bounds are 0 and 16.
  const leftDist = nose[3].x - jaw[0].x;
  const rightDist = jaw[16].x - nose[3].x;
  return leftDist / rightDist;
}

// --- Biometric Auth Modal ---
const FaceAuthModal = ({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void; }) => {
  const webcamRef = useRef<Webcam>(null);
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState<string>("Analyzing...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const runBiometrics = async () => {
      if (!isOpen || !webcamRef.current || !webcamRef.current.video) return;
      try {
        if (!faceapi.nets.tinyFaceDetector.isLoaded) {
          setStatusText("Initializing Neural Engine...");
          await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
          await faceapi.nets.faceLandmark68TinyNet.loadFromUri('/models');
          await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        }

        // Random challenge
        const requiredDirection = Math.random() > 0.5 ? "LEFT" : "RIGHT";
        setStatusText(`LIVENESS: TURN HEAD SLIGHTLY ${requiredDirection}`);
        
        let livenessPassed = false;
        let descriptor: Float32Array | null = null;
        
        // Use TinyFaceDetectorOptions for 60+ FPS
        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 });

        // 1. Wait for Liveness (Head Turn)
        while (active && !livenessPassed) {
          if (!webcamRef.current?.video) {
            await new Promise(r => requestAnimationFrame(r));
            continue;
          }
          
          const detection = await faceapi.detectSingleFace(webcamRef.current.video, options)
            .withFaceLandmarks(true);

          if (detection) {
            // Quality Check: Move closer if face is too small
            const faceWidth = detection.detection.box.width;
            const videoWidth = webcamRef.current.video.videoWidth;
            if (faceWidth / videoWidth < 0.15) {
              setStatusText("MOVE CLOSER TO CAMERA");
              await new Promise(r => setTimeout(r, 100));
              continue;
            } else if (detection.detection.score < 0.6) {
              setStatusText("IMPROVE LIGHTING / FACE CAMERA");
              await new Promise(r => setTimeout(r, 100));
              continue;
            }

            const ratio = getYawRatio(detection.landmarks);
            
            // Check if they turned their head in the correct direction
            // Note: Camera is mirrored visually, but detection coordinates are unmirrored.
            // When user turns LEFT, their nose points to the RIGHT side of the image -> ratio > 1.5
            // When user turns RIGHT, their nose points to the LEFT side of the image -> ratio < 0.65
            if ((requiredDirection === "LEFT" && ratio > 1.5) || (requiredDirection === "RIGHT" && ratio < 0.65)) {
              livenessPassed = true;
              setStatusText("Liveness Verified! Please look straight at the camera.");
              break;
            } else {
              setStatusText(`LIVENESS: TURN HEAD SLIGHTLY ${requiredDirection}`);
            }
          }
          await new Promise(r => requestAnimationFrame(r));
        }

        // 2. Wait for user to look straight at the camera again before extraction
        let isLookingStraight = false;
        let straightFrames = 0;

        while (active && !isLookingStraight) {
          if (!webcamRef.current?.video) break;
          const detection = await faceapi.detectSingleFace(webcamRef.current.video, options)
            .withFaceLandmarks(true);

          if (detection) {
            const ratio = getYawRatio(detection.landmarks);
            // Looking straight means left and right distances are roughly equal (ratio near 1.0)
            if (ratio > 0.8 && ratio < 1.25) {
              straightFrames++;
              if (straightFrames >= 3) {
                isLookingStraight = true;
                break;
              }
            } else {
              straightFrames = 0;
            }
          }
          await new Promise(r => requestAnimationFrame(r));
        }

        if (!active) return;
        setStatusText("Extracting Facial Features...");
        
        // 3. Extract final descriptor while looking straight
        while (active && !descriptor) {
          if (!webcamRef.current?.video) break;
          const detection = await faceapi.detectSingleFace(webcamRef.current.video, options)
            .withFaceLandmarks(true)
            .withFaceDescriptor();

          if (detection) {
            descriptor = detection.descriptor;
            break;
          }
          await new Promise(r => requestAnimationFrame(r));
        }

        if (descriptor && active) {
          authenticateWithServer(Array.from(descriptor));
        }
      } catch (err) {
        console.error("Biometrics error:", err);
        setError("Camera error or initialization failed.");
      }
    };
    
    if (isOpen) {
      setLoading(false);
      setError(null);
      runBiometrics();
    }
    
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const authenticateWithServer = async (descriptorArray: number[]) => {
    setLoading(true);
    setError(null);
    setStatusText("Verifying Identity...");
    try {
      const res = await fetch('/api/auth/face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descriptor: descriptorArray })
      });
      const data = await res.json();
      if (data.success && data.isAdmin) {
        sessionStorage.setItem('pranjal_admin', 'true');
        onSuccess();
      } else {
        setError(data.error || "Authentication failed. Face not recognized.");
      }
    } catch {
      setError("Network error during verification.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="bg-zinc-900 border border-white/10 p-8 rounded-3xl w-full max-w-md flex flex-col items-center shadow-2xl relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-emerald-500/20 blur-[60px] pointer-events-none" />
        
        <Lock className="w-8 h-8 text-emerald-400 mb-4 animate-pulse" />
        <h2 className="text-xl font-light tracking-widest mb-1 uppercase text-emerald-400">Biometric Scan</h2>
        <p className="text-xs text-muted-foreground tracking-widest uppercase mb-6">Admin Verification Required</p>
        
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black mb-6 border border-white/10 shadow-inner">
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={{ facingMode: "user" }}
            className="w-full h-full object-cover scale-x-[-1]"
          />
          {(loading || statusText.includes("LIVENESS") || statusText.includes("Extracting") || statusText.includes("Initializing") || statusText.includes("Verifying")) && (
            <div className={`absolute inset-0 flex flex-col items-center justify-center ${statusText.includes("LIVENESS") ? "bg-black/20" : "bg-black/70 backdrop-blur-sm"}`}>
              <div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mb-3 shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
              <span className="text-xs text-emerald-400 tracking-widest uppercase animate-pulse text-center px-4 drop-shadow-md bg-black/50 py-1 px-3 rounded-full">{statusText}</span>
            </div>
          )}
          
          {/* Scanning Reticle */}
          <div className="absolute inset-0 pointer-events-none border-[1px] border-emerald-500/30 m-4 rounded-lg flex items-center justify-center">
            <div className="w-1/2 h-1/2 border border-emerald-400/50 rounded-full" />
            <div className="absolute w-full h-[1px] bg-emerald-500/20" />
            <div className="absolute h-full w-[1px] bg-emerald-500/20" />
          </div>
        </div>

        {error && <p className="text-red-400 text-sm mb-6 text-center">{error}</p>}
        
        <div className="flex space-x-4 w-full">
          <button 
            onClick={onClose}
            className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs tracking-widest uppercase font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

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
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if cookie exists
    const checkAdmin = () => {
      const hasCookie = document.cookie.includes('pranjal_admin_token=');
      setIsAdmin(hasCookie);
    };
    checkAdmin();
  }, []);

  const handleAdminToggle = () => {
    if (isAdmin) {
      // Logout
      document.cookie = "pranjal_admin_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      setIsAdmin(false);
      window.location.reload();
    } else {
      setAuthModalOpen(true);
    }
  };

  const handleAuthSuccess = () => {
    setAuthModalOpen(false);
    setIsAdmin(true);
    window.location.reload();
  };

  const now = new Date();
  const timeStr = mounted ? now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--";
  const dateStr = mounted ? now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "Loading...";
  const hour = now.getHours();
  const greeting = mounted ? (hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening") : "Welcome";

  useEffect(() => {
    if (!isAdmin) return; // Don't fetch stats if not admin/authenticated to avoid 401s
    
    Promise.all([
      fetch("/api/photos").then(r => r.json()).catch(() => ({ photos: [] })),
      fetch("/api/people").then(r => r.json()).catch(() => ({ people: [], totalPeople: 0 })),
      fetch("/api/places").then(r => r.json()).catch(() => ({ places: [] })),
    ]).then(([photosData, peopleData, placesData]) => {
      const photos = photosData.photos || [];
      const withUrls = photos.filter((p: { url?: string | null }) => p.url);
      setStats({
        photoCount: photos.length,
        peopleCount: peopleData.totalPeople || (peopleData.people?.length || 0),
        placesCount: placesData.places?.length || 0,
        latestPhoto: withUrls[0]?.url ?? null,
        recentPhotos: withUrls.slice(0, 6).map((p: { url: string }) => p.url),
      });
    });
  }, [isAdmin]);

  const hasContent = stats && stats.photoCount > 0;

  return (
    <main className="min-h-screen flex flex-col relative bg-background">
      {/* â”€â”€ 3D BACKGROUND â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="absolute inset-0 z-0 h-[85vh]">
        <Canvas camera={{ position: [0, 0, 10], fov: 45 }}>
          <Suspense fallback={null}>
            <UniverseScene />
          </Suspense>
        </Canvas>
        {/* Gradient overlay to blend 3D canvas with content below */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/60 to-background pointer-events-none" />
      </div>

      {/* â”€â”€ HERO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="relative z-10 min-h-[85vh] flex flex-col items-center justify-center overflow-hidden">
        
        {/* Content */}
        <div className="relative z-20 flex flex-col items-center text-center space-y-8 px-6 mt-10">
          
          <UniverseLogo />
          
          {/* Cloud Health & Status Pill */}
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="inline-flex items-center space-x-2 px-5 py-2 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono tracking-widest text-muted-foreground uppercase shadow-2xl backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
              <span className="text-white/80">Network Sync Active</span>
            </div>
            
            <button 
              onClick={handleAdminToggle}
              className={`group inline-flex items-center space-x-2 px-5 py-2 rounded-full border text-[10px] font-mono tracking-widest uppercase shadow-2xl backdrop-blur-md transition-all ${
                isAdmin 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' 
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20'
              }`}
            >
              {isAdmin ? <Unlock className="w-3 h-3 group-hover:scale-110 transition-transform" /> : <Lock className="w-3 h-3 group-hover:scale-110 transition-transform" />}
              <span>{isAdmin ? 'Admin Unlocked' : 'Visitor Mode Restricted'}</span>
            </button>
          </div>

          {/* Clock / date */}
          <div className="flex flex-col items-center space-y-1">
            <p className="font-mono text-5xl md:text-8xl font-extralight text-white tracking-widest tabular-nums drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">
              {timeStr}
            </p>
            <p className="text-white/50 text-xs tracking-[0.4em] uppercase font-medium mt-2">{dateStr}</p>
          </div>

          {/* Wordmark & Dynamic Greeting */}
          <div className="flex flex-col items-center space-y-2 mt-4">
            <h2 className="text-xs font-mono tracking-[0.5em] uppercase text-emerald-400 font-medium">
              {greeting}, {isAdmin ? 'Pranjal' : 'Visitor'}
            </h2>
            <h1 className="text-3xl md:text-5xl font-extralight tracking-[0.3em] uppercase text-white/90 drop-shadow-xl mt-2">
              Memory Universe
            </h1>
          </div>

          {/* Live stats - Only visible if admin */}
          {isAdmin && stats !== null && (
            <div className="flex items-center space-x-8 md:space-x-16 mt-8 p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md">
              {[
                { value: stats.photoCount, label: "Memories" },
                ...(stats.peopleCount > 0 ? [{ value: stats.peopleCount, label: "People" }] : []),
                ...(stats.placesCount > 0 ? [{ value: stats.placesCount, label: "Places" }] : []),
              ].map((stat, i) => (
                <div key={i} className="flex flex-col items-center">
                  <span className="text-3xl md:text-5xl font-light text-white tabular-nums drop-shadow-md">
                    {stat.value}
                  </span>
                  <span className="text-[10px] text-emerald-400/80 tracking-[0.35em] uppercase mt-2">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Primary Actions - Disabled or hidden if visitor */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-6">
            <button
              onClick={() => isAdmin ? setGenerateOpen(true) : setAuthModalOpen(true)}
              className="flex items-center space-x-2 px-8 py-4 rounded-full bg-white text-black text-sm font-bold tracking-wide uppercase hover:bg-gray-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)]"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isAdmin ? 'Generate Memory' : 'Unlock Full Access'}</span>
            </button>
            {isAdmin && (
              <Link
                href="/gallery"
                className="flex items-center space-x-2 px-8 py-4 rounded-full bg-white/10 border border-white/20 text-white text-sm font-bold tracking-wide uppercase hover:bg-white/20 transition-all backdrop-blur-md"
              >
                <Camera className="w-4 h-4" />
                <span>Live Camera</span>
              </Link>
            )}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center space-y-2 text-white/30">
          <ArrowRight className="w-5 h-5 rotate-90 animate-bounce" />
        </div>
      </section>

      {/* â”€â”€ RESTRICTED OVERLAY FOR VISITORS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {!isAdmin && (
        <section className="px-6 md:px-10 py-24 max-w-7xl mx-auto w-full text-center relative z-10 flex flex-col items-center">
          <Lock className="w-12 h-12 text-amber-500/50 mb-6" />
          <h2 className="text-2xl font-extralight tracking-widest text-white mb-4 uppercase">Access Restricted</h2>
          <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
            You are currently viewing the Memory Universe in Visitor Mode. 
            Detailed archives, timeline data, and full gallery access require biometric administrator authentication.
          </p>
          <button 
            onClick={() => setAuthModalOpen(true)}
            className="mt-8 px-8 py-3 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full text-xs tracking-widest uppercase hover:bg-amber-500/20 transition-all"
          >
            Authenticate Now
          </button>
        </section>
      )}

      {/* â”€â”€ ADMIN CONTENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {isAdmin && (
        <>
          {/* FEATURED PHOTO */}
          {hasContent && stats.latestPhoto && (
            <section className="px-6 md:px-10 py-16 max-w-7xl mx-auto w-full relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <p className="text-[10px] tracking-[0.35em] text-emerald-400 uppercase mb-2">Latest Memories</p>
                  <h2 className="text-3xl font-extralight tracking-widest text-white uppercase">Recent Archive</h2>
                </div>
                <Link href="/timeline" className="flex items-center space-x-2 text-xs text-muted-foreground hover:text-white transition-colors group">
                  <span className="tracking-widest uppercase">View all</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {stats.recentPhotos.map((url, i) => (
                  <Link
                    href="/timeline"
                    key={i}
                    className={`group relative overflow-hidden rounded-2xl bg-white/5 border border-white/10 shadow-xl ${
                      i === 0 ? "col-span-2 row-span-2 aspect-square md:aspect-auto" : "aspect-square"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt=""
                      className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors duration-500" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ON THIS DAY */}
          <section className="px-6 md:px-10 py-6 max-w-7xl mx-auto w-full relative z-10">
            <OnThisDay />
          </section>

          {/* NAVIGATION CARDS */}
          <section className="px-6 md:px-10 py-20 max-w-7xl mx-auto w-full relative z-10">
            <div className="mb-12">
              <p className="text-[10px] tracking-[0.35em] text-emerald-400 uppercase mb-2">Directory</p>
              <h2 className="text-3xl font-extralight tracking-widest text-white uppercase">System Modules</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {NAV_CARDS.map(card => (
                <Link
                  key={card.href}
                  href={card.href}
                  className="group relative flex flex-col justify-between p-6 md:p-8 rounded-3xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-500 overflow-hidden min-h-[160px] backdrop-blur-sm"
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
                  <card.icon className="w-6 h-6 text-white/50 group-hover:text-emerald-400 transition-colors duration-300 mb-auto" strokeWidth={1.5} />
                  <div className="mt-8">
                    <h3 className="text-sm font-bold tracking-widest uppercase text-white mb-2">{card.label}</h3>
                    <p className="text-xs text-white/50 leading-relaxed">{card.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}

      {/* â”€â”€ FOOTER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <footer className="mt-auto px-6 py-12 border-t border-white/10 text-center relative z-10 bg-background/80 backdrop-blur-lg">
        <p className="text-[10px] text-white/30 tracking-[0.4em] uppercase font-medium">
          Private Â· Biometric Security Â· Pranjal&apos;s Universe
        </p>
      </footer>

      <GenerateMemoryModal
        isOpen={generateOpen}
        onClose={() => setGenerateOpen(false)}
      />

      <FaceAuthModal 
        isOpen={authModalOpen} 
        onClose={() => setAuthModalOpen(false)} 
        onSuccess={handleAuthSuccess}
      />
    </main>
  );
}
