"use client";
import { useEffect, useState, useRef } from "react";
import Webcam from "react-webcam";
import * as faceapi from "@vladmandic/face-api";
import { ScanFace, Check, ArrowRight, ShieldAlert, Loader2 } from "lucide-react";

export default function AdminEnrollment() {
  const webcamRef = useRef<Webcam>(null);
  const [phase, setPhase] = useState<"IDLE" | "LOADING" | "CENTER" | "LEFT" | "RIGHT" | "UPLOADING" | "SUCCESS" | "ERROR">("IDLE");
  const [message, setMessage] = useState("Admin Facial Enrollment");
  const [descriptors, setDescriptors] = useState<Float32Array[]>([]);

  useEffect(() => {
    if (phase !== "LOADING") return;
    
    let active = true;
    const initAndRun = async () => {
      try {
        setMessage("Loading neural models...");
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceLandmark68TinyNet.loadFromUri('/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        
        if (active) setPhase("CENTER");
      } catch {
        if (active) {
          setMessage("Failed to load models. Check network.");
          setPhase("ERROR");
        }
      }
    };
    initAndRun();
    return () => { active = false; };
  }, [phase]);

  useEffect(() => {
    if (phase !== "CENTER" && phase !== "LEFT" && phase !== "RIGHT") return;
    
    let active = true;
    const captureLoop = async () => {
      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
      
            let consecutiveFrames = 0;

      while (active) {
        if (!webcamRef.current?.video) {
          await new Promise(r => requestAnimationFrame(r));
          continue;
        }

        const det = await faceapi.detectSingleFace(webcamRef.current.video, options)
          .withFaceLandmarks(true)
          .withFaceDescriptor();

        if (!det) {
          setMessage("Face not detected. Stay in frame.");
          await new Promise(r => requestAnimationFrame(r));
          continue;
        }

        const faceW = det.detection.box.width;
        const vidW = webcamRef.current.video.videoWidth;
        if (faceW / vidW < 0.2) {
          setMessage("Move closer. Face too small.");
          await new Promise(r => requestAnimationFrame(r));
          continue;
        }
        if (det.detection.score < 0.8) {
          setMessage("Improve lighting or face the camera directly.");
          await new Promise(r => requestAnimationFrame(r));
          continue;
        }

        const nose = det.landmarks.getNose()[3];
        const box = det.detection.box;
        const offset = (nose.x - (box.x + box.width / 2)) / box.width;

        if (phase === "CENTER") {
          setMessage("Look perfectly straight at the camera...");
          if (Math.abs(offset) < 0.08) {
            consecutiveFrames++;
            if (consecutiveFrames > 5) {
              setDescriptors(d => [...d, det.descriptor]);
              setPhase("LEFT");
              break;
            }
          } else {
            consecutiveFrames = 0;
          }
        } 
        else if (phase === "LEFT") {
          setMessage("Turn head slightly LEFT...");
          if (offset > 0.12) {
            consecutiveFrames++;
            if (consecutiveFrames > 3) {
              setDescriptors(d => [...d, det.descriptor]);
              setPhase("RIGHT");
              break;
            }
          } else {
            consecutiveFrames = 0;
          }
        }
        else if (phase === "RIGHT") {
          setMessage("Turn head slightly RIGHT...");
          if (offset < -0.12) {
            consecutiveFrames++;
            if (consecutiveFrames > 3) {
              setDescriptors(d => [...d, det.descriptor]);
              setPhase("UPLOADING");
              break;
            }
          } else {
            consecutiveFrames = 0;
          }
        }

        await new Promise(r => requestAnimationFrame(r));
      }
    };
    
    captureLoop();
    return () => { active = false; };
  }, [phase]);

  useEffect(() => {
    if (phase !== "UPLOADING") return;
    
    const upload = async () => {
      setMessage("Securing biometric template...");
      try {
        const payload = descriptors.map(d => Array.from(d));
        const res = await fetch('/api/admin/enroll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ descriptors: payload })
        });
        const data = await res.json();
        
        if (data.success) {
          setMessage("Enrollment Complete. Identity Secured.");
          setPhase("SUCCESS");
        } else {
          setMessage(data.error || "Failed to save enrollment.");
          setPhase("ERROR");
        }
      } catch {
        setMessage("Network error during enrollment.");
        setPhase("ERROR");
      }
    };
    upload();
  }, [phase, descriptors]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 font-mono">
      <div className="max-w-md w-full bg-zinc-950 border border-white/10 rounded-3xl p-8 flex flex-col items-center shadow-2xl relative overflow-hidden">
        
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-emerald-500/10 blur-[60px] pointer-events-none" />
        
        <ShieldAlert className="w-8 h-8 text-emerald-400 mb-4" />
        <h1 className="text-xl tracking-widest uppercase text-emerald-400 font-bold mb-8 text-center">Secure Admin Enrollment</h1>
        
        <div className="w-full aspect-square rounded-2xl overflow-hidden bg-black mb-8 border border-white/10 relative">
          {phase !== "IDLE" && phase !== "SUCCESS" && phase !== "ERROR" && (
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={{ facingMode: "user" }}
              className="w-full h-full object-cover scale-x-[-1]"
            />
          )}
          
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-black/20">
            {phase === "IDLE" && <ScanFace className="w-16 h-16 text-white/20 mb-4" />}
            {phase === "SUCCESS" && <Check className="w-16 h-16 text-emerald-400 mb-4" />}
            {phase === "ERROR" && <ShieldAlert className="w-16 h-16 text-red-400 mb-4" />}
            
            <span className="bg-black/80 px-4 py-2 rounded-full text-xs font-bold tracking-widest uppercase text-emerald-400 text-center mx-4">
              {message}
            </span>
          </div>

          {(phase === "LOADING" || phase === "UPLOADING") && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <Loader2 className="w-10 h-10 animate-spin text-emerald-400" />
            </div>
          )}
        </div>

        {phase === "IDLE" && (
          <button 
            onClick={() => setPhase("LOADING")}
            className="w-full py-4 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-xl text-xs tracking-widest uppercase font-bold flex items-center justify-center space-x-2 transition-colors"
          >
            <span>Begin Calibration</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
        
        {(phase === "SUCCESS" || phase === "ERROR") && (
          <button 
            onClick={() => window.location.href = "/"}
            className="w-full py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs tracking-widest uppercase font-bold transition-colors"
          >
            Return to Dashboard
          </button>
        )}
        
      </div>
    </div>
  );
}
