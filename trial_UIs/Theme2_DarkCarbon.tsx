"use client";

import { useState } from "react";
import { Search, Sparkles, TrendingUp, TrendingDown, Clock, Zap, Target, Layers, FileText, ChevronRight, Activity, Terminal } from "lucide-react";

export default function DarkCarbonTheme() {
  const [query, setQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("overview");

  return (
    <div className="min-h-screen bg-[#09090b] font-sans text-stone-300 antialiased selection:bg-teal-500 selection:text-black">
      {/* Mesh/Grid Background Overlay */}
      <div 
        className="absolute inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 -z-10" 
      />
      
      {/* Neon Cyberpunk Accents */}
      <div className="absolute top-0 left-1/3 w-80 h-80 bg-teal-500/10 rounded-full blur-[100px] -z-10" />
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-[120px] -z-10" />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#09090b]/80 backdrop-blur-md border-b border-stone-800/80 shadow-[0_1px_20px_rgba(0,0,0,0.4)]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <Terminal className="text-black w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-white uppercase tracking-wider">InfoVac</span>
              <span className="text-[9px] block text-stone-500 font-mono">Theme // Carbon Cyber</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-xs text-stone-400 cursor-pointer hover:text-teal-400 transition-colors font-medium">Docs</span>
            <span className="text-xs text-stone-400 cursor-pointer hover:text-teal-400 transition-colors font-medium">Console</span>
            <button className="text-xs bg-teal-500 text-black font-semibold hover:bg-teal-400 px-4 py-2 rounded-lg transition-all shadow-md shadow-teal-500/10 active:scale-95">
              Force Run
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 space-y-12">
        {/* Search / Input block */}
        <div className="text-center max-w-xl mx-auto space-y-5">
          <Badge text="INTELLIGENCE KERNEL // v0.3" glow />
          <h1 className="text-4xl font-extrabold tracking-tight text-white uppercase leading-none">
            Competitive <br />
            <span className="bg-gradient-to-r from-teal-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">Analysis Matrix</span>
          </h1>
          <p className="text-xs text-stone-500">
            Parallel crawling, verified claim pipelines, and unified comparison. Query multiple networks separating with comma.
          </p>

          {/* Cyberpunk input */}
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-xl blur opacity-30 group-hover:opacity-70 transition duration-500" />
            <div className="relative bg-[#121214] border border-stone-800 rounded-xl p-2.5 flex items-center gap-3">
              <Search className="text-stone-500 w-5 h-5 ml-2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Starbucks, Delta, Marriott..."
                className="bg-transparent border-0 outline-none flex-1 text-sm text-stone-200 placeholder:text-stone-600 font-mono"
              />
              <button className="bg-gradient-to-r from-teal-500 to-cyan-500 text-black px-5 py-2 rounded-lg text-xs font-bold hover:brightness-115 transition-all shadow-sm active:scale-95">
                Analyze
              </button>
            </div>
          </div>
        </div>

        {/* Dashboard Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left panel: Active Pipelines */}
          <div className="space-y-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 font-mono px-1 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-teal-400" />
              System Pipelines
            </h3>
            
            <div className="space-y-3">
              <CarbonCard name="Starbucks Rewards" status="Complete" progress={100} />
              <CarbonCard name="Delta SkyMiles" status="Extracting fields (R7)" progress={65} active />
              <CarbonCard name="Marriott Bonvoy" status="Pending Queue" progress={0} />
            </div>
          </div>

          {/* Right panel: Comparison / Result View */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between border-b border-stone-850 pb-3">
              <div className="flex gap-2">
                <TabButton label="Compare Overview" active={selectedTab === "overview"} onClick={() => setSelectedTab("overview")} />
                <TabButton label="Verified Facts Grid" active={selectedTab === "grid"} onClick={() => setSelectedTab("grid")} />
              </div>
              <Badge text="READY FOR INGEST" glow />
            </div>

            {selectedTab === "overview" ? (
              <div className="space-y-6 animate-in fade-in duration-300">
                {/* Executive Summary Card */}
                <div className="bg-[#121214] border border-stone-800 rounded-xl p-6 shadow-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl group-hover:bg-teal-500/10 transition-all" />
                  
                  <div className="flex items-center gap-2 text-teal-400 font-bold text-xs uppercase tracking-wider font-mono mb-3">
                    <Sparkles className="w-4 h-4" />
                    Comparative Synthesis
                  </div>
                  <p className="text-xs text-stone-400 leading-relaxed font-mono">
                    Starbucks Rewards dominates the frequency-based retail segment through its high transaction-to-visit ratio and digital convenience, whereas Delta SkyMiles provides long-tail high-value rewards tailored to loyalty tier retention and airline partner alignment.
                  </p>
                </div>

                {/* Matrix Rows */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-stone-500 uppercase tracking-widest px-1 font-mono">Cross-Analysis Evaluation</h4>
                  
                  <MatrixCard
                    category="Earn Dynamics"
                    rankings={["Starbucks (Fast)", "Delta (Premium)"]}
                    rationale="Starbucks yields stars instantly per spend dollar; Delta uses flight distances and Medallion qualifiers which delay award realization."
                  />
                  <MatrixCard
                    category="Tier Structure"
                    rankings={["Delta (Robust)", "Starbucks (Flat)"]}
                    rationale="Delta's 4-tier Medallion hierarchy offers rich lounges, upgrades and partner integrations. Starbucks operates on a simple star conversion tier."
                  />
                </div>
              </div>
            ) : (
              <div className="bg-[#121214] border border-stone-800 rounded-xl p-4 shadow-xl h-96 flex items-center justify-center text-xs text-stone-600 font-mono">
                No active data loaded. Run pipeline.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// Subcomponents
function Badge({ text, glow = false }: { text: string; glow?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[9px] font-bold font-mono tracking-wider border ${
      glow
        ? "bg-teal-500/5 border-teal-500/30 text-teal-400 shadow-[0_0_15px_rgba(20,184,166,0.05)]"
        : "bg-stone-900 border-stone-800 text-stone-500"
    }`}>
      {glow && <span className="w-1 h-1 bg-teal-400 rounded-full animate-pulse" />}
      {text}
    </span>
  );
}

function CarbonCard({ name, status, progress, active = false }: { name: string; status: string; progress: number; active?: boolean }) {
  return (
    <div className={`relative overflow-hidden border rounded-xl p-4 transition-all duration-300 ${
      active
        ? "bg-[#161619] border-teal-500/40 shadow-[0_0_20px_rgba(20,184,166,0.03)]"
        : "bg-[#121214] border-stone-850 hover:bg-[#151518] hover:border-stone-800"
    }`}>
      {active && (
        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-teal-400 to-cyan-500" />
      )}
      <div className="flex justify-between items-start mb-2 pl-1">
        <span className="text-xs font-bold text-stone-200 font-mono">{name}</span>
        <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded ${
          progress === 100
            ? "bg-emerald-500/5 border border-emerald-500/20 text-emerald-400"
            : active
            ? "bg-teal-500/5 border border-teal-500/20 text-teal-400"
            : "bg-stone-900 border border-stone-850 text-stone-500"
        }`}>{status}</span>
      </div>
      <div className="space-y-1 pl-1">
        <div className="h-1 w-full bg-stone-900 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              progress === 100 ? "bg-gradient-to-r from-teal-400 to-cyan-400" : "bg-teal-500"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-bold font-mono px-4 py-2 rounded-lg transition-all ${
        active
          ? "bg-[#161619] text-teal-400 border border-stone-800"
          : "text-stone-500 hover:text-stone-300"
      }`}
    >
      {label}
    </button>
  );
}

function MatrixCard({ category, rankings, rationale }: { category: string; rankings: string[]; rationale: string }) {
  return (
    <div className="bg-[#121214] border border-stone-800 rounded-xl p-5 hover:border-teal-500/40 transition-all duration-300 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-stone-850 pb-2">
        <span className="text-xs font-bold text-stone-300 uppercase tracking-wider font-mono">{category}</span>
        <div className="flex gap-1.5 font-mono">
          {rankings.map((name, i) => (
            <span
              key={name}
              className={`text-[9px] font-bold py-0.5 px-2.5 rounded border ${
                i === 0
                  ? "bg-teal-500/5 border-teal-500/20 text-teal-400"
                  : "bg-stone-900 border-stone-850 text-stone-500"
              }`}
            >
              {name}
            </span>
          ))}
        </div>
      </div>
      <p className="text-xs text-stone-500 leading-relaxed font-mono">{rationale}</p>
    </div>
  );
}
