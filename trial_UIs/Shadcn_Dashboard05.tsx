"use client";

import { useState } from "react";
import { Sparkles, FileText, CheckCircle2, ChevronRight, HelpCircle } from "lucide-react";

export default function ShadcnDashboard05() {
  const [selectedTarget, setSelectedTarget] = useState("starbucks");

  return (
    <div className="min-h-screen bg-[#fafafa] text-stone-850 p-8 font-sans antialiased">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 pb-4">
          <div>
            <span className="text-[10px] text-stone-400 font-mono tracking-widest uppercase block mb-1">SHADCN BLOCKS // DASHBOARD_05</span>
            <h1 className="text-lg font-semibold text-stone-900">Analyst Synthesis Center</h1>
          </div>
        </div>

        {/* Dashboard 05 Layout Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Target List Column (left, 1 col) */}
          <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-4 space-y-4">
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest">Completed Runs</h3>
            <div className="space-y-2">
              <ListTargetButton
                name="Starbucks Rewards"
                active={selectedTarget === "starbucks"}
                onClick={() => setSelectedTarget("starbucks")}
              />
              <ListTargetButton
                name="Delta SkyMiles"
                active={selectedTarget === "delta"}
                onClick={() => setSelectedTarget("delta")}
              />
            </div>
          </div>

          {/* Details Tabs Panel (right, 2 cols) */}
          <div className="md:col-span-2 bg-white border border-stone-200 rounded-xl shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-sm font-semibold text-stone-900 uppercase tracking-wide">
                {selectedTarget === "starbucks" ? "Starbucks Rewards Brief" : "Delta SkyMiles Brief"}
              </h3>
              <span className="text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-0.5 rounded-full font-medium">
                Verified
              </span>
            </div>

            {selectedTarget === "starbucks" ? (
              <div className="space-y-4 text-xs text-stone-600 leading-relaxed">
                <p>
                  Starbucks Rewards operates a frequency-based retail loyalty system. The model uses points (Stars) earned per dollar to drive purchase frequency.
                </p>
                <div className="grid grid-cols-2 gap-4 border-t border-stone-50 pt-4 font-mono text-[11px]">
                  <div>
                    <span className="text-[10px] text-stone-400 block uppercase">Base Earn Rate</span>
                    <span className="text-stone-800 font-semibold">1-2 stars per $1</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 block uppercase">Expiry Policy</span>
                    <span className="text-stone-800 font-semibold">6 months</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs text-stone-600 leading-relaxed">
                <p>
                  Delta SkyMiles is a travel elite loyalty system. It focuses on premium tier benefits (Medallion levels) to incentivize high-value spend.
                </p>
                <div className="grid grid-cols-2 gap-4 border-t border-stone-50 pt-4 font-mono text-[11px]">
                  <div>
                    <span className="text-[10px] text-stone-400 block uppercase">Base Earn Rate</span>
                    <span className="text-stone-800 font-semibold">1 mile per $1</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 block uppercase">Expiry Policy</span>
                    <span className="text-stone-800 font-semibold">Never expires</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ListTargetButton({ name, active, onClick }: { name: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between p-3 rounded-lg border text-left text-xs transition-all ${
        active
          ? "bg-stone-50 border-stone-300 font-semibold text-stone-900"
          : "bg-white border-stone-200/60 text-stone-600 hover:bg-stone-50/50"
      }`}
    >
      <span>{name}</span>
      <ChevronRight size={12} className={active ? "text-stone-800" : "text-stone-400"} />
    </button>
  );
}
