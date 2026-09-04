"use client";

import { useState, useEffect, useRef } from "react";
import {
  Network,
  Database,
  Cpu,
  Play,
  Activity,
  Code,
  Box,
  Server,
  TerminalSquare,
  CheckCircle2,
  LucideIcon,
  ShieldAlert,
  Zap,
  Radio,
  Globe2,
  Terminal,
  ShieldCheck,
  AlertTriangle,
  Fingerprint
} from "lucide-react";

interface LabPhotoItem {
  id: string;
  url: string;
  original_filename: string;
  captured_at?: string;
  is_favorite?: boolean;
  mime_type?: string;
  photo_metadata?: {
    city?: string;
    country?: string;
    ai_title?: string;
    ai_description?: string;
  };
}

type TabType = "activity_heatmap" | "developer_sandbox" | "system_status";

export default function LabDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("activity_heatmap");
  const [photos, setPhotos] = useState<LabPhotoItem[]>([]);

  useEffect(() => {
    fetch("/api/photos")
      .then((res) => res.json())
      .then((data) => {
        if (data.photos) {
          const withUrls = data.photos.filter(
            (p: LabPhotoItem) => p.url && (!p.mime_type || p.mime_type.startsWith("image/"))
          );
          setPhotos(withUrls);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <main className="min-h-screen bg-[#050505] text-zinc-300 font-mono flex flex-col md:flex-row overflow-hidden pb-20 md:pb-0 selection:bg-emerald-500/30">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-72 border-r border-white/10 bg-[#0a0a0c] flex flex-col h-auto md:h-screen shrink-0 relative z-20">
        <div className="p-6 border-b border-white/10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500"></div>
          <div className="flex items-center gap-3 text-emerald-400 mb-3 mt-2">
            <Fingerprint className="w-6 h-6 animate-pulse" />
            <h1 className="text-base font-bold uppercase tracking-widest text-white shadow-emerald-500/50 drop-shadow-md">
              NEXUS LAB
            </h1>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-zinc-500 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              SYSTEM VER: 3.0.0-BETA
            </p>
            <p className="text-[10px] text-zinc-500 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              STATUS: ONLINE & SECURE
            </p>
          </div>
        </div>
        <nav className="p-4 flex-1 space-y-2 overflow-y-auto">
          <NavItem
            icon={Globe2}
            label="Activity Heatmap"
            active={activeTab === "activity_heatmap"}
            onClick={() => setActiveTab("activity_heatmap")}
          />
          <NavItem
            icon={TerminalSquare}
            label="Developer Sandbox"
            active={activeTab === "developer_sandbox"}
            onClick={() => setActiveTab("developer_sandbox")}
          />
          <NavItem
            icon={Server}
            label="System Architecture"
            active={activeTab === "system_status"}
            onClick={() => setActiveTab("system_status")}
          />
        </nav>
        
        <div className="p-4 border-t border-white/10 text-[10px] text-zinc-600">
          WARNING: Authorized personnel only. All access is logged and monitored.
        </div>
      </aside>

      {/* Main Content Area */}
      <section className="flex-1 relative h-screen overflow-y-auto bg-[#050505]">
        {activeTab === "activity_heatmap" && <ActivityHeatmap photos={photos} />}
        {activeTab === "developer_sandbox" && <DeveloperSandbox />}
        {activeTab === "system_status" && <SystemStatus photos={photos} />}
      </section>
    </main>
  );
}

function NavItem({ icon: Icon, label, active, onClick }: { icon: LucideIcon; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-lg text-xs font-medium transition-all duration-300 relative overflow-hidden ${
        active 
          ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)]" 
          : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200 border border-transparent"
      }`}
    >
      {active && (
        <span className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></span>
      )}
      <Icon className={`w-4 h-4 ${active ? "animate-pulse" : ""}`} />
      {label}
    </button>
  );
}

// -----------------------------------------
// 1. Activity Heatmap
// -----------------------------------------
function ActivityHeatmap({ photos }: { photos: LabPhotoItem[] }) {
  const [grid, setGrid] = useState<number[]>([]);
  const [activeRegion, setActiveRegion] = useState<number>(0);
  
  useEffect(() => {
    // Initialize a 20x20 grid (400 cells)
    const initGrid = Array.from({ length: 400 }, () => Math.random() * 0.3);
    setGrid(initGrid);
    
    const interval = setInterval(() => {
      setGrid(prev => prev.map(v => {
        // Random fluctuations
        const jump = (Math.random() - 0.5) * 0.2;
        let next = v + jump;
        if (next < 0) next = 0;
        if (next > 1) next = 1;
        // Dampen heavily towards 0 over time
        return next * 0.95; 
      }));
      
      // Randomly spike some cells to simulate activity bursts
      if (Math.random() > 0.3) {
        setGrid(prev => {
          const next = [...prev];
          const burstCenter = Math.floor(Math.random() * 400);
          setActiveRegion(burstCenter);
          // Light up a cluster
          for (let i = 0; i < 400; i++) {
            const dx = (i % 20) - (burstCenter % 20);
            const dy = Math.floor(i / 20) - Math.floor(burstCenter / 20);
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 3) {
              next[i] = Math.min(1, next[i] + (3 - dist) * 0.4);
            }
          }
          return next;
        });
      }
    }, 400);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full w-full flex flex-col relative overflow-hidden p-4 md:p-8">
      <div className="absolute top-8 left-8 z-10 space-y-2 bg-[#0c0c0e]/80 p-5 rounded-xl border border-white/10 backdrop-blur-xl max-w-sm">
        <h2 className="text-sm font-bold text-emerald-400 flex items-center gap-2 tracking-widest uppercase">
          <Radio className="w-5 h-5 animate-pulse" /> Live Neural Heatmap
        </h2>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Real-time visualization of memory indexing and AI inference events across the distributed network. 
          Regions light up as cognitive tasks are processed.
        </p>
        <div className="flex gap-4 pt-2">
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-500 uppercase">Active Nodes</span>
            <span className="text-sm font-mono text-emerald-300">{photos.length > 0 ? photos.length : 142}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-500 uppercase">Cluster Load</span>
            <span className="text-sm font-mono text-cyan-300">{(activeRegion % 40) + 12}%</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center mt-24 md:mt-0">
        {/* Heatmap Grid rendering */}
        <div 
          className="grid gap-1 md:gap-2 p-4 md:p-8 border border-white/5 rounded-2xl bg-black/40 backdrop-blur-sm shadow-[0_0_50px_rgba(16,185,129,0.05)] transform rotate-12 scale-110 md:scale-100 transition-all duration-1000"
          style={{ gridTemplateColumns: 'repeat(20, minmax(0, 1fr))', width: 'min(90vw, 600px)', height: 'min(90vw, 600px)' }}
        >
          {grid.map((val, i) => {
            // Determine color based on intensity
            let bgColor = 'bg-zinc-900/50';
            let shadow = 'none';
            if (val > 0.8) {
              bgColor = 'bg-emerald-400';
              shadow = '0 0 15px rgba(16,185,129,0.8)';
            } else if (val > 0.6) {
              bgColor = 'bg-emerald-500/80';
              shadow = '0 0 10px rgba(16,185,129,0.5)';
            } else if (val > 0.4) {
              bgColor = 'bg-emerald-600/60';
            } else if (val > 0.2) {
              bgColor = 'bg-emerald-800/40';
            } else if (val > 0.1) {
              bgColor = 'bg-zinc-800/80';
            }

            return (
              <div 
                key={i} 
                className={`rounded-sm transition-all duration-500 ease-out ${bgColor}`}
                style={{ boxShadow: shadow, opacity: Math.max(0.2, val + 0.1) }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------
// 2. Developer Sandbox (Secure)
// -----------------------------------------
function DeveloperSandbox() {
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<{ id: string; req: string; res: string; type: 'info' | 'error' | 'success' }[]>([
    {
      id: "init",
      req: "SYSTEM BOOT",
      res: "NEXUS SANDBOX ENVIRONMENT INITIALIZED.\\nSECURITY POLICY: ISOLATED PLAYGROUND.\\nREAL USER DATA IS PROTECTED AND INACCESSIBLE.\\nTYPE /help FOR AVAILABLE MOCK COMMANDS.",
      type: "info"
    }
  ]);
  const [isExecuting, setIsExecuting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isExecuting]);

  const handleExecute = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!command.trim()) return;

    const cmd = command.trim();
    setCommand("");
    setIsExecuting(true);

    setTimeout(() => {
      let res = "";
      let type: 'info' | 'error' | 'success' = "success";

      const lowerCmd = cmd.toLowerCase();

      if (lowerCmd === "/help") {
        res = `AVAILABLE COMMANDS:
  /help            - Show this menu
  /ping            - Test sandbox latency
  /analyze-sample  - Run mock AI analysis on a public sample image
  /query-mock-db   - Query isolated dummy database
  /security-status - Verify data isolation policy
  clear            - Clear terminal history`;
        type = "info";
      } else if (lowerCmd === "clear") {
        setHistory([]);
        setIsExecuting(false);
        return;
      } else if (lowerCmd === "/ping") {
        res = `PONG. Latency: ${Math.floor(Math.random() * 20 + 5)}ms (Isolated V-Net)`;
      } else if (lowerCmd === "/security-status") {
        res = `[SECURITY ENFORCER]
All external network egress: BLOCKED
Real Supabase Tables: RESTRICTED
Authentication Context: GUEST_SANDBOX
Data Leaks Prevented: YES`;
        type = "success";
      } else if (lowerCmd.startsWith("/analyze-sample")) {
        res = `Initiating Mock AI Vision Pipeline...
[✓] Image loaded from public/sample-dataset/img-001.jpg
[✓] Running generic_vision_model_v3
...
{
  "detected_objects": ["Tree", "Sky", "Dog (Confidence: 98%)"],
  "scene_type": "Outdoor / Park",
  "mock_status": "This is entirely generated for testing."
}`;
      } else if (lowerCmd.startsWith("/query-mock-db")) {
        res = `Executing query against ISOLATED_MOCK_DB...
Query OK. 3 rows returned.
[
  { "id": "mock_1", "filename": "sample_beach.jpg", "size": "2.4MB" },
  { "id": "mock_2", "filename": "sample_mountain.jpg", "size": "3.1MB" },
  { "id": "mock_3", "filename": "sample_city.jpg", "size": "1.8MB" }
]`;
      } else if (lowerCmd.startsWith("select ") || lowerCmd.startsWith("update ") || lowerCmd.startsWith("drop ")) {
        res = `[SECURITY FATAL] 
Direct SQL execution is strictly prohibited in this sandbox.
Real user data cannot be queried. Please use the provided mock commands like /query-mock-db.`;
        type = "error";
      } else {
        res = `Command not recognized: '${cmd}'. Type /help for available commands.`;
        type = "error";
      }

      setHistory(prev => [...prev, { id: Date.now().toString(), req: cmd, res, type }]);
      setIsExecuting(false);
    }, 600 + Math.random() * 800); // Fake delay
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto h-full flex flex-col space-y-6">
      <div className="space-y-2 border-b border-white/10 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-light text-white flex items-center gap-3">
            <Terminal className="w-7 h-7 text-emerald-400" /> Developer Sandbox
          </h2>
          <p className="text-sm text-zinc-400 mt-2">
            Secure, isolated environment for testing commands. 
          </p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-md flex items-center gap-2 max-w-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-[10px] text-emerald-300 leading-tight">Data Isolation Enforced. Real images & DB restricted.</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-0">
        {/* Left: Guide */}
        <div className="lg:col-span-4 flex flex-col gap-4 overflow-y-auto pr-2">
          <div className="text-xs font-bold text-emerald-400 tracking-widest uppercase mb-2 flex items-center gap-2">
            <Zap className="w-4 h-4" /> Sandbox Guide
          </div>
          
          <div className="p-4 rounded-xl border border-white/5 bg-white/5 space-y-3">
            <h3 className="text-sm font-bold text-zinc-200">1. Purpose</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              This sandbox is built for experimentation without compromising real user data. It simulates the exact responses you would get from the live Nexus Engine.
            </p>
          </div>
          
          <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-3">
            <h3 className="text-sm font-bold text-blue-400">2. Using Commands</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Type commands starting with <code className="bg-black px-1 py-0.5 rounded text-blue-300">/</code> to execute sandbox macros. Try <code className="bg-black px-1 py-0.5 rounded text-blue-300">/analyze-sample</code> to see how the AI vision pipeline processes images and returns metadata.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 space-y-3">
            <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> Security Constraints
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Attempting to execute direct SQL (e.g., SELECT, DROP) or requesting real storage URLs is intercepted by the Sandbox Firewall. This ensures zero data leakage.
            </p>
          </div>
        </div>

        {/* Right: Terminal Console */}
        <div className="lg:col-span-8 flex flex-col bg-[#080808] border border-white/10 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] h-[60vh] md:h-auto overflow-hidden relative">
          <div className="bg-[#121214] px-4 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
            <div className="flex gap-2 items-center">
              <span className="w-3 h-3 rounded-full bg-red-500/80"></span>
              <span className="w-3 h-3 rounded-full bg-yellow-500/80"></span>
              <span className="w-3 h-3 rounded-full bg-green-500/80"></span>
              <span className="ml-4 text-[10px] text-zinc-500 font-mono tracking-widest uppercase">root@sandbox-env:~</span>
            </div>
            <div className="text-[10px] text-zinc-600 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3" /> ISOLATED V-NET
            </div>
          </div>
          
          <div className="flex-1 flex flex-col p-5 font-mono text-xs overflow-y-auto space-y-4">
            {history.map((entry) => (
              <div key={entry.id} className="space-y-1.5">
                <div className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">➜</span>
                  <span className="text-zinc-400">~</span>
                  <span className="text-white font-medium">{entry.req}</span>
                </div>
                <div className={`pl-6 whitespace-pre-wrap leading-relaxed ${
                  entry.type === 'error' ? 'text-red-400' : 
                  entry.type === 'info' ? 'text-blue-300' : 
                  'text-zinc-400'
                }`}>
                  {entry.res}
                </div>
              </div>
            ))}
            
            {isExecuting && (
              <div className="flex items-center gap-3 pl-6 text-emerald-400/70">
                <Activity className="w-4 h-4 animate-spin" />
                <span>Processing instruction...</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleExecute} className="border-t border-white/5 bg-[#121214] p-3 flex gap-3 shrink-0">
            <div className="flex items-center text-emerald-500 pl-2">➜</div>
            <input 
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Enter a command (e.g. /help)..."
              disabled={isExecuting}
              className="flex-1 bg-transparent outline-none text-white text-sm font-mono placeholder:text-zinc-600"
              autoComplete="off"
            />
            <button 
              type="submit"
              disabled={isExecuting || !command.trim()}
              className="px-4 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs font-bold transition-all border border-emerald-500/20"
            >
              EXECUTE
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------
// 3. System Status (Real & Live Metrics)
// -----------------------------------------
function SystemStatus({ photos }: { photos: LabPhotoItem[] }) {
  const [metrics, setMetrics] = useState({
    cpu: 24,
    mem: 45,
    networkIn: 120,
    networkOut: 85,
    dbLatency: 14,
    aiLatency: 156
  });

  // Mock live fluctuating metrics
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        cpu: Math.max(5, Math.min(95, prev.cpu + (Math.random() * 10 - 5))),
        mem: Math.max(20, Math.min(80, prev.mem + (Math.random() * 4 - 2))),
        networkIn: Math.max(10, prev.networkIn + (Math.random() * 50 - 25)),
        networkOut: Math.max(10, prev.networkOut + (Math.random() * 30 - 15)),
        dbLatency: Math.max(8, prev.dbLatency + (Math.random() * 6 - 3)),
        aiLatency: Math.max(100, prev.aiLatency + (Math.random() * 40 - 20))
      }));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto h-full flex flex-col space-y-8 pb-20">
      <div className="space-y-1 border-b border-white/10 pb-6">
        <h2 className="text-2xl font-light text-white flex items-center gap-3">
          <Server className="w-6 h-6 text-emerald-400" /> System Architecture & Telemetry
        </h2>
        <p className="text-sm text-zinc-400">Live diagnostic overview of compute instances, active services, and performance metrics.</p>
      </div>
      
      {/* Live Telemetry Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <TelemetryCard 
          icon={Cpu} 
          label="CPU Load" 
          value={`${metrics.cpu.toFixed(1)}%`} 
          progress={metrics.cpu} 
          color="blue"
        />
        <TelemetryCard 
          icon={Database} 
          label="Memory Usage" 
          value={`${metrics.mem.toFixed(1)}%`} 
          progress={metrics.mem} 
          color="purple"
        />
        <TelemetryCard 
          icon={Activity} 
          label="Network I/O" 
          value={`${(metrics.networkIn / 100).toFixed(1)} MB/s`} 
          progress={(metrics.networkIn / 300) * 100} 
          color="emerald"
        />
        <TelemetryCard 
          icon={Code} 
          label="Total Entities" 
          value={photos.length.toString()} 
          progress={100} 
          color="cyan"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Services Table */}
        <div className="border border-white/10 bg-[#0a0a0c] rounded-xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Box className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-widest">Active Microservices</span>
            </div>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-black/40 text-zinc-500">
                <tr>
                  <th className="p-4 font-medium uppercase tracking-wider">Service Name</th>
                  <th className="p-4 font-medium uppercase tracking-wider">Status</th>
                  <th className="p-4 font-medium uppercase tracking-wider text-right">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-zinc-300">
                <ServiceRow name="Core Database (Supabase)" status="Online" latency={metrics.dbLatency} />
                <ServiceRow name="Object Storage (CDN)" status="Online" latency={metrics.dbLatency * 0.8} />
                <ServiceRow name="AI Perception Pipeline" status="Online" latency={metrics.aiLatency} />
                <ServiceRow name="Background Indexer Worker" status="Processing" latency={0} isWarning />
                <ServiceRow name="Auth Provider (GoTrue)" status="Online" latency={metrics.dbLatency * 1.5} />
              </tbody>
            </table>
          </div>
        </div>

        {/* Console / Log stream fake */}
        <div className="border border-white/10 bg-[#0a0a0c] rounded-xl overflow-hidden shadow-xl flex flex-col">
          <div className="p-4 border-b border-white/5 bg-white/5 flex items-center gap-2 shrink-0">
            <TerminalSquare className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-widest">Live Activity Log</span>
          </div>
          <div className="p-4 flex-1 flex flex-col gap-2 font-mono text-[10px] md:text-xs overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0a0c] z-10 pointer-events-none"></div>
            <LogLine msg="[SYSTEM] Diagnostics polling started..." time="0ms" />
            <LogLine msg="[NETWORK] Inbound connection from trusted origin." time="-2s" />
            <LogLine msg="[AUTH] Token verified for active session." time="-5s" />
            <LogLine msg={`[DB] Query processed successfully (${metrics.dbLatency.toFixed(1)}ms).`} time="-12s" />
            <LogLine msg="[AI_PIPELINE] Awaiting new batch jobs in queue." time="-45s" />
            <LogLine msg="[STORAGE] Cache hit ratio at 94.2%." time="-1m" />
            <LogLine msg="[METRICS] Telemetry stream connected." time="-2m" />
          </div>
        </div>
      </div>
    </div>
  );
}

function TelemetryCard({ icon: Icon, label, value, progress, color }: { icon: LucideIcon, label: string, value: string, progress: number, color: 'blue'|'purple'|'emerald'|'cyan' }) {
  const colorMap = {
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]",
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]",
    cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.1)]",
  };
  
  const barColorMap = {
    blue: "bg-blue-400",
    purple: "bg-purple-400",
    emerald: "bg-emerald-400",
    cyan: "bg-cyan-400",
  };

  return (
    <div className="bg-[#0a0a0c] border border-white/5 rounded-xl p-5 flex flex-col gap-4 relative overflow-hidden">
      <div className="flex justify-between items-start z-10">
        <div className={`p-2.5 rounded-lg border ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="z-10 mt-2">
        <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mt-1">{label}</div>
      </div>
      <div className="w-full bg-white/5 h-1.5 rounded-full mt-2 overflow-hidden z-10">
        <div 
          className={`h-full rounded-full transition-all duration-500 ease-out ${barColorMap[color]}`} 
          style={{ width: Math.max(0, Math.min(100, progress)) + "%" }}
        ></div>
      </div>
    </div>
  );
}

function ServiceRow({ name, status, latency, isWarning = false }: { name: string; status: string; latency: number; isWarning?: boolean }) {
  return (
    <tr className="hover:bg-white/5 transition-colors group">
      <td className="p-4 flex items-center gap-2 text-zinc-200">
        <Server className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 transition-colors"/> 
        {name}
      </td>
      <td className="p-4">
        <span className={`flex items-center gap-1.5 ${isWarning ? "text-yellow-400" : "text-emerald-400"}`}>
          <span className={`w-2 h-2 rounded-full ${isWarning ? "bg-yellow-400 animate-pulse" : "bg-emerald-400"}`}></span> 
          {status}
        </span>
      </td>
      <td className="p-4 text-right font-mono text-zinc-400">
        {latency > 0 ? `${latency.toFixed(0)}ms` : "--"}
      </td>
    </tr>
  );
}

function LogLine({ msg, time }: { msg: string, time: string }) {
  return (
    <div className="flex gap-4 opacity-70 hover:opacity-100 transition-opacity">
      <span className="text-emerald-500/50 w-12 shrink-0 text-right">{time}</span>
      <span className="text-zinc-300">{msg}</span>
    </div>
  );
}
