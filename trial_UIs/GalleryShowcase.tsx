"use client";

import { useState } from "react";
import { Search, Sparkles, TrendingUp, TrendingDown, Loader2, Zap, Terminal, Layers, FileText, CheckCircle2, ChevronRight, HelpCircle, ArrowRight } from "lucide-react";

export default function GalleryShowcase() {
  const [activeTheme, setActiveTheme] = useState<"aceternity" | "shadcn" | "antd">("aceternity");
  const [query, setQuery] = useState("Starbucks, Delta, Marriott");

  return (
    <div className="min-h-screen bg-[#09090b] font-sans antialiased text-stone-200">
      {/* Top sticky switcher */}
      <div className="sticky top-0 z-50 bg-[#09090b]/90 border-b border-stone-800 backdrop-blur-md px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-sm font-bold text-white uppercase tracking-wider">UI Gallery Showcase</h1>
          <p className="text-[10px] text-stone-500 font-mono">Select a predesigned system style to preview layout alignment</p>
        </div>
        
        {/* Selector tabs */}
        <div className="flex bg-stone-900 border border-stone-850 p-1 rounded-xl gap-1">
          <ThemeSelectorBtn
            label="Aceternity / Magic UI"
            desc="Glow & Bento"
            active={activeTheme === "aceternity"}
            onClick={() => setActiveTheme("aceternity")}
          />
          <ThemeSelectorBtn
            label="Shadcn Blocks"
            desc="SaaS Layouts"
            active={activeTheme === "shadcn"}
            onClick={() => setActiveTheme("shadcn")}
          />
          <ThemeSelectorBtn
            label="AntD / Material UI"
            desc="Corporate Data"
            active={activeTheme === "antd"}
            onClick={() => setActiveTheme("antd")}
          />
        </div>
      </div>

      {/* Render selected style preview workspace */}
      <div className="p-6 md:p-12 max-w-6xl mx-auto">
        {activeTheme === "aceternity" && <AceternityPreview query={query} setQuery={setQuery} />}
        {activeTheme === "shadcn" && <ShadcnPreview query={query} setQuery={setQuery} />}
        {activeTheme === "antd" && <AntdPreview query={query} setQuery={setQuery} />}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. ACETERNITY / MAGIC UI STYLE PREVIEW (Dark Cyber, Bento, Glowing card)
// ──────────────────────────────────────────────────────────────────────────────
function AceternityPreview({ query, setQuery }: { query: string; setQuery: (q: string) => void }) {
  return (
    <div className="space-y-10 animate-in fade-in duration-300">
      {/* Hero Header */}
      <div className="text-center max-w-xl mx-auto space-y-4">
        <span className="bg-teal-500/10 border border-teal-500/30 text-teal-400 text-[10px] font-mono font-bold tracking-wider px-3 py-1 rounded-full shadow-[0_0_15px_rgba(20,184,166,0.05)]">
          ✨ DYNAMIC GLOW BACKDROP
        </span>
        <h2 className="text-3xl font-extrabold tracking-tight text-white uppercase font-mono">
          Bento Grid & <br />
          <span className="bg-gradient-to-r from-teal-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">Glowing Matrix</span>
        </h2>
      </div>

      {/* Glow Search Bar (Magic UI styled) */}
      <div className="relative group max-w-lg mx-auto">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-xl blur opacity-30 group-hover:opacity-60 transition duration-300" />
        <div className="relative bg-[#121214] border border-stone-800 rounded-xl p-2.5 flex items-center gap-3">
          <Search className="text-stone-500 w-5 h-5 ml-2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-transparent border-0 outline-none flex-1 text-xs text-stone-200 placeholder:text-stone-600 font-mono"
            placeholder="Starbucks, Delta..."
          />
          <button className="bg-teal-500 text-black px-4 py-1.5 rounded-lg text-[11px] font-bold hover:bg-teal-400 transition-all font-mono">
            Ingest
          </button>
        </div>
      </div>

      {/* Bento Grid layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Bento Item 1: Active pipelines (takes 1 col) */}
        <div className="bg-[#121214] border border-stone-800 hover:border-teal-500/30 rounded-2xl p-6 transition-all duration-300 flex flex-col justify-between group h-80 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/[0.02] rounded-full blur-2xl group-hover:bg-teal-500/[0.08]" />
          <div>
            <h3 className="text-xs font-bold font-mono text-stone-400 uppercase tracking-widest mb-1">Crawl Status</h3>
            <span className="text-[10px] text-stone-600 font-mono">Active parallel crawlers</span>
          </div>

          <div className="space-y-3">
            <BentoPipelineRow name="Starbucks" progress={100} complete />
            <BentoPipelineRow name="Delta" progress={65} active />
            <BentoPipelineRow name="Marriott" progress={0} />
          </div>

          <div className="flex items-center gap-1.5 text-teal-400 text-xs font-mono group-hover:translate-x-1 transition-transform cursor-pointer">
            View Live Logs <ArrowRight size={12} />
          </div>
        </div>

        {/* Bento Item 2: Executive Summary (takes 2 cols) */}
        <div className="md:col-span-2 bg-[#121214] border border-stone-800 hover:border-teal-500/30 rounded-2xl p-6 transition-all duration-300 flex flex-col justify-between group h-80 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 to-cyan-500 opacity-20" />
          <div>
            <h3 className="text-xs font-bold font-mono text-teal-400 uppercase tracking-widest mb-2 flex items-center gap-1">
              <Sparkles size={14} className="animate-pulse" />
              Comparative Synthesis
            </h3>
            <p className="text-xs text-stone-400 leading-relaxed font-mono">
              The target entities represent contrasting loyalty mechanics. Starbucks operates an active immediate-gratification loop driven by fast-casual transactions. Delta focuses on a highly retention-centric elite system requiring substantial travel volume.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-stone-850 pt-4 mt-4 font-mono">
            <div>
              <span className="text-[10px] text-stone-500 block uppercase">Confidence Index</span>
              <span className="text-lg font-bold text-white">92.4%</span>
            </div>
            <div>
              <span className="text-[10px] text-stone-500 block uppercase">Verified Claims</span>
              <span className="text-lg font-bold text-white">88 / 88</span>
            </div>
          </div>
        </div>

        {/* Bento Item 3: Matrices (full width) */}
        <div className="md:col-span-3 bg-[#121214] border border-stone-800 rounded-2xl p-6 space-y-4">
          <h4 className="text-xs font-bold font-mono text-stone-400 uppercase tracking-widest">Category Matrices</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <BentoMatrixRow
              cat="Earn Mechanics"
              winner="Starbucks"
              loser="Delta"
              rationale="Starbucks is fast-convertible per-dollar. Delta Medallion requires flight miles or co-branded CC spend limits."
            />
            <BentoMatrixRow
              cat="Tier Structures"
              winner="Delta"
              loser="Starbucks"
              rationale="Delta's tiered benefits offer tangible lounge access and global skyteam alliance. Starbucks offers simple star redemption levels."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// 2. SHADCN BLOCKS STYLE PREVIEW (Clean Light Mode SaaS Dashboard feel)
// ──────────────────────────────────────────────────────────────────────────────
function ShadcnPreview({ query, setQuery }: { query: string; setQuery: (q: string) => void }) {
  return (
    <div className="bg-[#fafafa] border border-stone-200 text-stone-800 rounded-3xl p-8 space-y-8 shadow-[0_4px_30px_rgba(0,0,0,0.02)] animate-in fade-in duration-300">
      {/* Top Header Mockup */}
      <div className="flex items-center justify-between border-b border-stone-200 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-stone-900 tracking-tight">SaaS Workspace</h2>
          <p className="text-xs text-stone-500">Workspace summary for {query.split(",").length} targets</p>
        </div>
        <div className="flex gap-2">
          <button className="text-xs bg-stone-900 text-white font-medium hover:bg-stone-800 px-4 py-2 rounded-lg transition-all shadow-sm">
            Compare Selected
          </button>
        </div>
      </div>

      {/* Input row */}
      <div className="flex items-center gap-3 bg-white border border-stone-200 rounded-xl p-1.5 shadow-sm max-w-lg">
        <Search className="text-stone-400 w-4 h-4 ml-2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="bg-transparent border-0 outline-none flex-1 text-xs text-stone-800 placeholder:text-stone-400"
          placeholder="Programs..."
        />
        <button className="bg-stone-900 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-stone-800 transition-all">
          Search
        </button>
      </div>

      {/* Split view (SaaS Dashboard layout) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left list of targets */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-stone-500 uppercase tracking-widest">Active Runs</h4>
          <ShadcnTargetRow name="Starbucks Rewards" status="Completed" progress={100} active />
          <ShadcnTargetRow name="Delta SkyMiles" status="Crawling sources" progress={45} />
        </div>

        {/* Right details / Overview card */}
        <div className="md:col-span-2 space-y-4">
          <h4 className="text-xs font-bold text-stone-500 uppercase tracking-widest">Comparison Summary</h4>
          
          <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4 shadow-sm">
            <h3 className="text-sm font-semibold text-stone-900">Executive Synthesis</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Starbucks focuses on low-friction frequent transactions, while Delta leverages higher cost travel commitments to build loyalty. The two models display contrasting approaches to capital lockups and redemption windows.
            </p>
            
            <div className="border-t border-stone-100 pt-4 grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-stone-400 font-medium block">Total Cost Saved</span>
                <span className="text-sm font-semibold text-stone-800">$184.50</span>
              </div>
              <div>
                <span className="text-[10px] text-stone-400 font-medium block">Extraction Confidence</span>
                <span className="text-sm font-semibold text-stone-800">Excellent (94%)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// 3. ANTD / MATERIAL UI STYLE PREVIEW (Data-Dense, Steps, Lists)
// ──────────────────────────────────────────────────────────────────────────────
function AntdPreview({ query, setQuery }: { query: string; setQuery: (q: string) => void }) {
  return (
    <div className="bg-[#121214] border border-stone-800 rounded-3xl p-8 space-y-10 animate-in fade-in duration-300 font-mono">
      {/* Title */}
      <div>
        <h2 className="text-sm font-bold text-stone-400 uppercase tracking-wider">// ANT_DESIGN COMPONENT LAYOUT</h2>
        <p className="text-xs text-stone-600">Structured data-dense list grids and linear pipeline steps</p>
      </div>

      {/* Input */}
      <div className="flex border border-stone-700 bg-stone-900 rounded overflow-hidden max-w-md">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="bg-transparent border-0 outline-none flex-1 text-xs text-stone-300 placeholder:text-stone-700 px-3 py-2 font-mono"
          placeholder="Targets..."
        />
        <button className="bg-stone-800 text-stone-300 px-4 text-xs font-bold border-l border-stone-700 hover:bg-stone-700 transition-all">
          [RUN]
        </button>
      </div>

      {/* Step pipeline view (AntD Step component mock) */}
      <div className="space-y-3 bg-[#161618] border border-stone-800 p-5 rounded-lg">
        <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest block mb-4">Pipeline Steps (AntD Steps)</span>
        <div className="flex flex-col sm:flex-row justify-between gap-4 font-mono text-[11px]">
          <AntdStep label="1. Crawl" desc="Tavily + Firecrawl" status="finish" />
          <AntdStep label="2. Extract" desc="44 Fields (Pydantic)" status="finish" />
          <AntdStep label="3. Verify" desc="Citation gate check" status="process" />
          <AntdStep label="4. Synthesis" desc="LLM analyst brief" status="wait" />
        </div>
      </div>

      {/* Description table / structured list (MUI styled) */}
      <div className="space-y-3">
        <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest block px-1">Description Data (Material UI Descriptions Table)</span>
        <div className="border border-stone-800 rounded-lg overflow-hidden divide-y divide-stone-850 text-xs bg-[#161618]">
          <AntdDescRow label="Base Earn Rate" val="Starbucks: 1-2 stars per $1 // Delta: 1 mile per $1" />
          <AntdDescRow label="Redemption Threshold" val="Starbucks: 25 stars (minimum) // Delta: ~5,000 miles" />
          <AntdDescRow label="Point Expiry" val="Starbucks: 6 months // Delta: Never expire" />
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Subcomponents Helper Functions
// ──────────────────────────────────────────────────────────────────────────────

function ThemeSelectorBtn({ label, desc, active, onClick }: { label: string; desc: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-left transition-all ${
        active
          ? "bg-[#0F766E] text-white shadow-sm"
          : "text-stone-500 hover:text-stone-300"
      }`}
    >
      <span className="text-xs font-bold block leading-tight">{label}</span>
      <span className={`text-[9px] block leading-none font-mono ${active ? "text-emerald-100" : "text-stone-600"}`}>
        {desc}
      </span>
    </button>
  );
}

// Aceternity elements
function BentoPipelineRow({ name, progress, complete = false, active = false }: { name: string; progress: number; complete?: boolean; active?: boolean }) {
  return (
    <div className="space-y-1 font-mono text-[11px]">
      <div className="flex justify-between text-stone-400">
        <span className={active ? "text-teal-400 font-bold" : "text-stone-300"}>{name}</span>
        <span className="text-[10px] text-stone-500">
          {complete ? "✓ Done" : active ? "Extracting" : "Queue"}
        </span>
      </div>
      <div className="h-1 bg-stone-900 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${complete ? "bg-emerald-500" : active ? "bg-teal-500 animate-pulse" : "bg-stone-800"}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function BentoMatrixRow({ cat, winner, loser, rationale }: { cat: string; winner: string; loser: string; rationale: string }) {
  return (
    <div className="border border-stone-850 bg-stone-900/40 rounded-xl p-4 space-y-2 font-mono text-[11px]">
      <div className="flex justify-between items-center border-b border-stone-850 pb-2">
        <span className="text-white font-bold">{cat}</span>
        <div className="flex gap-1">
          <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-[9px]">{winner}</span>
          <span className="bg-stone-950 border border-stone-800 text-stone-500 px-2 py-0.5 rounded text-[9px]">{loser}</span>
        </div>
      </div>
      <p className="text-stone-500 leading-relaxed text-[10px]">{rationale}</p>
    </div>
  );
}

// Shadcn elements
function ShadcnTargetRow({ name, status, progress, active = false }: { name: string; status: string; progress: number; active?: boolean }) {
  return (
    <div className={`border rounded-xl p-4 transition-all duration-200 ${
      active
        ? "bg-white border-stone-900 shadow-sm"
        : "bg-stone-50 border-stone-200"
    }`}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-semibold text-stone-900">{name}</span>
        <span className="text-[10px] text-stone-500">{status}</span>
      </div>
      <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-stone-900 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// AntD elements
function AntdStep({ label, desc, status }: { label: string; desc: string; status: "finish" | "process" | "wait" }) {
  const colorMap = {
    finish: "text-emerald-500 border-emerald-500",
    process: "text-teal-400 border-teal-400 animate-pulse",
    wait: "text-stone-700 border-stone-800",
  };
  return (
    <div className="flex-1 flex gap-2.5 items-start">
      <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 text-[10px] font-bold ${colorMap[status]}`}>
        {status === "finish" ? "✓" : "•"}
      </div>
      <div>
        <span className={`font-bold block ${status === "wait" ? "text-stone-600" : "text-stone-300"}`}>{label}</span>
        <span className="text-[10px] text-stone-500 block leading-tight">{desc}</span>
      </div>
    </div>
  );
}

function AntdDescRow({ label, val }: { label: string; val: string }) {
  return (
    <div className="flex flex-col sm:flex-row px-4 py-3 divide-y sm:divide-y-0 sm:divide-x divide-stone-850">
      <span className="font-bold text-stone-400 w-44 shrink-0 pr-4 pb-1 sm:pb-0">{label}</span>
      <span className="text-stone-500 pl-0 sm:pl-4 pt-1 sm:pt-0">{val}</span>
    </div>
  );
}
