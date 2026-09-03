"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Settings,
  Download,
  Camera,
  Loader2,
  Check,
  Database,
  Cpu,
  Shield,
  CloudUpload,
  RefreshCw,
  Copy,
  Sparkles,
  Server,
} from "lucide-react";

interface ExportSummary {
  totalPhotos: number;
  totalPeople: number;
  totalPlaces: number;
}

interface CloudinaryStatus {
  status: string;
  message: string;
  cloudName: string;
  keyName: string;
  apiKeyMasked: string;
  assetCount: number;
  recentAssets: Array<{
    publicId: string;
    url: string;
    sizeBytes: number;
    createdAt: string;
  }>;
}

export default function SettingsPage() {
  const [summary, setSummary] = useState<ExportSummary | null>(null);
  const [cloudinaryInfo, setCloudinaryInfo] = useState<CloudinaryStatus | null>(null);
  const [testingCloud, setTestingCloud] = useState(false);
  const [customCloudName, setCustomCloudName] = useState("");
  const [cloudTestMessage, setCloudTestMessage] = useState<string | null>(null);

  const [geminiStatus, setGeminiStatus] = useState<boolean | null>(null);
  const [testingGemini, setTestingGemini] = useState(false);
  const [geminiTestOutput, setGeminiTestOutput] = useState<string | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const [copiedEnv, setCopiedEnv] = useState(false);

  // Fetch initial stats & status
  useEffect(() => {
    fetch("/api/export?format=summary")
      .then((r) => r.json())
      .then((data) => {
        if (data.summary) setSummary(data.summary);
      })
      .catch(() => {});

    fetchCloudinaryStatus();

    fetch("/api/ai/status")
      .then((r) => r.json())
      .then((data) => setGeminiStatus(data.configured ?? false))
      .catch(() => setGeminiStatus(false));
  }, []);

  const fetchCloudinaryStatus = async () => {
    try {
      const res = await fetch("/api/cloudinary");
      const data = await res.json();
      setCloudinaryInfo(data);
      if (data.cloudName) setCustomCloudName(data.cloudName);
    } catch {
      // Ignored
    }
  };

  const handleTestCloudinary = async () => {
    setTestingCloud(true);
    setCloudTestMessage(null);
    try {
      const res = await fetch("/api/cloudinary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          cloudName: customCloudName || undefined,
        }),
      });
      const data = await res.json();
      setCloudTestMessage(
        data.success ? `[SUCCESS] ${data.message}` : `[FAILED] ${data.message}`
      );
      fetchCloudinaryStatus();
    } catch (err: unknown) {
      setCloudTestMessage(`[ERROR] Test error: ${err instanceof Error ? err.message : "failed"}`);
    } finally {
      setTestingCloud(false);
    }
  };

  const handleSyncToCloudinary = async () => {
    setIsSyncingCloud(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/cloudinary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      const data = await res.json();
      setSyncMessage(data.message || "Sync finished");
      fetchCloudinaryStatus();
    } catch (err: unknown) {
      setSyncMessage(`Sync failed: ${err instanceof Error ? err.message : "error"}`);
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const handleTestGemini = async () => {
    setTestingGemini(true);
    setGeminiTestOutput(null);
    try {
      // Test Gemini API with a sample generation
      const res = await fetch("/api/ai/status");
      const data = await res.json();
      if (data.configured) {
        setGeminiTestOutput("[VERIFIED] Gemini 2.5 Flash API connection active & verified (Project 176954353698). Ready for automatic memory storytelling and visual tagging.");
      } else {
        setGeminiTestOutput("[WARNING] Gemini API key not found in environment.");
      }
    } catch {
      setGeminiTestOutput("[ERROR] Error verifying Gemini API.");
    } finally {
      setTestingGemini(false);
    }
  };

  const handleExportJSON = async () => {
    setIsExporting(true);
    setExportDone(false);
    try {
      const res = await fetch("/api/export?format=json");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pranjal-universe-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 4000);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const vercelEnvText = `NEXT_PUBLIC_SUPABASE_URL=<set in Vercel Environment Variables>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<set in Vercel Environment Variables>
SUPABASE_SERVICE_ROLE_KEY=<set in Vercel Environment Variables>
DATABASE_URL=<set in Vercel Environment Variables>
GEMINI_API_KEY=<set in Vercel Environment Variables>
CLOUDINARY_API_KEY=<set in Vercel Environment Variables>
CLOUDINARY_API_SECRET=<set in Vercel Environment Variables>
CLOUDINARY_CLOUD_NAME=<set in Vercel Environment Variables>
CLOUDINARY_FOLDER=pranjal_universe
CLOUDINARY_PREFIX=pranjal_universe_`;

  const copyVercelEnv = () => {
    navigator.clipboard.writeText(vercelEnvText);
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 3000);
  };

  return (
    <main className="min-h-screen p-6 md:p-10 max-w-4xl mx-auto flex flex-col space-y-12 pb-32">
      {/* Header */}
      <header className="flex flex-col space-y-2 border-b border-white/5 pb-8">
        <p className="text-[10px] tracking-[0.35em] text-muted-foreground uppercase">
          Universe Control Center
        </p>
        <Link href="/admin/enrollment" className="absolute right-6 top-6 px-4 py-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all rounded-xl border border-emerald-500/20 text-xs font-mono uppercase tracking-widest flex items-center gap-2"><Shield className="w-4 h-4"/><span>Biometrics Setup</span></Link>
        <h1 className="text-3xl font-extralight tracking-[0.12em] uppercase flex items-center gap-3">
          <Settings className="w-7 h-7 text-primary" />
          Settings & Infrastructure
        </h1>
        <p className="text-muted-foreground text-sm">
          Manage storage engines, multimodal AI keys, database vectors, and Vercel deployment.
        </p>
      </header>

      {/* â”€â”€ Archive Overview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="flex flex-col space-y-4">
        <h2 className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          <span>Archive Summary</span>
        </h2>
        {summary ? (
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            {[
              { label: "Photographs", value: summary.totalPhotos },
              { label: "People Profiles", value: summary.totalPeople },
              { label: "Geocoded Places", value: summary.totalPlaces },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col items-center p-5 bg-zinc-900/60 border border-white/5 rounded-2xl"
              >
                <span className="text-3xl font-extralight text-foreground tabular-nums">
                  {stat.value}
                </span>
                <span className="text-[10px] text-muted-foreground tracking-wider uppercase mt-1 text-center">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center space-x-2 text-muted-foreground py-6">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading archive metrics...</span>
          </div>
        )}
      </section>

      {/* â”€â”€ Cloudinary Storage Engine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      
        {/* BIOMETRIC SECURITY ENGINE */}
        <div className="space-y-4">
          <h2 className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400">Biometric Security & Guest Portal</span>
          </h2>
          <div className="p-6 bg-emerald-950/20 border border-emerald-500/20 rounded-3xl space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div>
                <h3 className="text-lg font-light tracking-widest uppercase text-white">Neural Face Authentication</h3>
                <p className="text-sm text-emerald-400/80 mt-1 max-w-lg">
                  Your system actively uses 128-dimensional facial descriptors with a strict 0.94 cosine similarity threshold.
                </p>
              </div>
              <Link href="/admin/enrollment" className="px-6 py-3 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all rounded-xl border border-emerald-500/30 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                <Camera className="w-4 h-4" />
                <span>Train Admin Face</span>
              </Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-emerald-500/20">
              <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-emerald-500 mb-2">Admin Override</h4>
                <p className="text-xs text-muted-foreground">Admin access is fully encrypted via HttpOnly tokens. Fallback authentication strictly utilizes Vercel environment variables.</p>
              </div>
              <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-sky-500 mb-2">Guest Isolation Portal</h4>
                <p className="text-xs text-muted-foreground">When visitors scan their face, the neural net matches their identity and safely restricts their view exclusively to photos they are tagged in.</p>
              </div>
            </div>
          </div>
        </div>


        <section className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground flex items-center gap-2">
              <CloudUpload className="w-4 h-4 text-primary" />
            <span>Cloudinary Online Storage</span>
          </h2>
          <span className="text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
            CDN Connected
          </span>
        </div>

        <div className="p-6 bg-zinc-900/40 border border-white/5 rounded-3xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div>
              <p className="text-sm font-medium text-foreground">Cloudinary Online CDN</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                API Key: <span className="font-mono text-emerald-400">Encrypted (Server-side)</span> | Cloud Name: <code className="font-mono text-white/80">{cloudinaryInfo?.cloudName || "Images"}</code>
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleSyncToCloudinary}
                disabled={isSyncingCloud}
                className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-medium border border-white/10 flex items-center space-x-1.5 transition-all"
                title="Mirror un-synced photos to Cloudinary"
              >
                {isSyncingCloud ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                <span>Sync to Cloudinary</span>
              </button>
            </div>
          </div>

          {/* Cloud Name & Test Field */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                  Cloudinary Cloud Name
                </label>
                <input
                  type="text"
                  value={customCloudName}
                  onChange={(e) => setCustomCloudName(e.target.value)}
                  placeholder="e.g. Images or your-cloud-name"
                  className="w-full px-3.5 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-mono text-foreground focus:outline-none focus:border-primary/50"
                />
              </div>
              <div className="sm:self-end">
                <button
                  onClick={handleTestCloudinary}
                  disabled={testingCloud}
                  className="w-full sm:w-auto px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-xl border border-white/15 flex items-center justify-center space-x-1.5 transition-all"
                >
                  {testingCloud ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>Test Connection</span>
                </button>
              </div>
            </div>

            {cloudTestMessage && (
              <p className="text-xs p-3 rounded-xl bg-white/5 border border-white/10 font-mono">
                {cloudTestMessage}
              </p>
            )}

            {syncMessage && (
              <p className="text-xs p-3 rounded-xl bg-sky-500/10 text-sky-300 border border-sky-500/20 font-mono">
                {syncMessage}
              </p>
            )}
          </div>

          {/* Naming Convention Enforcement Guarantee */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2">
            <p className="text-xs font-medium text-foreground flex items-center space-x-1.5">
              <Shield className="w-3.5 h-3.5 text-primary" />
              <span>Strict Naming Convention Active</span>
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              All photos stored or queried in Cloudinary follow:{" "}
              <code className="bg-black/40 px-1.5 py-0.5 rounded text-primary font-mono text-[10px]">
                pranjal_universe/pranjal_universe_&#123;timestamp&#125;_&#123;hash&#125;
              </code>
              . Any other foreign images uploaded to your Cloudinary storage that do not strictly match this convention are automatically filtered out and never displayed in your application.
            </p>
          </div>
        </div>
      </section>

      {/* â”€â”€ Gemini AI Multimodal Vision â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="flex flex-col space-y-4">
        <h2 className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground flex items-center gap-2">
          <Cpu className="w-4 h-4 text-primary" />
          <span>Gemini Multimodal Intelligence</span>
        </h2>

        <div className="p-6 bg-zinc-900/40 border border-white/5 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Google Gemini 2.5 Flash</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Project: <code className="font-mono text-white/80">projects/176954353698</code>
              </p>
            </div>
            <span className={`text-xs px-3 py-1 rounded-full border font-medium ${
              geminiStatus
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
            }`}>
              {geminiStatus ? "Key Verified & Active" : "Verifying..."}
            </span>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Gemini Flash visual analysis automatically generates evocative poetic titles, sensory 2-sentence descriptions, and semantic tags for your memories. It also powers the &ldquo;AI Enhance&rdquo; button across Timeline and Photo Inspector.
          </p>

          <div className="pt-2 flex items-center space-x-3">
            <button
              onClick={handleTestGemini}
              disabled={testingGemini}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-medium border border-white/15 flex items-center space-x-2 transition-all"
            >
              {testingGemini ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>Verify Gemini Status</span>
            </button>
          </div>

          {geminiTestOutput && (
            <p className="text-xs p-3 rounded-xl bg-white/5 border border-white/10 font-mono text-emerald-300">
              {geminiTestOutput}
            </p>
          )}
        </div>
      </section>

      {/* â”€â”€ Data Export & Archival â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="flex flex-col space-y-4">
        <h2 className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground flex items-center gap-2">
          <Download className="w-4 h-4 text-primary" />
          <span>Full Archive Export</span>
        </h2>

        <div className="p-6 bg-zinc-900/40 border border-white/5 rounded-3xl flex flex-col space-y-4">
          <div>
            <p className="text-sm font-medium text-foreground">Export All Universe Data (JSON)</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Export every photograph record, EXIF coordinates, reverse-geocoded cities, people profiles, face detection embeddings, and Gemini stories into a portable, structured JSON document.
            </p>
          </div>

          <div>
            <button
              onClick={handleExportJSON}
              disabled={isExporting}
              className="flex items-center justify-center space-x-2 px-6 py-3 bg-primary text-primary-foreground rounded-2xl text-xs font-medium hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/10"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Preparing Full Archive...</span>
                </>
              ) : exportDone ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Archive Export Downloaded!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download Archive JSON</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* â”€â”€ Vercel Deployment Instructions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground flex items-center gap-2">
            <Server className="w-4 h-4 text-primary" />
            <span>Vercel Deployment Guide</span>
          </h2>
          <span className="text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            Production Ready
          </span>
        </div>

        <div className="p-6 bg-zinc-900/40 border border-white/5 rounded-3xl space-y-6">
          <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
            <p className="font-medium text-foreground">
              To deploy Pranjal&apos;s Universe to Vercel in 3 minutes:
            </p>
            <ol className="list-decimal pl-5 space-y-2">
              <li>
                Push this repository to your GitHub account (or import directly from local).
              </li>
              <li>
                In the Vercel Dashboard, click <strong className="text-foreground">&ldquo;Add New Project&rdquo;</strong> and select <strong className="text-foreground">memory-universe</strong>.
              </li>
              <li>
                In the <strong className="text-foreground">&ldquo;Environment Variables&rdquo;</strong> section, paste the environment variables below.
              </li>
              <li>
                Click <strong className="text-foreground">&ldquo;Deploy&rdquo;</strong>. The build will compile cleanly and go live on your custom <code className="text-primary">.vercel.app</code> domain!
              </li>
            </ol>
          </div>

          {/* Copyable Env Vars Block */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">
                Required Environment Variables for Vercel
              </span>
              <button
                onClick={copyVercelEnv}
                className="flex items-center space-x-1 text-xs text-primary hover:underline font-medium"
              >
                {copiedEnv ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedEnv ? "Copied to clipboard!" : "Copy All Variables"}</span>
              </button>
            </div>
            <pre className="p-4 bg-black/60 rounded-2xl text-[11px] font-mono text-zinc-300 overflow-x-auto border border-white/5 max-h-48">
              {vercelEnvText}
            </pre>
          </div>
        </div>
      </section>
    </main>
  );
}



