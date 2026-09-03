"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera,
  RefreshCw,
  MapPin,
  Clock,
  Grid3X3,
  Sliders,
  Check,
  X,
  Loader2,
  AlertCircle,
  Video,
  Mic,
  Square,
  RotateCcw,
  Zap,
  ZapOff,
  Wifi,
  WifiOff,
  Images,
} from "lucide-react";

interface CameraCaptureProps {
  onCaptureComplete: () => void;
  onClose?: () => void;
}

const FILTERS = [
  { name: "Normal", value: "none" },
  { name: "Cinematic", value: "contrast(1.2) saturate(1.15) brightness(0.95)" },
  { name: "Monochrome", value: "grayscale(1) contrast(1.3)" },
  { name: "Warm Gold", value: "sepia(0.35) saturate(1.2) contrast(1.1)" },
  { name: "Cyber", value: "hue-rotate(180deg) saturate(1.4) contrast(1.2)" },
];

export default function CameraCapture({ onCaptureComplete, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Capture mode: photo | video | audio
  const [mode, setMode] = useState<"photo" | "video" | "audio">("photo");
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [activeFilter, setActiveFilter] = useState("none");
  const [showGrid, setShowGrid] = useState(false);
  const [timerDuration, setTimerDuration] = useState<number>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [soundEnabled] = useState(true);
  const [includeLocation, setIncludeLocation] = useState(true);
  const [autoEnhance] = useState(true);
  const [aspectRatio, setAspectRatio] = useState<"4:3" | "16:9" | "1:1">("4:3");
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number; step: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedMime, setCapturedMime] = useState<string>("image/jpeg");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Burst Mode state
  const [burstMode, setBurstMode] = useState(false);
  const [burstCount] = useState<number>(4);
  const [burstFrames, setBurstFrames] = useState<Array<{ id: string; blob: Blob; url: string; timestamp: number }>>([]);

  // Offline Sync Queue state
  const [isOffline, setIsOffline] = useState(false);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);
  const [syncingOffline, setSyncingOffline] = useState(false);

  // Recording timer tick
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } else {
      setRecordSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  // Offline sync queue processor
  const syncOfflineQueue = useCallback(async () => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("pranjal_offline_capture_queue");
    if (!raw) return;
    try {
      const queue = JSON.parse(raw);
      if (!Array.isArray(queue) || queue.length === 0) return;
      setSyncingOffline(true);
      const remaining = [];
      for (const item of queue) {
        try {
          const res = await fetch(item.dataUrl);
          const blob = await res.blob();
          const formData = new FormData();
          formData.append("file", blob, item.filename);
          if (item.coords) {
            formData.append("latitude", item.coords.lat.toString());
            formData.append("longitude", item.coords.lng.toString());
          }
          const upRes = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });
          if (!upRes.ok) remaining.push(item);
        } catch {
          remaining.push(item);
        }
      }
      localStorage.setItem("pranjal_offline_capture_queue", JSON.stringify(remaining));
      setOfflineQueueCount(remaining.length);
      if (remaining.length === 0) {
        onCaptureComplete();
      }
    } finally {
      setSyncingOffline(false);
    }
  }, [onCaptureComplete]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOffline(!navigator.onLine);

    const handleOnline = () => {
      setIsOffline(false);
      syncOfflineQueue();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check on mount
    const raw = localStorage.getItem("pranjal_offline_capture_queue");
    if (raw) {
      try {
        const queue = JSON.parse(raw);
        if (Array.isArray(queue)) setOfflineQueueCount(queue.length);
        if (navigator.onLine && Array.isArray(queue) && queue.length > 0) {
          syncOfflineQueue();
        }
      } catch {}
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncOfflineQueue]);

  // Web Audio camera shutter sound
  const playShutterSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch {
      // Ignore audio error
    }
  }, [soundEnabled]);

  // Request location
  useEffect(() => {
    if (!includeLocation) {
      setCoords(null);
      return;
    }
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }
  }, [includeLocation]);

  // Stop all media tracks physically
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    setStream(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchOn(false);
  }, []);

  // Initialize Media Stream based on mode
  const startStream = useCallback(async () => {
    try {
      setCameraError(null);
      stopStream();

      let constraints: MediaStreamConstraints;
      if (mode === "audio") {
        constraints = { audio: true, video: false };
      } else {
        constraints = {
          video: {
            facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: mode === "video",
        };
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;
      setStream(mediaStream);

      // Detect hardware capabilities
      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        try {
          const caps = (videoTrack.getCapabilities ? videoTrack.getCapabilities() : {}) as {
            torch?: boolean;
            zoom?: { min: number; max: number; step: number };
          };
          if (caps.torch) setTorchAvailable(true);
          else setTorchAvailable(false);

          if (caps.zoom) {
            setZoomRange(caps.zoom);
            setZoomLevel(caps.zoom.min || 1);
          } else {
            setZoomRange(null);
          }
        } catch {
          // Capabilities not supported on this browser/hardware
        }
      }

      if (videoRef.current && mode !== "audio") {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Media device access denied";
      setCameraError(msg);
    }
  }, [facingMode, mode, stopStream]);

  useEffect(() => {
    startStream();
    return () => {
      stopStream();
    };
  }, [startStream, stopStream]);

  // Flash / Torch toggle
  const toggleTorch = async () => {
    if (!streamRef.current || !torchAvailable) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      try {
        const nextState = !torchOn;
        await (videoTrack as MediaStreamTrack & { applyConstraints: (c: Record<string, unknown>) => Promise<void> }).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setTorchOn(nextState);
      } catch {
        // Torch constraint failed
      }
    }
  };

  // Hardware Zoom control
  const handleZoomChange = async (val: number) => {
    setZoomLevel(val);
    if (!streamRef.current) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      try {
        await (videoTrack as MediaStreamTrack & { applyConstraints: (c: Record<string, unknown>) => Promise<void> }).applyConstraints({
          advanced: [{ zoom: val }],
        });
      } catch {
        // Zoom constraint failed
      }
    }
  };

  // Snap Single Photo with Aspect Ratio Cropping & Immediate Power-down
  const snapPhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    let sx = 0, sy = 0, sw = width, sh = height;
    if (aspectRatio === "1:1") {
      const size = Math.min(width, height);
      sx = (width - size) / 2;
      sy = (height - size) / 2;
      sw = size;
      sh = size;
      canvas.width = size;
      canvas.height = size;
    } else if (aspectRatio === "16:9") {
      const targetH = Math.round((width * 9) / 16);
      if (targetH <= height) {
        sy = (height - targetH) / 2;
        sh = targetH;
        canvas.width = width;
        canvas.height = targetH;
      } else {
        canvas.width = width;
        canvas.height = height;
      }
    } else {
      // 4:3
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.filter = activeFilter;
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    playShutterSound();

    // Immediately stop live video tracks so camera sensor goes idle during review
    stopStream();

    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCapturedBlob(blob);
          setCapturedMime("image/jpeg");
          setPreviewUrl(URL.createObjectURL(blob));
        }
      },
      "image/jpeg",
      0.95
    );
  }, [activeFilter, facingMode, playShutterSound, aspectRatio, stopStream]);

  // Start Video / Audio Recording
  const startRecording = () => {
    if (!stream) return;
    recordedChunksRef.current = [];

    const mime = mode === "video" ? "video/webm;codecs=vp8,opus" : "audio/webm;codecs=opus";
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported(mime) ? mime : undefined,
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const finalMime = mode === "video" ? "video/webm" : "audio/webm";
      const blob = new Blob(recordedChunksRef.current, { type: finalMime });
      setCapturedBlob(blob);
      setCapturedMime(finalMime);
      setPreviewUrl(URL.createObjectURL(blob));
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(250);
    setIsRecording(true);
  };

  // Stop Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Burst Mode Multi-Frame Capture
  const snapBurstPhotos = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setBurstFrames([]);
    const frames: Array<{ id: string; blob: Blob; url: string; timestamp: number }> = [];

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    let sx = 0, sy = 0, sw = width, sh = height;
    if (aspectRatio === "1:1") {
      const size = Math.min(width, height);
      sx = (width - size) / 2;
      sy = (height - size) / 2;
      sw = size;
      sh = size;
      canvas.width = size;
      canvas.height = size;
    } else if (aspectRatio === "16:9") {
      const targetH = Math.round((width * 9) / 16);
      if (targetH <= height) {
        sy = (height - targetH) / 2;
        sh = targetH;
        canvas.width = width;
        canvas.height = targetH;
      } else {
        canvas.width = width;
        canvas.height = height;
      }
    } else {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    for (let i = 0; i < burstCount; i++) {
      playShutterSound();
      ctx.filter = activeFilter;
      ctx.save();
      if (facingMode === "user") {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92)
      );

      if (blob) {
        frames.push({
          id: `burst-${Date.now()}-${i}`,
          blob,
          url: URL.createObjectURL(blob),
          timestamp: Date.now(),
        });
      }

      await new Promise((r) => setTimeout(r, 180));
    }

    setBurstFrames(frames);
    stopStream();
  }, [activeFilter, facingMode, playShutterSound, aspectRatio, stopStream, burstCount]);

  // Upload Burst Frames (with Offline Queue Fallback)
  const handleUploadBurst = async () => {
    if (burstFrames.length === 0) return;
    setIsUploading(true);
    setUploadProgress(`Processing ${burstFrames.length} burst frames...`);

    if (typeof window !== "undefined" && !navigator.onLine) {
      // Offline vault storage
      try {
        const raw = localStorage.getItem("pranjal_offline_capture_queue");
        const queue = raw ? JSON.parse(raw) : [];
        for (let i = 0; i < burstFrames.length; i++) {
          const frame = burstFrames[i];
          queue.push({
            dataUrl: frame.url,
            filename: `burst_${frame.timestamp}_${i + 1}.jpg`,
            coords,
          });
        }
        localStorage.setItem("pranjal_offline_capture_queue", JSON.stringify(queue));
        setOfflineQueueCount(queue.length);
        setIsUploading(false);
        alert(
          `${burstFrames.length} burst photos safely stored in your Offline Vault! They will automatically synchronize to your Universe once your network connection is restored.`
        );
        handleClose();
      } catch (err) {
        console.error("Failed to write to offline queue:", err);
        setIsUploading(false);
      }
      return;
    }

    try {
      for (let i = 0; i < burstFrames.length; i++) {
        const frame = burstFrames[i];
        setUploadProgress(`Uploading burst frame ${i + 1} of ${burstFrames.length}...`);
        const formData = new FormData();
        formData.append("file", frame.blob, `burst_${frame.timestamp}_${i + 1}.jpg`);
        if (coords) {
          formData.append("latitude", coords.lat.toString());
          formData.append("longitude", coords.lng.toString());
        }
        if (autoEnhance) {
          formData.append("auto_enhance", "true");
        }
        
        try {
          const faceapi = await import("@vladmandic/face-api");
          const MODEL_URL = "/models";
          await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          ]);
          
          const file = new File([frame.blob], `burst_${frame.timestamp}_${i + 1}.jpg`, { type: "image/jpeg" });
          const img = await faceapi.bufferToImage(file);
          const detections = await faceapi.detectAllFaces(img).withFaceLandmarks().withFaceDescriptors();
          
          const facesData = detections.map(d => ({
            embedding: Array.from(d.descriptor),
            box: { 
              x: d.detection.box.x / img.width, 
              y: d.detection.box.y / img.height, 
              width: d.detection.box.width / img.width, 
              height: d.detection.box.height / img.height 
            },
            confidence: d.detection.score
          }));
          
          if (facesData.length > 0) {
            formData.append("faces", JSON.stringify(facesData));
          }
        } catch (e) {
          console.warn("[CameraCapture] Burst Face extraction failed:", e);
        }

        await fetch("/api/upload", { method: "POST", body: formData });
      }

      setUploadProgress("All burst photos preserved in your Universe!");
      setTimeout(() => {
        onCaptureComplete();
        if (onClose) onClose();
      }, 700);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Burst upload error";
      alert(`${msg}. Preserved in local session.`);
    } finally {
      setIsUploading(false);
    }
  };

  // Photo snap with timer
  const handleSnapClick = () => {
    if (burstMode) {
      snapBurstPhotos();
      return;
    }
    if (timerDuration === 0) {
      snapPhoto();
      return;
    }
    let timeLeft = timerDuration;
    setCountdown(timeLeft);
    const interval = setInterval(() => {
      timeLeft -= 1;
      if (timeLeft <= 0) {
        clearInterval(interval);
        setCountdown(null);
        snapPhoto();
      } else {
        setCountdown(timeLeft);
      }
    }, 1000);
  };

  // Retake
  const handleRetake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setCapturedBlob(null);
    setPreviewUrl(null);
    startStream();
  };

  // Upload to Universe
  const handleSaveMemory = async () => {
    if (!capturedBlob) return;
    setIsUploading(true);
    setUploadProgress("Uploading media to Universe...");

    const ext = capturedMime.startsWith("video/")
      ? "webm"
      : capturedMime.startsWith("audio/")
      ? "webm"
      : "jpg";
    const prefix = capturedMime.startsWith("video/")
      ? "video"
      : capturedMime.startsWith("audio/")
      ? "audio_memo"
      : "camera";
    const filename = `${prefix}_${Date.now()}.${ext}`;

    // Handle offline vault storage if network is disconnected
    if (typeof window !== "undefined" && !navigator.onLine) {
      try {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = reader.result as string;
          const raw = localStorage.getItem("pranjal_offline_capture_queue");
          const queue = raw ? JSON.parse(raw) : [];
          queue.push({
            dataUrl: base64Data,
            filename,
            coords,
          });
          localStorage.setItem("pranjal_offline_capture_queue", JSON.stringify(queue));
          setOfflineQueueCount(queue.length);
          setIsUploading(false);
          alert(
            "Offline Vault Active: Memory safely preserved on this device. It will automatically upload to your Universe as soon as your network connection returns."
          );
          handleClose();
        };
        reader.readAsDataURL(capturedBlob);
      } catch (err) {
        console.error("Offline storage error:", err);
        setIsUploading(false);
      }
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", capturedBlob, filename);

      if (coords) {
        formData.append("latitude", coords.lat.toString());
        formData.append("longitude", coords.lng.toString());
      }

      if (autoEnhance && capturedMime.startsWith("image/")) {
        formData.append("auto_enhance", "true");
      }
      
      if (capturedMime.startsWith("image/")) {
        try {
          const faceapi = await import("@vladmandic/face-api");
          const MODEL_URL = "/models";
          await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          ]);
          
          const file = new File([capturedBlob], filename, { type: capturedMime });
          const img = await faceapi.bufferToImage(file);
          const detections = await faceapi.detectAllFaces(img).withFaceLandmarks().withFaceDescriptors();
          
          const facesData = detections.map(d => ({
            embedding: Array.from(d.descriptor),
            box: { 
              x: d.detection.box.x / img.width, 
              y: d.detection.box.y / img.height, 
              width: d.detection.box.width / img.width, 
              height: d.detection.box.height / img.height 
            },
            confidence: d.detection.score
          }));
          
          if (facesData.length > 0) {
            formData.append("faces", JSON.stringify(facesData));
          }
        } catch (e) {
          console.warn("[CameraCapture] Face extraction failed:", e);
        }
      }

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Upload failed");
      }

      setUploadProgress("Memory saved into your Universe!");
      setTimeout(() => {
        stopStream();
        onCaptureComplete();
        if (onClose) onClose();
      }, 700);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload error";
      alert(msg);
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    stopStream();
    if (onClose) onClose();
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="relative w-full max-w-3xl mx-auto rounded-3xl overflow-hidden bg-zinc-950 border border-white/10 shadow-2xl flex flex-col animate-fade-up select-none">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between p-4 bg-zinc-950/90 backdrop-blur-md z-20 border-b border-white/5">
        {/* Mode Selector Tabs */}
        <div className="flex items-center bg-white/5 p-1 rounded-2xl border border-white/10">
          <button
            onClick={() => setMode("photo")}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-xl text-xs font-medium transition-all ${
              mode === "photo"
                ? "bg-white text-zinc-950 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Photo</span>
          </button>

          <button
            onClick={() => setMode("video")}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-xl text-xs font-medium transition-all ${
              mode === "video"
                ? "bg-white text-zinc-950 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Video</span>
          </button>

          <button
            onClick={() => setMode("audio")}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-xl text-xs font-medium transition-all ${
              mode === "audio"
                ? "bg-white text-zinc-950 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Audio Memo</span>
          </button>
        </div>

        {/* Action Toggles */}
        <div className="flex items-center space-x-2">
          {mode === "photo" && (
            <>
              {/* Aspect Ratio Selector */}
              <div className="flex items-center bg-white/5 p-0.5 rounded-lg border border-white/10 text-[10px] font-mono">
                {(["4:3", "16:9", "1:1"] as const).map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={`px-1.5 py-0.5 rounded transition-all ${
                      aspectRatio === ratio
                        ? "bg-white text-zinc-950 font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>

              {/* Torch / Flash Toggle */}
              {torchAvailable && (
                <button
                  onClick={toggleTorch}
                  className={`p-2 rounded-xl text-xs transition-all ${
                    torchOn
                      ? "bg-amber-400/20 text-amber-300 border border-amber-400/40"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}
                  title={torchOn ? "Turn Flash Off" : "Turn Flash On"}
                >
                  {torchOn ? <Zap className="w-3.5 h-3.5 fill-current" /> : <ZapOff className="w-3.5 h-3.5" />}
                </button>
              )}

              {/* Zoom Slider */}
              {zoomRange && (
                <div className="hidden sm:flex items-center space-x-1.5 bg-white/5 px-2 py-1 rounded-lg border border-white/10 text-[10px] font-mono">
                  <span className="text-muted-foreground">{zoomLevel.toFixed(1)}x</span>
                  <input
                    type="range"
                    min={zoomRange.min}
                    max={zoomRange.max}
                    step={zoomRange.step || 0.1}
                    value={zoomLevel}
                    onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                    className="w-16 h-1 accent-primary cursor-pointer"
                  />
                </div>
              )}

              <button
                onClick={() => setTimerDuration((prev) => (prev === 0 ? 3 : prev === 3 ? 5 : 0))}
                className={`p-2 rounded-xl text-xs flex items-center space-x-1 transition-all ${
                  timerDuration > 0
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
                title="Timer"
              >
                <Clock className="w-3.5 h-3.5" />
                {timerDuration > 0 && <span className="font-mono">{timerDuration}s</span>}
              </button>

              <button
                onClick={() => setShowGrid((prev) => !prev)}
                className={`p-2 rounded-xl text-xs transition-all ${
                  showGrid
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
                title="Rule of Thirds Grid"
              >
                <Grid3X3 className="w-3.5 h-3.5" />
              </button>

              {/* Burst Mode Toggle */}
              <button
                onClick={() => setBurstMode((prev) => !prev)}
                className={`p-2 rounded-xl text-xs flex items-center space-x-1 transition-all ${
                  burstMode
                    ? "bg-amber-400/20 text-amber-300 border border-amber-400/40"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
                title={burstMode ? "Burst Mode Active (Multi-frame)" : "Enable Burst Mode"}
              >
                <Images className="w-3.5 h-3.5" />
                <span className="font-mono text-[10px]">Burst</span>
              </button>
            </>
          )}

          {/* Offline Vault Status Badge */}
          {isOffline ? (
            <div className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono">
              <WifiOff className="w-3 h-3 animate-pulse" />
              <span className="hidden sm:inline">Offline Vault</span>
            </div>
          ) : offlineQueueCount > 0 ? (
            <button
              onClick={syncOfflineQueue}
              disabled={syncingOffline}
              className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono hover:bg-emerald-500/30"
              title="Click to synchronize offline captures"
            >
              {syncingOffline ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wifi className="w-3 h-3" />}
              <span>Syncing ({offlineQueueCount})</span>
            </button>
          ) : null}

          {onClose && (
            <button
              onClick={handleClose}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 text-xs"
              title="Close Camera"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Viewport Area with Dynamic Aspect Ratio */}
      <div
        className={`relative bg-black flex items-center justify-center overflow-hidden transition-all duration-300 ${
          aspectRatio === "16:9"
            ? "aspect-[16/9] w-full"
            : aspectRatio === "1:1"
            ? "aspect-square w-full max-w-md mx-auto"
            : "aspect-[4/3] w-full max-w-xl mx-auto"
        }`}
      >
        {cameraError ? (
          <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-destructive opacity-80" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Media Device Permission Needed</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                {cameraError}. Please ensure camera/microphone permissions are granted in your browser.
              </p>
            </div>
            <button
              onClick={startStream}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-foreground rounded-xl text-xs"
            >
              Try Again
            </button>
          </div>
        ) : burstFrames.length > 0 ? (
          /* Burst Review Carousel */
          <div className="flex flex-col items-center justify-center p-4 space-y-3 w-full h-full bg-zinc-950 overflow-y-auto">
            <div className="flex items-center space-x-2 text-amber-400 font-mono text-xs">
              <Images className="w-4 h-4" />
              <span>{burstFrames.length} Frames Captured in Burst Sequence</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full max-w-md">
              {burstFrames.map((frame, idx) => (
                <div key={frame.id} className="relative aspect-square rounded-xl overflow-hidden border border-white/10 bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={frame.url} alt="" className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono text-white">
                    #{idx + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : previewUrl ? (
          /* Preview Mode */
          capturedMime.startsWith("video/") ? (
            <video src={previewUrl} controls autoPlay className="w-full h-full object-contain" />
          ) : capturedMime.startsWith("audio/") ? (
            <div className="flex flex-col items-center justify-center p-8 space-y-4 w-full">
              <div className="p-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Mic className="w-12 h-12 animate-pulse" />
              </div>
              <p className="text-sm font-medium text-foreground">Recorded Voice Memo</p>
              <audio src={previewUrl} controls className="w-full max-w-md" />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Captured" className="w-full h-full object-contain" />
          )
        ) : mode === "audio" ? (
          /* Live Audio Recording Interface */
          <div className="flex flex-col items-center justify-center p-8 space-y-6">
            <div
              className={`p-8 rounded-full border transition-all ${
                isRecording
                  ? "bg-rose-500/20 text-rose-400 border-rose-500/40 scale-110 animate-pulse"
                  : "bg-white/5 text-muted-foreground border-white/10"
              }`}
            >
              <Mic className="w-16 h-16" />
            </div>

            <div className="text-center space-y-1">
              <p className="text-lg font-mono font-light text-foreground">
                {isRecording ? formatSeconds(recordSeconds) : "Ready to record audio note"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isRecording ? "Recording your personal voice memo..." : "Click record below"}
              </p>
            </div>
          </div>
        ) : (
          /* Live Video Stream */
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{
                filter: activeFilter,
                transform: facingMode === "user" ? "scaleX(-1)" : "none",
              }}
            />

            {/* Recording indicator */}
            {isRecording && (
              <div className="absolute top-4 left-4 flex items-center space-x-2 bg-red-600/90 text-white px-3 py-1 rounded-full text-xs font-mono font-medium shadow-lg animate-pulse z-20">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                <span>REC {formatSeconds(recordSeconds)}</span>
              </div>
            )}

            {/* Grid overlay */}
            {showGrid && mode === "photo" && (
              <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 z-10">
                <div className="border-r border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div />
              </div>
            )}

            {/* Countdown */}
            {countdown !== null && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-30">
                <span className="text-8xl font-black text-white animate-ping tabular-nums">
                  {countdown}
                </span>
              </div>
            )}

            {/* Aspect Ratio HUD Badge */}
            {mode === "photo" && (
              <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5 z-20 pointer-events-none">
                <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-white/90 text-[10px] font-mono font-bold border border-white/20 tracking-wider">
                  {aspectRatio}
                </span>
                {burstMode && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/80 backdrop-blur-sm text-amber-950 text-[10px] font-mono font-bold border border-amber-400/40 tracking-wider">
                    BURST ×{burstCount}
                  </span>
                )}
                {activeFilter !== "none" && (
                  <span className="px-2 py-0.5 rounded-md bg-primary/70 backdrop-blur-sm text-white text-[9px] font-mono font-semibold border border-primary/30 tracking-wider uppercase">
                    {FILTERS.find((f) => f.value === activeFilter)?.name || ""}
                  </span>
                )}
              </div>
            )}

            {/* Crosshair focus indicator */}
            {mode === "photo" && !showGrid && !isRecording && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="w-10 h-10 opacity-30">
                  <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-white rounded-tl" />
                  <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-white rounded-tr" />
                  <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-white rounded-bl" />
                  <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-white rounded-br" />
                </div>
              </div>
            )}
          </>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Filter strip for photo mode */}
      {!previewUrl && mode === "photo" && !cameraError && (
        <div className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-zinc-950 border-t border-white/5 overflow-x-auto">
          <Sliders className="w-3.5 h-3.5 text-muted-foreground mr-1 shrink-0" />
          {FILTERS.map((f) => (
            <button
              key={f.name}
              onClick={() => setActiveFilter(f.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                activeFilter === f.value
                  ? "bg-white text-zinc-950 shadow-sm"
                  : "bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10"
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}

      {/* Bottom Action Bar */}
      <div className="p-4 bg-zinc-950/90 backdrop-blur-md border-t border-white/5 flex flex-col space-y-4">
        {burstFrames.length > 0 ? (
          /* Burst Review Actions */
          <div className="flex flex-col space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span className="font-mono text-amber-300">
                Burst Mode: {burstFrames.length} Frames
              </span>
              {coords && (
                <span className="flex items-center space-x-1 text-primary">
                  <MapPin className="w-3 h-3" />
                  <span>Geotagged</span>
                </span>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  setBurstFrames([]);
                  startStream();
                }}
                disabled={isUploading}
                className="flex-1 py-3 px-4 rounded-2xl bg-white/5 hover:bg-white/10 text-foreground text-sm font-medium transition-colors flex items-center justify-center space-x-2 border border-white/10"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Discard Burst</span>
              </button>

              <button
                onClick={handleUploadBurst}
                disabled={isUploading}
                className="flex-2 py-3 px-6 rounded-2xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all flex items-center justify-center space-x-2 shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{uploadProgress || "Saving Burst..."}</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Preserve {burstFrames.length} Photos</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : previewUrl ? (
          /* Preview Action Buttons */
          <div className="flex flex-col space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span className="flex items-center space-x-1.5 font-mono">
                <span>Format:</span>
                <span className="uppercase text-foreground">{capturedMime.split("/")[0]}</span>
              </span>
              {coords && (
                <span className="flex items-center space-x-1 text-primary">
                  <MapPin className="w-3 h-3" />
                  <span>Geotagged</span>
                </span>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleRetake}
                disabled={isUploading}
                className="flex-1 py-3 px-4 rounded-2xl bg-white/5 hover:bg-white/10 text-foreground text-sm font-medium transition-colors flex items-center justify-center space-x-2 border border-white/10"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Retake</span>
              </button>

              <button
                onClick={handleSaveMemory}
                disabled={isUploading}
                className="flex-2 py-3 px-6 rounded-2xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all flex items-center justify-center space-x-2 shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{uploadProgress || "Saving..."}</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save to Universe</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Live Trigger Bar */
          <div className="flex items-center justify-between px-6">
            {/* GPS toggle */}
            <button
              onClick={() => setIncludeLocation((prev) => !prev)}
              className={`p-3 rounded-full transition-all ${
                includeLocation
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "text-muted-foreground hover:bg-white/5"
              }`}
              title={includeLocation ? "GPS Geotagging Active" : "GPS Geotagging Inactive"}
            >
              <MapPin className="w-5 h-5" />
            </button>

            {/* Shutter / Record Trigger Button */}
            {mode === "photo" ? (
              <button
                onClick={handleSnapClick}
                disabled={Boolean(cameraError)}
                className="relative p-1.5 rounded-full border-4 border-white/20 hover:border-white transition-all transform active:scale-95 group disabled:opacity-40"
                title="Take Photo"
              >
                <div className="w-16 h-16 rounded-full bg-white group-hover:scale-95 transition-transform flex items-center justify-center shadow-lg shadow-white/10">
                  <div className="w-14 h-14 rounded-full border-2 border-zinc-950" />
                </div>
              </button>
            ) : isRecording ? (
              <button
                onClick={stopRecording}
                className="p-3 rounded-full bg-red-600 text-white shadow-xl hover:bg-red-500 transition-all scale-110 flex items-center justify-center"
                title="Stop Recording"
              >
                <Square className="w-8 h-8 fill-current" />
              </button>
            ) : (
              <button
                onClick={startRecording}
                disabled={Boolean(cameraError)}
                className="p-3 rounded-full bg-rose-600 text-white shadow-xl hover:bg-rose-500 transition-all flex items-center justify-center group"
                title={mode === "video" ? "Start Video Recording" : "Start Audio Recording"}
              >
                <div className="w-12 h-12 rounded-full border-2 border-white flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full bg-white group-hover:scale-110 transition-transform" />
                </div>
              </button>
            )}

            {/* Flip Camera (disabled in audio mode) */}
            <button
              onClick={() => setFacingMode((f) => (f === "user" ? "environment" : "user"))}
              disabled={mode === "audio"}
              className="p-3 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all disabled:opacity-20"
              title="Flip Camera"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
