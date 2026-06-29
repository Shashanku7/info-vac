"use client";

import { CheckCircle2, Loader2, Play } from "lucide-react";

export default function AntDStepVerification() {
  return (
    <div className="min-h-screen bg-[#fafafa] text-stone-800 p-8 font-mono antialiased">
      <div className="max-w-4xl mx-auto space-y-8 border border-stone-200 bg-white rounded-2xl p-8 shadow-sm">
        {/* Header */}
        <div>
          <span className="text-[10px] text-stone-400 uppercase tracking-widest block mb-1">ANT_DESIGN COMPONENT // STEPS</span>
          <h2 className="text-sm font-bold text-stone-900">// Ingestion Pipeline Verification</h2>
        </div>

        {/* Step pipeline view (AntD Steps Component mockup) */}
        <div className="border border-stone-100 bg-stone-50/50 p-6 rounded-xl flex flex-col sm:flex-row justify-between gap-4">
          <AntdStep num={1} label="Crawl Sources" desc="18 pages ingested" status="finish" />
          <AntdStep num={2} label="Extract Schema" desc="44 Pydantic fields" status="finish" />
          <AntdStep num={3} label="Citation Gate" desc="Verifying quotes" status="process" />
          <AntdStep num={4} label="Synthesize" desc="LLM Analyst Brief" status="wait" />
        </div>

        {/* Action controls */}
        <div className="flex gap-2">
          <button className="bg-stone-900 text-white font-mono text-xs px-4 py-2 rounded shadow-sm hover:bg-stone-800 transition-all flex items-center gap-1.5">
            <Play size={12} fill="white" />
            Ingest Next
          </button>
        </div>
      </div>
    </div>
  );
}

function AntdStep({ num, label, desc, status }: { num: number; label: string; desc: string; status: "finish" | "process" | "wait" }) {
  return (
    <div className="flex-1 flex gap-3 items-start">
      <div className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 text-xs font-bold ${
        status === "finish"
          ? "bg-emerald-50 border-emerald-300 text-emerald-700"
          : status === "process"
          ? "bg-teal-50 border-teal-300 text-teal-700 animate-pulse"
          : "bg-stone-50 border-stone-200 text-stone-400"
      }`}>
        {status === "finish" ? "✓" : num}
      </div>
      <div>
        <span className={`text-xs font-bold block ${status === "wait" ? "text-stone-400" : "text-stone-800"}`}>
          {label}
        </span>
        <span className="text-[10px] text-stone-500 block leading-tight">{desc}</span>
      </div>
    </div>
  );
}
