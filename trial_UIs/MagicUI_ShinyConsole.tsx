"use client";

import { Search, Sparkles, Terminal, Activity, Zap, ShieldAlert } from "lucide-react";

export default function MagicUIShinyConsole() {
  return (
    <div className="min-h-screen bg-[#030303] text-stone-300 p-8 font-mono antialiased relative overflow-hidden">
      {/* Grid backdrop */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#141414_1px,transparent_1px),linear-gradient(to_bottom,#141414_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-20 -z-10" />

      {/* Laser accent blur */}
      <div className="absolute top-0 right-1/3 w-72 h-72 bg-teal-500/5 rounded-full blur-[80px] -z-10" />

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Title */}
        <div>
          <span className="text-[9px] text-teal-400 uppercase tracking-widest block mb-1">// MAGIC_UI SHINY CONSOLE</span>
          <h1 className="text-xl font-bold text-white uppercase tracking-wider">InfoVac Core Console</h1>
        </div>

        {/* Shiny Input box (Laser borders) */}
        <div className="relative group rounded-lg overflow-hidden border border-stone-850 p-[1px] bg-stone-900">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-300 -z-10" />
          <div className="bg-[#09090b] rounded-lg p-3 flex items-center gap-3">
            <Terminal className="text-teal-400 w-4 h-4" />
            <input
              type="text"
              readOnly
              value="Starbucks Rewards, Delta SkyMiles, Marriott Bonvoy"
              className="bg-transparent border-0 outline-none flex-1 text-xs text-stone-200"
            />
            <span className="text-[9px] bg-teal-500/10 text-teal-400 px-2 py-0.5 rounded">READY</span>
          </div>
        </div>

        {/* Shiny Bento details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ConsoleCard
            title="Ingestion Matrix"
            desc="Structured entities crawled from 32 distinct verified domains."
            status="Complete"
          />
          <ConsoleCard
            title="Evaluation Kernel"
            desc="Citation gate check complete. 4 conflicts resolved via LLM judge."
            status="Active"
            active
          />
        </div>
      </div>
    </div>
  );
}

function ConsoleCard({ title, desc, status, active = false }: { title: string; desc: string; status: string; active?: boolean }) {
  return (
    <div className={`border rounded-xl p-5 space-y-3 relative overflow-hidden transition-all duration-300 ${
      active
        ? "bg-[#09090b] border-teal-500/30 shadow-[0_0_25px_rgba(20,184,166,0.02)] animate-pulse"
        : "bg-[#050507] border-stone-850 hover:border-stone-800"
    }`}>
      {active && (
        <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/[0.02] rounded-full blur-xl" />
      )}
      
      <div className="flex justify-between items-center border-b border-stone-850 pb-2">
        <span className="text-xs font-bold text-white uppercase tracking-wider">{title}</span>
        <span className={`text-[9px] px-2 py-0.5 rounded ${
          active ? "bg-teal-500/10 text-teal-400" : "bg-stone-900 text-stone-500"
        }`}>{status}</span>
      </div>
      <p className="text-xs text-stone-500 leading-relaxed">{desc}</p>
    </div>
  );
}
