"use client";

import { Check, Info, FileText } from "lucide-react";

export default function MUITimelineReport() {
  return (
    <div className="min-h-screen bg-[#fafafa] text-stone-850 p-8 font-sans antialiased">
      <div className="max-w-3xl mx-auto bg-white border border-stone-200 rounded-2xl p-8 shadow-sm space-y-8">
        {/* Title */}
        <div>
          <span className="text-[10px] text-stone-400 font-mono tracking-widest uppercase block mb-1">MUI COMPONENT // TIMELINE</span>
          <h2 className="text-sm font-bold text-stone-900">// Ingestion Timeline Logs</h2>
        </div>

        {/* MUI Timeline Component mock */}
        <div className="space-y-6 pl-4 border-l-2 border-stone-200">
          <TimelineItem
            time="09:22 AM"
            title="Discovery Completed"
            desc="Tavily discovered 32 candidate domains. Deduplicated down to 18 unique source URLs."
            active
          />
          <TimelineItem
            time="09:23 AM"
            title="Extraction Stage Passed"
            desc="Successfully extracted 44 Pydantic schema fields with zero structural mismatches."
          />
          <TimelineItem
            time="09:24 AM"
            title="Citation Verification Gate"
            desc="LLM match evaluator verified all fact quotes against raw webpage markup contents."
          />
        </div>
      </div>
    </div>
  );
}

function TimelineItem({ time, title, desc, active = false }: { time: string; title: string; desc: string; active?: boolean }) {
  return (
    <div className="relative pl-6 space-y-1">
      {/* Bullet point */}
      <span className={`absolute -left-[29px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center ${
        active ? "bg-[#1976d2] shadow-sm shadow-blue-500/50" : "bg-stone-300"
      }`} />

      <span className="text-[10px] text-stone-400 font-mono font-medium block">{time}</span>
      <h4 className="text-xs font-bold text-stone-850">{title}</h4>
      <p className="text-xs text-stone-500 leading-relaxed max-w-xl">{desc}</p>
    </div>
  );
}
