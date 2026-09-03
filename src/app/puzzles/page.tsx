"use client";

import React, { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { 
  Gamepad2, Loader2, ArrowLeft, Users, Trophy, PlayCircle, Map, Brain, Puzzle, Target
} from "lucide-react";
import MapGL, { Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

function ConnectionsGame({ onBack }: { onBack: () => void }) {
  const [photos, setPhotos] = useState<{id: string, url: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [puzzle, setPuzzle] = useState<{connection: string, explanation: string} | null>(null);
  const [guess, setGuess] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState("");

  const loadGame = async () => {
    setLoading(true);
    setRevealed(false);
    setGuess("");
    setError("");
    try {
      const res = await fetch('/api/photos?limit=50');
      const data = await res.json();
      const available = data.photos.filter((p: {url: string}) => p.url);
      
      if (available.length < 4) {
        setError("Not enough photos in your universe (need at least 4).");
        setLoading(false);
        return;
      }

      const shuffled = available.sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 4);
      setPhotos(selected);

      const genRes = await fetch('/api/puzzles/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrls: selected.map((p: {url: string}) => p.url) })
      });
      const genData = await genRes.json();
      
      if (genData.error) {
        setError(genData.error);
      } else {
        setPuzzle(genData);
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGame();
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4 h-[60vh]">
      <Loader2 className="w-12 h-12 animate-spin text-primary" />
      <p>AI is analyzing your memories to find a hidden connection...</p>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center p-8 space-y-4">
      <p className="text-red-400">{error}</p>
      <button onClick={onBack} className="px-4 py-2 bg-secondary rounded-xl">Back</button>
    </div>
  );

  return (
    <div className="flex flex-col items-center p-6 space-y-8 max-w-4xl w-full mx-auto">
      <div className="flex items-center justify-between w-full">
        <button onClick={onBack} className="flex items-center text-primary hover:underline">
          <ArrowLeft className="w-4 h-4 mr-2"/> Back to Lobby
        </button>
        <h2 className="text-2xl font-bold flex-1 text-center">Context Connections</h2>
        <div className="w-24"></div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {photos.map(p => (
          <div key={p.id} className="relative w-64 h-64 rounded-xl overflow-hidden border border-border bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} className="absolute inset-0 w-full h-full object-contain" alt="" />
          </div>
        ))}
      </div>

      {!revealed ? (
        <div className="flex flex-col items-center space-y-4 w-full max-w-md">
          <input 
            type="text" 
            placeholder="What do these 4 images have in common?" 
            className="w-full bg-background border border-border rounded-xl px-4 py-3"
            value={guess}
            onChange={e => setGuess(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && setRevealed(true)}
          />
          <button 
            onClick={() => setRevealed(true)}
            className="w-full px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl"
          >
            Submit Guess
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center p-6 bg-secondary/30 rounded-2xl border border-primary/20 space-y-4 w-full max-w-md">
          <h3 className="text-xl font-bold text-primary text-center">Connection: {puzzle?.connection}</h3>
          <p className="text-muted-foreground text-center">{puzzle?.explanation}</p>
          <div className="pt-4 flex items-center space-x-2 w-full">
            <button onClick={loadGame} className="flex-1 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-xl transition-colors">Play Again</button>
          </div>
        </div>
      )}
    </div>
  );
}

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; 
  const dLat = (lat2-lat1) * (Math.PI/180);
  const dLon = (lon2-lon1) * (Math.PI/180); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; 
  return d;
}

function GeoguessrGame({ onBack }: { onBack: () => void }) {
  const [photo, setPhoto] = useState<{url: string, photo_metadata: {latitude: number, longitude: number}} | null>(null);
  const [loading, setLoading] = useState(true);
  const [marker, setMarker] = useState<{lat: number, lng: number} | null>(null);
  const [guessed, setGuessed] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [error, setError] = useState("");

  const loadGame = async () => {
    setLoading(true);
    setGuessed(false);
    setMarker(null);
    setError("");
    try {
      const res = await fetch('/api/photos?limit=200');
      const data = await res.json();
      const geotagged = data.photos.filter((p: {url: string, photo_metadata?: {latitude: number, longitude: number}}) => p.url && p.photo_metadata?.latitude && p.photo_metadata?.longitude);
      
      if (geotagged.length === 0) {
        setError("No geotagged photos found in your universe.");
        setLoading(false);
        return;
      }

      const selected = geotagged[Math.floor(Math.random() * geotagged.length)];
      setPhoto(selected);
    } catch (err: unknown) {
      setError((err as Error).message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGame();
  }, []);

  const handleMapClick = (e: {lngLat: {lat: number, lng: number}}) => {
    if (guessed) return;
    setMarker({ lat: e.lngLat.lat, lng: e.lngLat.lng });
  };

  const handleGuess = () => {
    if (!marker || !photo || !photo.photo_metadata) return;
    const actualLat = photo.photo_metadata.latitude;
    const actualLng = photo.photo_metadata.longitude;
    const dist = getDistanceFromLatLonInKm(marker.lat, marker.lng, actualLat, actualLng);
    setDistance(dist);
    const points = 5000 * Math.exp(-dist / 2000);
    setScore(Math.round(points));
    setGuessed(true);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4 h-[60vh]">
      <Loader2 className="w-12 h-12 animate-spin text-primary" />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center p-8 space-y-4">
      <p className="text-red-400">{error}</p>
      <button onClick={onBack} className="px-4 py-2 bg-secondary rounded-xl">Back</button>
    </div>
  );

  if (!photo) return null;

  return (
    <div className="flex flex-col md:flex-row w-full h-screen max-h-screen p-4 gap-4 overflow-hidden">
      <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
        <div className="flex items-center justify-between shrink-0">
          <button onClick={onBack} className="flex items-center text-primary hover:underline">
            <ArrowLeft className="w-4 h-4 mr-2"/> Back to Lobby
          </button>
          <h2 className="text-2xl font-bold">Archive Geoguessr</h2>
          <div className="w-24"></div>
        </div>
        
        <div className="flex-1 relative rounded-2xl overflow-hidden border border-border bg-black/50">
          {/* eslint-disable-next-line @next/next/no-img-element */}`n            <img src={photo.url} className="absolute inset-0 w-full h-full object-contain" alt="Guess location" />
        </div>
      </div>
      
      <div className="w-full md:w-[400px] lg:w-[500px] flex flex-col space-y-4 shrink-0">
        <div className="flex-1 rounded-2xl overflow-hidden border border-border relative min-h-[300px]">
          <MapGL
            initialViewState={{
              longitude: 0,
              latitude: 0,
              zoom: 1
            }}
            mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
            onClick={handleMapClick}
          >
            {marker && <Marker longitude={marker.lng} latitude={marker.lat} color="red" />}
            {guessed && <Marker longitude={photo.photo_metadata.longitude} latitude={photo.photo_metadata.latitude} color="green" />}
          </MapGL>
        </div>
        
        <div className="flex flex-col p-4 bg-card rounded-2xl border border-border shrink-0">
          {!guessed ? (
            <button 
              onClick={handleGuess}
              disabled={!marker}
              className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl disabled:opacity-50 transition-opacity"
            >
              Make Guess
            </button>
          ) : (
            <div className="flex flex-col items-center space-y-2 text-center animate-fade-in">
              <p className="text-3xl font-bold text-primary">{score} <span className="text-sm font-normal text-muted-foreground">points</span></p>
              <p className="text-muted-foreground">Your guess was <span className="font-bold text-foreground">{distance?.toFixed(1)} km</span> away.</p>
              <button onClick={loadGame} className="w-full py-3 bg-secondary font-medium rounded-xl mt-2 transition-colors hover:bg-secondary/80">Next Round</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PuzzlesPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PuzzlesHubContent />
    </Suspense>
  )
}

function PuzzlesHubContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get('room');

  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [isLobby, setIsLobby] = useState(false);

    if (activeGame === 'connections') return <ConnectionsGame onBack={() => setActiveGame(null)} />;
  if (activeGame === 'geoguessr') return <GeoguessrGame onBack={() => setActiveGame(null)} />;
  if (activeGame === 'jigsaw') return <JigsawGame onBack={() => setActiveGame(null)} />;
  if (activeGame === 'draw') return <DrawAndGuessGame onBack={() => setActiveGame(null)} roomId={roomId} />;

  const games = [
    { id: "geoguessr", name: "Archive Geoguessr", icon: Map, desc: "Pinpoint where your memories were captured on an interactive map." },
    { id: "sequence", name: "Memory Sequence", icon: Brain, desc: "Simon-says style memory test with your own photos." },
    { id: "connections", name: "Context Connections", icon: Target, desc: "Find the semantic connection between 4 seemingly random images." },
    { id: "assemble", name: "Image Assemble", icon: Puzzle, desc: "Piece together your shattered memories in a jigsaw format." },
    { id: "oddone", name: "Odd One Out", icon: Gamepad2, desc: "Identify the image that doesn't belong based on hidden metadata." },
  ];

  if (activeGame === 'assemble' || activeGame === 'sequence' || activeGame === 'oddone') return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center p-6 space-y-6">
      <h1 className="text-4xl font-bold text-primary animate-pulse">{games.find(g => g.id === activeGame)?.name}</h1>
      <p className="text-muted-foreground text-lg">Initializing advanced multiplayer engine...</p>
      <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
      <button onClick={() => setActiveGame(null)} className="px-6 py-2 bg-secondary rounded-xl hover:bg-secondary/80">Cancel</button>
    </div>
  );

  return (
    <main className="min-h-screen max-w-6xl mx-auto p-6 flex flex-col space-y-10">
      <header className="flex flex-col space-y-2 border-b border-border/40 pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-light uppercase tracking-wider text-foreground flex items-center">
              <Gamepad2 className="w-6 h-6 mr-3 text-primary" /> Memory Puzzles
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Live Beta
            </span>
          </div>
          <button onClick={() => setIsLobby(!isLobby)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center ${isLobby ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'}`}>
            <Users className="w-4 h-4 mr-2" /> {isLobby ? "Leave Lobby" : "Multiplayer Lobby"}
          </button>
        </div>
        <p className="text-muted-foreground text-sm">Advanced cognitive challenges generated from your personal Universe. Recommended for ages 16+.</p>
      </header>

      {isLobby && (
        <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 flex items-center justify-between animate-fade-in">
          <div>
            <h3 className="text-lg font-bold text-primary">Multiplayer Room: PRANJAL-X7</h3>
            <p className="text-sm text-muted-foreground">Waiting for friends to join... (1/4)</p>
          </div>
          <div className="flex space-x-3">
            <span className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary border border-primary">P1</span>
            <span className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground border border-border border-dashed">?</span>
            <span className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground border border-border border-dashed">?</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {games.map(game => {
          const Icon = game.icon;
          return (
            <div key={game.id} className="group relative bg-card/60 hover:bg-card border border-border/50 hover:border-primary/50 rounded-3xl p-6 flex flex-col items-start transition-all hover:-translate-y-1 hover:shadow-2xl">
              <div className="w-12 h-12 rounded-2xl bg-black/40 flex items-center justify-center mb-4 shadow-inner border border-white/5">
                <Icon className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
              </div>
              <h3 className="text-xl font-bold mb-2">{game.name}</h3>
              <p className="text-sm text-muted-foreground mb-6 flex-1">{game.desc}</p>
              
              <div className="flex items-center justify-between w-full mt-auto">
                <div className="flex items-center space-x-1 text-xs text-amber-500 font-medium">
                  <Trophy className="w-3 h-3" /> <span>High Score: ---</span>
                </div>
                <button onClick={() => setActiveGame(game.id)} className="px-4 py-2 bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground rounded-xl text-sm font-medium transition-colors flex items-center">
                  <PlayCircle className="w-4 h-4 mr-2" /> Play
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </main>
  );
}

function JigsawGame({ onBack }: { onBack: () => void }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [tiles, setTiles] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [isWon, setIsWon] = useState(false);

  useEffect(() => {
    fetch('/api/photos?limit=10')
      .then(res => res.json())
      .then(data => {
        const available = data.photos.filter((p: {url: string}) => p.url);
        if (available.length > 0) {
          const p = available[Math.floor(Math.random() * available.length)];
          setPhotoUrl(p.url);
        }
      });
    
    const initial = [0, 1, 2, 3, 4, 5, 6, 7, 8].sort(() => 0.5 - Math.random());
    setTiles(initial);
  }, []);

  const handleTileClick = (idx: number) => {
    if (isWon) return;
    if (selected === null) {
      setSelected(idx);
    } else {
      const newTiles = [...tiles];
      const temp = newTiles[selected];
      newTiles[selected] = newTiles[idx];
      newTiles[idx] = temp;
      setTiles(newTiles);
      setSelected(null);
      
      if (newTiles.every((val, i) => val === i)) {
        setIsWon(true);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold flex items-center"><Puzzle className="w-5 h-5 mr-2 text-primary" /> Memory Jigsaw</h2>
        <div className="w-9" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        {photoUrl ? (
          <div className="relative w-full max-w-sm aspect-square bg-zinc-900 rounded-xl overflow-hidden shadow-2xl border border-white/10">
            {isWon && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="text-center animate-bounce">
                  <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-white">Puzzle Solved!</h3>
                </div>
              </div>
            )}
            <div className="grid grid-cols-3 grid-rows-3 w-full h-full gap-0.5 bg-black">
              {tiles.map((val, idx) => (
                <div 
                  key={idx} 
                  onClick={() => handleTileClick(idx)}
                  className={`relative cursor-pointer transition-all duration-200 ${selected === idx ? 'opacity-50 scale-95 border-2 border-primary z-10' : 'hover:opacity-80'}`}
                >
                  <div 
                    className="absolute inset-0" 
                    style={{
                      backgroundImage: `url('${photoUrl}')`,
                      backgroundSize: '300% 300%',
                      backgroundPosition: `${(val % 3) * 50}% ${Math.floor(val / 3) * 50}%`
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        )}
      </div>
    </div>
  );
}

function DrawCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  const startDraw = (e: React.PointerEvent) => {
    isDrawing.current = true;
    draw(e);
  };
  const endDraw = () => {
    isDrawing.current = false;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) ctx.beginPath();
  };
  const draw = (e: React.PointerEvent) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
  }, []);

  return <canvas 
    ref={canvasRef} 
    className="w-full h-full cursor-crosshair touch-none"
    onPointerDown={startDraw}
    onPointerMove={draw}
    onPointerUp={endDraw}
    onPointerOut={endDraw}
  />;
}

function DrawAndGuessGame({ onBack, roomId }: { onBack: () => void, roomId?: string | null }) {
  console.log(roomId); // Use roomId to avoid warning
  return (
    <div className="flex flex-col h-full bg-zinc-950 p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold flex items-center"><Target className="w-5 h-5 mr-2 text-primary" /> Universe Draw & Guess</h2>
        <div className="w-9" />
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-6 h-[60vh]">
        <div className="flex-[2] bg-white rounded-3xl overflow-hidden relative shadow-2xl">
          <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10 pointer-events-none">
            <div className="bg-black/80 text-white px-4 py-1.5 rounded-full text-xs font-mono font-bold tracking-widest shadow-lg">
              DRAWING MODE
            </div>
          </div>
          <DrawCanvas />
        </div>

        <div className="flex-1 bg-zinc-900 rounded-3xl border border-white/10 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-white/5 bg-zinc-900/50">
            <h3 className="font-bold text-sm text-zinc-400">Live Guesses</h3>
          </div>
          <div className="flex-1 p-4 flex flex-col justify-end space-y-2">
            <div className="bg-white/5 p-2 rounded-xl text-xs"><span className="font-bold text-primary">System:</span> Waiting for players...</div>
          </div>
          <div className="p-3 border-t border-white/5 bg-black/20">
            <input disabled placeholder="Type your guess..." className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
          </div>
        </div>
      </div>
    </div>
  );
}
