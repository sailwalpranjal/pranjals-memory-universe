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
  LucideIcon
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

type TabType = "node_graph" | "developer_sandbox" | "system_status";

export default function LabDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("node_graph");
  const [photos, setPhotos] = useState<LabPhotoItem[]>([]);
  const [selectedNode, setSelectedNode] = useState<LabPhotoItem | null>(null);

  useEffect(() => {
    fetch("/api/photos")
      .then((res) => res.json())
      .then((data) => {
        if (data.photos) {
          const withUrls = data.photos.filter(
            (p: LabPhotoItem) => p.url && (!p.mime_type || p.mime_type.startsWith("image/"))
          );
          setPhotos(withUrls);
          if (withUrls.length > 0) {
            setSelectedNode(withUrls[0]);
          }
        }
      })
      .catch(() => {});
  }, []);

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-300 font-mono flex flex-col md:flex-row overflow-hidden pb-20 md:pb-0">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 border-r border-white/10 bg-[#0c0c0e] flex flex-col h-auto md:h-screen shrink-0">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3 text-emerald-400 mb-2">
            <Activity className="w-5 h-5" />
            <h1 className="text-sm font-bold uppercase tracking-widest">NEXUS LAB</h1>
          </div>
          <p className="text-[10px] text-muted-foreground">SYSTEM VER: 2.5.4</p>
          <p className="text-[10px] text-muted-foreground">STATUS: ONLINE</p>
        </div>
        <nav className="p-4 flex-1 space-y-2">
          <NavItem
            icon={Network}
            label="Memory Node Graph"
            active={activeTab === "node_graph"}
            onClick={() => setActiveTab("node_graph")}
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
      </aside>

      {/* Main Content Area */}
      <section className="flex-1 relative h-screen overflow-y-auto">
        {activeTab === "node_graph" && <NodeGraph photos={photos} onSelect={setSelectedNode} selected={selectedNode} />}
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
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-md text-xs font-medium transition-all ${
        active ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200 border border-transparent"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function NodeGraph({ photos, onSelect, selected }: { photos: LabPhotoItem[]; onSelect: (node: LabPhotoItem) => void; selected: LabPhotoItem | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<(LabPhotoItem & { x: number; y: number })[]>([]);

  useEffect(() => {
    if (photos.length === 0 || !containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    
    const mapped = photos.map((p, i) => {
      // Golden ratio spiral for a cool high-tech look
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      const theta = i * goldenAngle;
      const radius = 20 + Math.sqrt(i) * 35;
      const x = width / 2 + radius * Math.cos(theta);
      const y = height / 2 + radius * Math.sin(theta);
      return { ...p, x, y };
    });
    setNodes(mapped);
  }, [photos]);

  return (
    <div className="h-full w-full flex flex-col bg-[#050505] relative overflow-hidden" ref={containerRef}>
      <div className="absolute top-6 left-6 z-10 space-y-1 bg-black/60 p-4 rounded-xl border border-white/10 backdrop-blur-md">
        <h2 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
          <Network className="w-4 h-4" /> NODE CLUSTER TOPOLOGY
        </h2>
        <p className="text-[10px] text-zinc-500">Visualizing interconnected memory vectors in multidimensional space.</p>
        <p className="text-[10px] text-zinc-400 mt-2">NODES: {photos.length} | EDGES: {photos.length - 1}</p>
      </div>

      {/* SVG Lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {nodes.map((node, i) => {
          if (i === 0) return null;
          const prev = nodes[i - 1];
          return (
            <line
              key={node.id}
              x1={prev.x}
              y1={prev.y}
              x2={node.x}
              y2={node.y}
              stroke="rgba(16, 185, 129, 0.15)"
              strokeWidth="1"
            />
          );
        })}
      </svg>

      {/* HTML Nodes */}
      {nodes.map((node) => {
        const isSelected = selected?.id === node.id;
        return (
          <div
            key={node.id}
            onClick={() => onSelect(node)}
            className={`absolute rounded-full cursor-pointer transition-all duration-300 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center overflow-hidden
              ${isSelected ? "w-16 h-16 ring-2 ring-emerald-400 z-20 shadow-[0_0_20px_rgba(16,185,129,0.5)]" : "w-8 h-8 ring-1 ring-white/20 z-10 hover:w-12 hover:h-12 hover:ring-emerald-400/50 hover:z-30"}
            `}
            style={{ left: node.x, top: node.y }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={node.url} alt="" className="w-full h-full object-cover opacity-80 hover:opacity-100" />
          </div>
        );
      })}

      {/* Node Details Panel */}
      {selected && (
        <div className="absolute right-6 top-6 w-80 bg-[#0c0c0e]/90 border border-white/10 rounded-xl p-5 shadow-2xl backdrop-blur-xl z-50">
          <div className="aspect-video w-full rounded-lg overflow-hidden mb-4 border border-white/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.url} alt="" className="w-full h-full object-cover" />
          </div>
          <h3 className="text-xs font-bold text-emerald-400 mb-1 truncate">{selected.original_filename}</h3>
          <p className="text-[10px] text-zinc-500 mb-4 font-mono">{selected.id}</p>
          
          <div className="space-y-2 text-[11px]">
            <div className="flex justify-between border-b border-white/5 pb-1">
              <span className="text-zinc-500">CITY</span>
              <span className="text-zinc-200">{selected.photo_metadata?.city || "UNKNOWN"}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1">
              <span className="text-zinc-500">FAVORITE</span>
              <span className={selected.is_favorite ? "text-emerald-400" : "text-zinc-200"}>{selected.is_favorite ? "TRUE" : "FALSE"}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1">
              <span className="text-zinc-500">CAPTURED</span>
              <span className="text-zinc-200">{selected.captured_at ? new Date(selected.captured_at).toLocaleDateString() : "N/A"}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DeveloperSandbox() {
  const [sqlQuery, setSqlQuery] = useState("SELECT * FROM photos LIMIT 5;");
  const [activeStep, setActiveStep] = useState(1);
  const [output, setOutput] = useState<string>("");
  const [isExecuting, setIsExecuting] = useState(false);

  const handleExecute = () => {
    setIsExecuting(true);
    setOutput("");
    setTimeout(() => {
      let result = "Execution complete.\\n";
      if (sqlQuery.toLowerCase().includes("select")) {
        result += JSON.stringify([{ id: "sample_id_1", file: "DCIM_001.jpg" }, { id: "sample_id_2", file: "DCIM_002.jpg" }], null, 2);
      } else {
        result += "Error: Sandbox restricts operations to SELECT queries only.";
      }
      setOutput(result);
      setIsExecuting(false);
    }, 800);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto h-full flex flex-col space-y-6">
      <div className="space-y-1 border-b border-white/10 pb-6">
        <h2 className="text-2xl font-light text-white flex items-center gap-3">
          <TerminalSquare className="w-6 h-6 text-emerald-400" /> Developer Sandbox
        </h2>
        <p className="text-sm text-zinc-400">Comprehensive environment to interact directly with the Universe Engine API and Datastores.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-0">
        {/* Left: Interactive Guide */}
        <div className="lg:col-span-5 flex flex-col gap-4 overflow-y-auto pr-2">
          <div className="text-xs font-semibold text-emerald-400 tracking-widest uppercase mb-2">Interactive Guide</div>
          
          <GuideStep 
            step={1} 
            currentStep={activeStep} 
            title="Database Introspection" 
            desc="The memory universe is powered by Supabase PostgreSQL. Start by querying the primary 'photos' table. Parameters available: 'id', 'url', 'original_filename', 'captured_at', 'is_favorite'."
            onClick={() => {
              setActiveStep(1);
              setSqlQuery("SELECT id, original_filename, captured_at FROM photos ORDER BY captured_at DESC LIMIT 5;");
            }}
          />
          <GuideStep 
            step={2} 
            currentStep={activeStep} 
            title="Metadata Joins" 
            desc="Perform a relational join on 'photo_metadata'. Available join parameters: 'city', 'country', 'make', 'model', 'iso', 'ai_title', 'ai_tags'."
            onClick={() => {
              setActiveStep(2);
              setSqlQuery("SELECT p.original_filename, m.city, m.ai_title FROM photos p JOIN photo_metadata m ON p.id = m.photo_id WHERE m.city IS NOT NULL LIMIT 5;");
            }}
          />
          <GuideStep 
            step={3} 
            currentStep={activeStep} 
            title="AI Cognitive Jobs" 
            desc="Trigger an async AI pipeline. Required params: 'batch_size' (Integer: 1-50), 'persona' (String Enum: 'haiku', 'forensic', 'anthropological')."
            onClick={() => {
              setActiveStep(3);
              setSqlQuery("-- Simulate AI pipeline execution\\n-- POST /api/ai/batch-process\\n\\nEXECUTE cognitive_pipeline(batch_size := 10, persona := 'haiku');");
            }}
          />
          <GuideStep 
            step={4} 
            currentStep={activeStep} 
            title="Face Topology Aggregation" 
            desc="Group recognized faces and count their occurrences. Useful tables: 'people' (id, name, avatar_url), 'photo_faces' (id, photo_id, person_id)."
            onClick={() => {
              setActiveStep(4);
              setSqlQuery("SELECT person_name, count(face_id) as detections FROM photo_faces GROUP BY person_name ORDER BY detections DESC;");
            }}
          />
        </div>

        {/* Right: Terminal Console */}
        <div className="lg:col-span-7 flex flex-col bg-[#050505] border border-white/10 rounded-xl overflow-hidden shadow-2xl h-[500px]">
          <div className="bg-[#1a1a1e] px-4 py-2 border-b border-white/5 flex items-center justify-between shrink-0">
            <div className="flex gap-2 items-center">
              <span className="w-3 h-3 rounded-full bg-red-500/80"></span>
              <span className="w-3 h-3 rounded-full bg-yellow-500/80"></span>
              <span className="w-3 h-3 rounded-full bg-green-500/80"></span>
              <span className="ml-3 text-xs text-zinc-500 font-mono">root@nexus-engine:~</span>
            </div>
            <button 
              onClick={handleExecute}
              disabled={isExecuting}
              className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 px-3 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all"
            >
              {isExecuting ? <Activity className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-current" />}
              RUN COMMAND
            </button>
          </div>
          
          <div className="flex-1 flex flex-col p-4 bg-transparent font-mono text-xs overflow-hidden">
            <div className="text-zinc-500 mb-2">{'// Type your SQL or pipeline command below'}</div>
            <textarea 
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              className="w-full h-32 bg-transparent text-emerald-300 resize-none outline-none leading-relaxed"
              spellCheck="false"
            />
            
            <div className="text-zinc-500 my-2 pt-2 border-t border-white/5">{'>> output'}</div>
            <div className="flex-1 overflow-y-auto bg-black/40 p-3 rounded border border-white/5">
              {output ? (
                <pre className="text-zinc-300 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                  {output}
                </pre>
              ) : (
                <div className="text-zinc-700 italic">No output yet. Run a command to see results.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GuideStep({ step, currentStep, title, desc, onClick }: { step: number; currentStep: number; title: string; desc: string; onClick: () => void }) {
  const isActive = step === currentStep;
  return (
    <div 
      onClick={onClick}
      className={`p-4 rounded-xl cursor-pointer border transition-all ${
        isActive ? "bg-emerald-500/10 border-emerald-500/30" : "bg-white/5 border-white/5 hover:bg-white/10"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
          isActive ? "bg-emerald-500 text-black" : "bg-zinc-800 text-zinc-400"
        }`}>
          {step}
        </div>
        <div>
          <h3 className={`text-sm font-semibold mb-1 ${isActive ? "text-emerald-400" : "text-zinc-200"}`}>{title}</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">{desc}</p>
        </div>
      </div>
    </div>
  );
}

function SystemStatus({ photos }: { photos: LabPhotoItem[] }) {
  return (
    <div className="p-8 max-w-5xl mx-auto h-full space-y-8">
      <div className="space-y-1 border-b border-white/10 pb-6">
        <h2 className="text-2xl font-light text-white flex items-center gap-3">
          <Server className="w-6 h-6 text-emerald-400" /> System Architecture
        </h2>
        <p className="text-sm text-zinc-400">Diagnostic overview of active services, database size, and API routes.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 border border-white/10 bg-[#0c0c0e] rounded-xl flex items-center gap-4">
          <div className="p-3 bg-blue-500/20 text-blue-400 rounded-lg"><Database className="w-6 h-6" /></div>
          <div>
            <div className="text-2xl font-bold text-white">{photos.length}</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Total Nodes</div>
          </div>
        </div>
        <div className="p-5 border border-white/10 bg-[#0c0c0e] rounded-xl flex items-center gap-4">
          <div className="p-3 bg-purple-500/20 text-purple-400 rounded-lg"><Cpu className="w-6 h-6" /></div>
          <div>
            <div className="text-2xl font-bold text-white">v2.5</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">AI Perception Engine</div>
          </div>
        </div>
        <div className="p-5 border border-white/10 bg-[#0c0c0e] rounded-xl flex items-center gap-4">
          <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-lg"><CheckCircle2 className="w-6 h-6" /></div>
          <div>
            <div className="text-2xl font-bold text-white">99.9%</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">API Uptime</div>
          </div>
        </div>
      </div>

      <div className="border border-white/10 bg-[#0c0c0e] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/5 bg-white/5 flex items-center gap-2">
          <Code className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-widest">Active Services</span>
        </div>
        <div className="p-0">
          <table className="w-full text-xs text-left">
            <thead className="bg-black/20 text-zinc-500">
              <tr>
                <th className="p-4 font-medium uppercase tracking-wider">Service</th>
                <th className="p-4 font-medium uppercase tracking-wider">Status</th>
                <th className="p-4 font-medium uppercase tracking-wider">Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-zinc-300">
              <tr>
                <td className="p-4 flex items-center gap-2"><Box className="w-4 h-4 text-zinc-500"/> Core DB (Supabase)</td>
                <td className="p-4"><span className="text-emerald-400 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Online</span></td>
                <td className="p-4">24ms</td>
              </tr>
              <tr>
                <td className="p-4 flex items-center gap-2"><Box className="w-4 h-4 text-zinc-500"/> Object Storage (CDN)</td>
                <td className="p-4"><span className="text-emerald-400 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Online</span></td>
                <td className="p-4">12ms</td>
              </tr>
              <tr>
                <td className="p-4 flex items-center gap-2"><Box className="w-4 h-4 text-zinc-500"/> Gemini AI Services</td>
                <td className="p-4"><span className="text-emerald-400 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Online</span></td>
                <td className="p-4">156ms</td>
              </tr>
              <tr>
                <td className="p-4 flex items-center gap-2"><Box className="w-4 h-4 text-zinc-500"/> Background Indexer</td>
                <td className="p-4"><span className="text-yellow-400 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400"></span> Processing</span></td>
                <td className="p-4">--</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
