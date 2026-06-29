"use client";

import { Sparkles, TrendingUp, HelpCircle } from "lucide-react";

export default function V0GlassComparison() {
  return (
    <div className="min-h-screen bg-[#fafafa] text-stone-850 p-8 font-sans antialiased">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-250 pb-4">
          <div>
            <span className="text-[10px] text-stone-400 font-mono tracking-widest uppercase block mb-1">V0 STYLE // BENTO GLASS</span>
            <h2 className="text-xl font-semibold tracking-tight text-stone-900">Bento Glass Matrices</h2>
          </div>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Bento item 1 */}
          <div className="bg-white/80 border border-stone-200/60 backdrop-blur-md rounded-2xl p-6 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-stone-500 uppercase tracking-widest">Earn Dynamics</h3>
            <p className="text-xs text-stone-650 leading-relaxed">
              Starbucks yields stars instantly per spend dollar; Delta uses flight distances and Medallion qualifiers.
            </p>
            <div className="flex gap-2 pt-2 border-t border-stone-100">
              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">🏆 Starbucks (Fast)</span>
              <span className="text-[10px] font-medium bg-stone-50 text-stone-500 px-2 py-0.5 rounded border border-stone-200">Delta (Premium)</span>
            </div>
          </div>

          {/* Bento item 2 */}
          <div className="bg-white/80 border border-stone-200/60 backdrop-blur-md rounded-2xl p-6 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-stone-500 uppercase tracking-widest">Tier Structures</h3>
            <p className="text-xs text-stone-650 leading-relaxed">
              Delta's 4-tier Medallion hierarchy offers rich lounge access, global skyteam upgrades, and status benefits.
            </p>
            <div className="flex gap-2 pt-2 border-t border-stone-100">
              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">🏆 Delta (Robust)</span>
              <span className="text-[10px] font-medium bg-stone-50 text-stone-500 px-2 py-0.5 rounded border border-stone-200">Starbucks (Flat)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
