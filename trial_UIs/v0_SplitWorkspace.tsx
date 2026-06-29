"use client";

import { Activity, Play, Sparkles, Database, FileText } from "lucide-react";

export default function V0SplitWorkspace() {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 p-8 font-sans antialiased">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Nav header */}
        <div className="flex items-center justify-between border-b border-stone-200 pb-4">
          <div>
            <span className="text-[10px] text-stone-400 font-mono tracking-widest uppercase block mb-1">V0 VERCEL STYLE // WORKSPACE</span>
            <h1 className="text-lg font-bold text-stone-900 tracking-tight">Unified Split Ingest</h1>
          </div>
          <span className="bg-stone-100 text-stone-600 text-[10px] px-2.5 py-1 rounded-md border border-stone-200 font-mono">
            DEPLOYMENT: ACTIVE
          </span>
        </div>

        {/* Split grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left panel: Active running targets (takes 1 col) */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4 shadow-sm h-80 flex flex-col justify-between">
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest">Active Runs</h3>
              <div className="space-y-3">
                <WorkspaceRow name="Starbucks Stars" status="complete" />
                <WorkspaceRow name="Delta SkyMiles" status="running" />
              </div>
            </div>
            <button className="w-full bg-stone-950 hover:bg-stone-800 text-white text-xs font-semibold py-2 rounded-lg transition-all flex items-center justify-center gap-1">
              <Play size={12} fill="white" />
              Ingest New
            </button>
          </div>

          {/* Right panel: Comparison / Result View (takes 2 cols) */}
          <div className="md:col-span-2 bg-white border border-stone-200 rounded-xl p-6 shadow-sm h-80 flex flex-col justify-between">
            <div className="space-y-3">
              <span className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles size={14} className="text-stone-800" />
                Comparative Summary
              </span>
              <p className="text-xs text-stone-600 leading-relaxed">
                The evaluated entities contrast frequency-based retail models with travel elite ecosystems. The system extracted 44 validated nodes for cross-evaluation.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-stone-100 pt-4">
              <div>
                <span className="text-[10px] text-stone-400 block uppercase">Confidence Index</span>
                <span className="text-base font-bold text-stone-800">92.4%</span>
              </div>
              <div>
                <span className="text-[10px] text-stone-400 block uppercase">Parsed Nodes</span>
                <span className="text-base font-bold text-stone-800">88 / 88</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkspaceRow({ name, status }: { name: string; status: "complete" | "running" }) {
  return (
    <div className="flex justify-between items-center text-xs border border-stone-100 bg-stone-50/50 p-2.5 rounded-lg">
      <span className="font-semibold text-stone-850 truncate pr-2">{name}</span>
      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
        status === "complete" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-stone-100 text-stone-500 border border-stone-200"
      }`}>
        {status}
      </span>
    </div>
  );
}
