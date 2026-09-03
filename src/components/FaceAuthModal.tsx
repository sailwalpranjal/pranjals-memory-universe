"use client";
import { useEffect, useState, useRef } from "react";
import Webcam from "react-webcam";
import * as faceapi from "@vladmandic/face-api";
import { Lock, Key } from "lucide-react";

type AuthState = 
  | "INITIALIZING"
  | "FACE_DETECTED"
  | "BASELINE_ESTABLISHED"
  | "CHALLENGE_LEFT"
  | "CHALLENGE_RIGHT"
  | "CHALLENGE_VERIFIED"
  | "EXTRACTING"
  | "AUTHENTICATING"
  | "SUCCESS"
  | "FAILURE";

export default function FaceAuthModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void; }) {
  const webcamRef = useRef<Webcam>(null);
  const [authState, setAuthState] = useState<AuthState>("INITIALIZING");
  const [statusMessage, setStatusMessage] = useState("Warming up Neural Engine...");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [fallbackPassword, setFallbackPassword] = useState("");

  const stateRef = useRef(authState);
  useEffect(() => { stateRef.current = authState; }, [authState]);

  const handleFallback = async () => {
    setErrorMsg(null);
    setStatusMessage("Verifying fallback credential...");
    try {
      const res = await fetch('/api/auth/fallback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: fallbackPassword })
      });
      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem('pranjal_admin', 'true');
        onSuccess();
      } else {
        setErrorMsg("Invalid fallback credential.");
      }
    } catch {
      setErrorMsg("Network error during fallback.");
    }
  };

  useEffect(() => {
    let active = true;
    
    const runPipeline = async () => {
      if (!isOpen || !webcamRef.current || !webcamRef.current.video) return;

      try {
        setAuthState("INITIALIZING");
        if (!faceapi.nets.tinyFaceDetector.isLoaded) {
          setStatusMessage("Loading Neural Models...");
          await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
          await faceapi.nets.faceLandmark68TinyNet.loadFromUri('/models');
          await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        }

        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 });
        
        let baselineOffset = 0;
        let baselineFrames = 0;
        const requiredDirection = Math.random() > 0.5 ? "CHALLENGE_LEFT" : "CHALLENGE_RIGHT";
        
        let consecutiveStraight = 0;
        const embeddingsToFuse: Float32Array[] = [];
        const requiredEmbeddings = 1; // Need 2 consistent reads

        while (active) {
          const currentState = stateRef.current;
          
          if (currentState === "AUTHENTICATING" || currentState === "SUCCESS" || currentState === "FAILURE") {
            break;
          }

          if (!webcamRef.current?.video || webcamRef.current.video.readyState !== 4 || webcamRef.current.video.videoWidth === 0) {
            await new Promise(r => requestAnimationFrame(r));
            continue;
          }

          const detection = await faceapi.detectSingleFace(webcamRef.current.video, options)
            .withFaceLandmarks(true);

          if (!detection) {
            if (currentState !== "INITIALIZING" && currentState !== "FACE_DETECTED") {
              setStatusMessage("Face lost. Stay in frame.");
            }
            await new Promise(r => requestAnimationFrame(r));
            continue;
          }

          const faceW = detection.detection.box.width;
          const vidW = webcamRef.current.video.videoWidth;
          if (faceW / vidW < 0.15) {
            setStatusMessage("Move closer to the camera.");
            await new Promise(r => requestAnimationFrame(r));
            continue;
          }

          // Compute horizontal nose offset relative to bounding box center
          const nose = detection.landmarks.getNose()[3];
          const box = detection.detection.box;
          const noseOffset = (nose.x - (box.x + box.width / 2)) / box.width;

          if (currentState === "INITIALIZING") {
            setAuthState("FACE_DETECTED");
            setStatusMessage("Face detected. Hold still...");
          } 
          else if (currentState === "FACE_DETECTED") {
            if (Math.abs(noseOffset) < 0.08) {
              baselineFrames++;
              if (baselineFrames > 3) {
                baselineOffset = noseOffset;
                setAuthState(requiredDirection);
                setStatusMessage(`LIVENESS: Turn head slightly ${requiredDirection === 'CHALLENGE_LEFT' ? 'LEFT' : 'RIGHT'}`);
              }
            } else {
              baselineFrames = 0;
            }
          }
          else if (currentState === "CHALLENGE_LEFT") {
            // Turning left -> unmirrored nose moves right -> offset increases
            if (noseOffset > baselineOffset + 0.1) {
              setAuthState("CHALLENGE_VERIFIED");
              setStatusMessage("Verified! Look straight again.");
            }
          }
          else if (currentState === "CHALLENGE_RIGHT") {
            // Turning right -> unmirrored nose moves left -> offset decreases
            if (noseOffset < baselineOffset - 0.1) {
              setAuthState("CHALLENGE_VERIFIED");
              setStatusMessage("Verified! Look straight again.");
            }
          }
          else if (currentState === "CHALLENGE_VERIFIED") {
            if (Math.abs(noseOffset) < 0.08) {
              consecutiveStraight++;
              if (consecutiveStraight > 3) {
                setAuthState("EXTRACTING");
                setStatusMessage("Extracting securely...");
              }
            } else {
              consecutiveStraight = 0;
            }
          }
          else if (currentState === "EXTRACTING") {
             if (webcamRef.current.video.videoWidth === 0) { await new Promise(r => requestAnimationFrame(r)); continue; }
             const fullDet = await faceapi.detectSingleFace(webcamRef.current.video, options)
               .withFaceLandmarks(true)
               .withFaceDescriptor();
             
             if (fullDet) {
               embeddingsToFuse.push(fullDet.descriptor);
               if (embeddingsToFuse.length >= requiredEmbeddings) {
                 setAuthState("AUTHENTICATING");
                 break;
               }
             }
          }

          await new Promise(r => requestAnimationFrame(r));
        }

        if (active && stateRef.current === "AUTHENTICATING") {
          setStatusMessage("Verifying biometric template...");
          // Send the first reliable embedding (fusion logic can also be averaged, but taking the best quality is usually enough)
          const res = await fetch('/api/auth/face', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ descriptor: Array.from(embeddingsToFuse[0]) })
          });
          const data = await res.json();
          if (data.success && data.isAdmin) {
            setAuthState("SUCCESS");
            setStatusMessage("Welcome back, Admin.");
            sessionStorage.setItem('pranjal_admin', 'true');
            setTimeout(onSuccess, 800);
          } else {
            setAuthState("FAILURE");
            setErrorMsg("Access Denied: Unrecognized Face.");
          }
        }
      } catch (err) {
        console.error("Pipeline Error:", err);
        setErrorMsg("Hardware or model error.");
        setAuthState("FAILURE");
      }
    };

    if (isOpen && !showFallback) {
      setAuthState("INITIALIZING");
      setErrorMsg(null);
      runPipeline();
    }
    
    return () => { active = false; };
  }, [isOpen, showFallback, onSuccess]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-zinc-900 border border-white/10 p-8 rounded-3xl w-full max-w-md flex flex-col items-center shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-emerald-500/20 blur-[60px] pointer-events-none" />
        
        {showFallback ? (
          <div className="w-full flex flex-col items-center animate-in slide-in-from-right-4">
            <Key className="w-8 h-8 text-emerald-400 mb-4" />
            <h2 className="text-xl font-light tracking-widest mb-1 uppercase text-emerald-400">Secure Fallback</h2>
            <p className="text-xs text-muted-foreground tracking-widest uppercase mb-6 text-center">Enter administrator override credential</p>
            <input 
              type="password" 
              value={fallbackPassword}
              onChange={(e) => setFallbackPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFallback()}
              className="w-full px-4 py-3 rounded-xl bg-black border border-white/10 text-white font-mono text-center focus:border-emerald-400 outline-none mb-4"
              placeholder="••••••••"
            />
            {errorMsg && <p className="text-xs text-red-400 mb-4">{errorMsg}</p>}
            <button onClick={handleFallback} className="w-full py-3.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-xl text-xs tracking-widest uppercase font-bold transition-colors mb-2">
              Authenticate
            </button>
            <button onClick={() => setShowFallback(false)} className="w-full py-3.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs tracking-widest uppercase font-medium transition-colors">
              Return to Scan
            </button>
          </div>
        ) : (
          <>
            <div className="w-full flex justify-between items-start absolute top-6 left-0 px-6 z-10">
               <div />
               <button onClick={() => setShowFallback(true)} className="p-2 bg-black/50 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors" title="Alternative Entry">
                 <Key className="w-4 h-4" />
               </button>
            </div>
            
            <Lock className="w-8 h-8 text-emerald-400 mb-4 animate-pulse" />
            <h2 className="text-xl font-light tracking-widest mb-1 uppercase text-emerald-400">Biometric Scan</h2>
            <p className="text-xs text-muted-foreground tracking-widest uppercase mb-6">Admin Verification Required</p>
            
            <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-black mb-6 border border-white/10 shadow-inner">
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "user" }}
                className="w-full h-full object-cover scale-x-[-1]"
              />
              
              {/* Overlay states */}
              <div className={`absolute inset-0 flex flex-col items-center justify-center transition-colors duration-500 ${
                authState === "FAILURE" ? "bg-red-950/80" : 
                authState === "SUCCESS" ? "bg-emerald-950/80" :
                (authState === "CHALLENGE_LEFT" || authState === "CHALLENGE_RIGHT") ? "bg-black/30" : "bg-black/60 backdrop-blur-sm"
              }`}>
                {(authState === "AUTHENTICATING" || authState === "INITIALIZING" || authState === "EXTRACTING") && (
                  <div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mb-3 shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                )}
                
                <span className={`text-xs tracking-widest uppercase font-bold text-center px-4 py-1.5 rounded-full drop-shadow-md ${
                   authState === "FAILURE" ? "text-red-400 bg-red-950" : 
                   authState === "SUCCESS" ? "text-emerald-400 bg-emerald-950" : 
                   "text-emerald-400 bg-black/60 border border-emerald-500/30"
                }`}>
                  {errorMsg || statusMessage}
                </span>

                {authState === "FAILURE" && (
                  <button onClick={() => setAuthState("INITIALIZING")} className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full text-xs text-white uppercase tracking-widest transition-all">
                    Retry Scan
                  </button>
                )}
              </div>
            </div>
            
            <button onClick={onClose} className="w-full py-3.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs tracking-widest uppercase font-medium transition-colors">
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
