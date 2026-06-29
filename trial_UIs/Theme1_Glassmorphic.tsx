"use client";

import { useState } from "react";
import { Search, Sparkles, TrendingUp, TrendingDown, Clock, Zap, Target, Layers, FileText, ChevronRight, Activity } from "lucide-react";

export default function GlassmorphicTheme() {
  const [query, setQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("overview");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/20 to-stone-50 font-sans text-stone-800 antialiased selection:bg-emerald-200">
      {/* Background Decorative Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-300/10 rounded-full blur-3xl -z-10" />
      <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-teal-200/10 rounded-full blur-3xl -z-10" />

      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/60 border-b border-white/80 shadow-[0_1px_10px_rgba(0,0,0,0.02)]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Zap className="text-white w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">InfoVac</span>
              <span className="text-[10px] block text-stone-400 font-medium">Glassmorphic Elegance</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-xs text-stone-500 cursor-pointer hover:text-emerald-600 transition-colors font-medium">Documentation</span>
            <span className="text-xs text-stone-500 cursor-pointer hover:text-emerald-600 transition-colors font-medium">History</span>
            <button className="text-xs bg-emerald-600/90 text-white font-medium hover:bg-emerald-600 px-4 py-2 rounded-lg transition-all shadow-sm shadow-emerald-600/10">
              New Run
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 space-y-10">
        {/* Search Segment */}
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <Badge text="Powered by LLM Verification" />
          <h1 className="text-4xl font-bold tracking-tight text-stone-900 leading-tight">
            Loyalty Intelligence <br />
            <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">Meets Verified Precision</span>
          </h1>
          <p className="text-xs text-stone-500">
            Compare loyalty networks with deep-crawled, citation-checked metrics. Just separate program names with commas.
          </p>

          {/* Glassmorphic Search Bar */}
          <div className="relative group max-w-xl mx-auto">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-2xl blur opacity-30 group-hover:opacity-40 transition duration-300" />
            <div className="relative bg-white/70 border border-white backdrop-blur-md rounded-2xl p-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.04)] flex items-center gap-3">
              <Search className="text-stone-400 w-5 h-5 ml-2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Starbucks Rewards, Delta SkyMiles..."
                className="bg-transparent border-0 outline-none flex-1 text-sm text-stone-800 placeholder:text-stone-400"
              />
              <button className="bg-gradient-to-r from-emerald-600 to-teal-500 text-white px-5 py-2 rounded-xl text-xs font-semibold hover:brightness-105 active:scale-95 transition-all shadow-sm">
                Analyze
              </button>
            </div>
          </div>
        </div>

        {/* Workspace Layout mockup */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left panel: Selected Comparison / Active Pipelines */}
          <div className="space-y-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 px-1">ACTIVE WORKSPACE</h3>
            
            {/* Multi-runner cards (Glassmorphic) */}
            <div className="space-y-3">
              <GlassCard name="Starbucks Rewards" status="Complete" progress={100} />
              <GlassCard name="Delta SkyMiles" status="Extracting fields..." progress={65} active />
              <GlassCard name="Marriott Bonvoy" status="Queued" progress={0} />
            </div>
          </div>

          {/* Right panel: Comparison / Result View mockup */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between border-b border-stone-200/60 pb-3">
              <div className="flex gap-2">
                <TabButton label="Comparison Overview" active={selectedTab === "overview"} onClick={() => setSelectedTab("overview")} />
                <TabButton label="Factual Data Grid" active={selectedTab === "grid"} onClick={() => setSelectedTab("grid")} />
              </div>
              <Badge text="Cross-Analysis Ready" green />
            </div>

            {selectedTab === "overview" ? (
              <div className="space-y-6 animate-in fade-in duration-300">
                {/* Executive Summary Card */}
                <div className="bg-white/70 backdrop-blur-md border border-white rounded-2xl p-6 shadow-sm space-y-3">
                  <div className="flex items-center gap-2 text-emerald-600 font-semibold text-xs uppercase tracking-wider">
                    <Sparkles className="w-4 h-4" />
                    Executive Summary
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Starbucks Rewards dominates the frequency-based retail segment through its high transaction-to-visit ratio and digital convenience, whereas Delta SkyMiles provides long-tail high-value rewards tailored to loyalty tier retention and airline partner alignment.
                  </p>
                </div>

                {/* Matrix Cards (Glassmorphic design) */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-1">COMPETITIVE SEGMENTATION</h4>
                  
                  <MatrixRow
                    category="Earn Dynamics"
                    rankings={["Starbucks (Fast)", "Delta (Premium)"]}
                    rationale="Starbucks yields stars instantly per spend dollar; Delta uses flight distances and Medallion qualifiers which delay award realization."
                  />
                  <MatrixRow
                    category="Tier Structure"
                    rankings={["Delta (Robust)", "Starbucks (Flat)"]}
                    rationale="Delta's 4-tier Medallion hierarchy offers rich lounges, upgrades and partner integrations. Starbucks operates on a simple star conversion tier."
                  />
                </div>
              </div>
            ) : (
              <div className="bg-white/70 backdrop-blur-md border border-white rounded-2xl p-4 shadow-sm h-96 flex items-center justify-center text-xs text-stone-400">
                Data Grid Mockup
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// Subcomponents
function Badge({ text, green = false }: { text: string; green?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold border ${
      green
        ? "bg-emerald-50 border-emerald-200/80 text-emerald-700"
        : "bg-white/80 border-stone-200/60 text-stone-500"
    }`}>
      {green && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />}
      {text}
    </span>
  );
}

function GlassCard({ name, status, progress, active = false }: { name: string; status: string; progress: number; active?: boolean }) {
  return (
    <div className={`relative overflow-hidden backdrop-blur-md border rounded-2xl p-4 transition-all duration-300 ${
      active
        ? "bg-white border-emerald-300 shadow-[0_10px_20px_rgba(16,185,129,0.04)]"
        : "bg-white/50 border-white hover:bg-white/80 hover:border-stone-200/80 shadow-sm"
    }`}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-semibold text-stone-800">{name}</span>
        <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full ${
          progress === 100
            ? "bg-emerald-50 border border-emerald-200/60 text-emerald-700"
            : active
            ? "bg-amber-50 border border-amber-200/60 text-amber-700"
            : "bg-stone-50 border border-stone-200/60 text-stone-400"
        }`}>{status}</span>
      </div>
      <div className="space-y-1">
        <div className="h-1.5 bg-stone-100/80 border border-white/60 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              progress === 100 ? "bg-gradient-to-r from-emerald-500 to-teal-400" : "bg-emerald-500"
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
      className={`text-xs font-semibold px-4 py-2 rounded-lg transition-all ${
        active
          ? "bg-emerald-600/10 text-emerald-700 border border-emerald-600/10"
          : "text-stone-500 hover:text-stone-800"
      }`}
    >
      {label}
    </button>
  );
}

function MatrixRow({ category, rankings, rationale }: { category: string; rankings: string[]; rationale: string }) {
  return (
    <div className="bg-white/50 backdrop-blur-md border border-white rounded-2xl p-5 hover:border-emerald-300 transition-all duration-300 space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-stone-100 pb-2">
        <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">{category}</span>
        <div className="flex gap-1.5">
          {rankings.map((name, i) => (
            <span
              key={name}
              className={`text-[9px] font-semibold py-0.5 px-2.5 rounded-full border ${
                i === 0
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-stone-50 border-stone-200 text-stone-500"
              }`}
            >
              {i === 0 && "🏆 "}
              {name}
            </span>
          ))}
        </div>
      </div>
      <p className="text-xs text-stone-500 leading-relaxed">{rationale}</p>
    </div>
  );
}
