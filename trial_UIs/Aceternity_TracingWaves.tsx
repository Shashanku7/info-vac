"use client";

import { Activity, Zap, CheckCircle, Flame, Layers } from "lucide-react";

export default function AceternityTracingWaves() {
  return (
    <div className="min-h-screen bg-[#09090b] text-stone-200 p-8 font-sans antialiased relative overflow-hidden">
      {/* Background neon laser grid effect */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-teal-500/10 via-transparent to-transparent -z-10" />
      <div className="absolute -top-40 left-1/3 w-[500px] h-[500px] bg-gradient-to-br from-teal-500/10 to-emerald-500/5 rounded-full blur-[140px] -z-10 animate-pulse" />

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-850 pb-4">
          <div>
            <span className="text-[10px] text-teal-400 font-mono tracking-widest uppercase block mb-1">ACETERNITY STYLE // CRAWL MONITOR</span>
            <h1 className="text-xl font-bold text-white uppercase tracking-wider font-mono">Crawl Telemetry Waves</h1>
          </div>
          <span className="bg-teal-500/5 border border-teal-500/20 text-teal-400 text-[10px] px-3 py-1 rounded font-mono">
            STATUS: ACTIVE
          </span>
        </div>

        {/* Telemetry wave cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <WaveCard
            name="Starbucks Rewards"
            status="Deduplication complete"
            progress={100}
            metric="18 Sources parsed"
          />
          <WaveCard
            name="Delta SkyMiles"
            status="Verifying facts (Gate #2)"
            progress={75}
            metric="24 Sources parsed"
            active
          />
        </div>

        {/* Large flowing terminal logs */}
        <div className="bg-[#121214] border border-stone-800 rounded-3xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/[0.01] rounded-full blur-xl" />
          <h3 className="text-xs font-bold font-mono text-stone-400 uppercase tracking-widest mb-4">Crawl Engine Feed</h3>
          
          <div className="space-y-2 font-mono text-[10px] text-stone-500">
            <p className="text-teal-400 font-semibold">[09:22.14] INFO: Initializing Tavily client for search query: "Starbucks rewards terms"</p>
            <p>[09:22.18] INFO: Crawler saved 12 documents to sources database (hash check passed)</p>
            <p className="text-amber-400 font-semibold">[09:22.25] WARN: robots.txt block detected on flyertalk.com; falling back to tavily snippet</p>
            <p className="text-emerald-400 font-semibold">[09:22.31] INFO: LLM citation gate passed on field 'base_earn_rate' (match score: 0.98)</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function WaveCard({ name, status, progress, metric, active = false }: { name: string; status: string; progress: number; metric: string; active?: boolean }) {
  return (
    <div className={`border rounded-3xl p-6 transition-all duration-300 relative overflow-hidden ${
      active
        ? "bg-[#161619] border-teal-500/40 shadow-[0_0_30px_rgba(20,184,166,0.02)]"
        : "bg-[#121214] border-stone-850"
    }`}>
      {active && (
        <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-teal-400 to-cyan-500 animate-pulse" />
      )}
      
      <div className="space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-xs font-bold font-mono text-white uppercase">{name}</h3>
            <span className="text-[10px] text-stone-500 font-mono">{metric}</span>
          </div>
          <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded ${
            progress === 100
              ? "bg-emerald-500/5 border border-emerald-500/20 text-emerald-400"
              : "bg-teal-500/5 border border-teal-500/20 text-teal-400"
          }`}>{status}</span>
        </div>

        <div className="space-y-2">
          <div className="h-1 bg-stone-900 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                progress === 100 ? "bg-gradient-to-r from-teal-500 to-cyan-500" : "bg-teal-500 animate-pulse"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
