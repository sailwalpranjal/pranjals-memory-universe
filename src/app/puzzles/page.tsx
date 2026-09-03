"use client";

import { useState, useEffect } from "react";
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
          <img src={photo.url} className="absolute inset-0 w-full h-full object-contain" alt="Guess location" />
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
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [isLobby, setIsLobby] = useState(false);

  if (activeGame === 'connections') return <ConnectionsGame onBack={() => setActiveGame(null)} />;
  if (activeGame === 'geoguessr') return <GeoguessrGame onBack={() => setActiveGame(null)} />;

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
