"use client";

import { useState } from "react";
import { 
  Gamepad2, Loader2, ArrowLeft, Users, Trophy, PlayCircle, Map, Brain, Puzzle, Target
} from "lucide-react";

export default function PuzzlesPage() {
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [isLobby, setIsLobby] = useState(false);

  const games = [
    { id: "geoguessr", name: "Archive Geoguessr", icon: Map, desc: "Pinpoint where your memories were captured on an interactive map." },
    { id: "sequence", name: "Memory Sequence", icon: Brain, desc: "Simon-says style memory test with your own photos." },
    { id: "connections", name: "Context Connections", icon: Target, desc: "Find the semantic connection between 4 seemingly random images." },
    { id: "assemble", name: "Image Assemble", icon: Puzzle, desc: "Piece together your shattered memories in a jigsaw format." },
    { id: "oddone", name: "Odd One Out", icon: Gamepad2, desc: "Identify the image that doesn't belong based on hidden metadata." },
  ];

  if (activeGame === 'assemble') return (
    <div className="p-4 min-h-screen flex flex-col items-center justify-center text-center">
      <button onClick={() => setActiveGame(null)} className="absolute top-6 left-6 flex items-center text-primary hover:underline">
        <ArrowLeft className="w-4 h-4 mr-2"/> Back to Lobby
      </button>
      <Puzzle className="w-16 h-16 text-primary mb-4" />
      <h2 className="text-3xl font-bold mb-2">Image Assemble</h2>
      <p className="text-muted-foreground mb-6 max-w-md">The physics-based jigsaw engine is spinning up. Prepare your memory...</p>
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
  if (activeGame) return (
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
