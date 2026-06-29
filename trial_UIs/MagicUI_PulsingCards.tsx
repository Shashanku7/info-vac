"use client";

import { Sparkles, Check, Info, FileText } from "lucide-react";

export default function MagicUIPulsingCards() {
  return (
    <div className="min-h-screen bg-[#09090b] text-stone-200 p-8 font-sans antialiased relative overflow-hidden">
      {/* Background Dot Texture */}
      <div 
        className="absolute inset-0 bg-[radial-gradient(#1c1c1f_1px,transparent_1px)] bg-[size:1.5rem_1.5rem] opacity-40 -z-10" 
      />

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Title */}
        <div className="text-center space-y-3">
          <span className="bg-teal-500/10 border border-teal-500/30 text-teal-400 text-[10px] px-3 py-0.5 rounded-full font-mono">
            PULSING GRID TELEMETRY
          </span>
          <h2 className="text-2xl font-extrabold text-white uppercase tracking-wider font-mono">Pulsing Card System</h2>
        </div>

        {/* Pulsing card grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PulseCard
            title="Starbucks Ingestion"
            status="Passed Gate"
            progress={100}
            done
          />
          <PulseCard
            title="Delta Medallion Extraction"
            status="Active extraction"
            progress={75}
            active
          />
        </div>
      </div>
    </div>
  );
}

function PulseCard({ title, status, progress, active = false, done = false }: { title: string; status: string; progress: number; active?: boolean; done?: boolean }) {
  return (
    <div className={`border rounded-2xl p-5 space-y-4 relative overflow-hidden transition-all duration-300 ${
      active
        ? "bg-[#121214] border-teal-500/30 shadow-[0_0_20px_rgba(20,184,166,0.03)]"
        : "bg-[#0c0c0e] border-stone-850"
    }`}>
      {active && (
        <span className="absolute top-2 right-2 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
        </span>
      )}

      <div className="space-y-1">
        <h4 className="text-xs font-bold font-mono text-white uppercase tracking-wider">{title}</h4>
        <span className="text-[10px] text-stone-500 font-mono">{status}</span>
      </div>

      <div className="space-y-1.5 font-mono text-[10px]">
        <div className="flex justify-between text-stone-500">
          <span>Verification rate</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1 bg-stone-900 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              done ? "bg-emerald-500" : "bg-teal-500"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
