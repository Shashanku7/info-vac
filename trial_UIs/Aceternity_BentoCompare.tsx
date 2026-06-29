"use client";

import { useState } from "react";
import { Sparkles, TrendingUp, TrendingDown, Layers, Zap, Info, ShieldCheck } from "lucide-react";

export default function AceternityBentoCompare() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const matrices = [
    {
      category: "Earn Mechanics",
      rankings: ["Starbucks (Fast)", "Delta (Premium)"],
      rationale: "Starbucks yields stars instantly per spend dollar; Delta uses flight distances and Medallion qualifiers.",
      color: "from-emerald-500/10 to-teal-500/10 border-emerald-500/20"
    },
    {
      category: "Tier Structure",
      rankings: ["Delta (Robust)", "Starbucks (Flat)"],
      rationale: "Delta's 4-tier Medallion hierarchy offers rich lounges, upgrades and partner integrations.",
      color: "from-blue-500/10 to-indigo-500/10 border-blue-500/20"
    },
    {
      category: "Partnerships",
      rankings: ["Delta (Global)", "Starbucks (Retail)"],
      rationale: "Delta boasts extensive skyteam alliance, hotel partners, and co-branded credit cards.",
      color: "from-purple-500/10 to-pink-500/10 border-purple-500/20"
    }
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-stone-200 p-8 font-sans antialiased relative overflow-hidden">
      {/* Glow Backdrops */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/[0.03] rounded-full blur-[120px] -z-10" />

      <div className="max-w-5xl mx-auto space-y-8">
        {/* Title */}
        <div>
          <span className="text-[10px] text-teal-400 font-mono tracking-widest uppercase block mb-1">ACETERNITY STYLE // BENTO MOCKUP</span>
          <h1 className="text-2xl font-bold text-white tracking-tight uppercase font-mono">Bento Comparison Matrix</h1>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Bento Item 1: Summary (takes 2 cols) */}
          <div className="md:col-span-2 bg-[#121214] border border-stone-800 rounded-3xl p-6 relative overflow-hidden group">
            <div className="absolute -inset-px bg-gradient-to-r from-emerald-500/10 to-teal-500/10 opacity-0 group-hover:opacity-100 transition duration-300 rounded-3xl -z-10" />
            <div className="space-y-4">
              <span className="text-[10px] font-mono text-teal-400 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles size={12} className="animate-pulse" />
                Strategic Synthesis
              </span>
              <p className="text-xs text-stone-400 leading-relaxed font-mono">
                The evaluation details contrast the high-frequency retail nature of Starbucks Rewards with the high-value retention model of Delta SkyMiles. The matrices below highlight performance across key dimensions.
              </p>
            </div>
          </div>

          {/* Bento Item 2: Quick Metrics (takes 1 col) */}
          <div className="bg-[#121214] border border-stone-800 rounded-3xl p-6 relative overflow-hidden group">
            <div className="absolute -inset-px bg-gradient-to-r from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition duration-300 rounded-3xl -z-10" />
            <div className="space-y-4 font-mono">
              <span className="text-[10px] text-stone-500 uppercase tracking-widest block">System Diagnostics</span>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-stone-500">Confidence:</span>
                  <span className="text-white font-bold">94.8%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Extracted fields:</span>
                  <span className="text-white font-bold">44/44</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bento Item 3, 4, 5: Dynamic matrices (1 col each) */}
          {matrices.map((item, index) => (
            <div
              key={index}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={`bg-[#121214] border border-stone-800 rounded-3xl p-6 transition-all duration-300 relative group h-64 flex flex-col justify-between cursor-pointer ${
                hoveredIndex === index ? "border-stone-700 -translate-y-1" : ""
              }`}
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <h3 className="text-xs font-bold font-mono text-white tracking-wide uppercase">{item.category}</h3>
                  <Badge text="Matrix Node" />
                </div>
                <p className="text-[11px] text-stone-500 leading-relaxed font-mono">{item.rationale}</p>
              </div>

              {/* Leader badges */}
              <div className="space-y-1.5 font-mono">
                {item.rankings.map((name, i) => (
                  <div key={name} className="flex items-center justify-between text-[10px] bg-stone-900/60 p-2 rounded-xl border border-stone-850">
                    <span className="text-stone-400">{name}</span>
                    <span className={i === 0 ? "text-teal-400" : "text-stone-600"}>
                      {i === 0 ? "🏆 Leader" : "2nd"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Badge({ text }: { text: string }) {
  return (
    <span className="inline-block bg-stone-900 border border-stone-800 text-stone-500 text-[9px] font-mono tracking-wider px-2 py-0.5 rounded">
      {text}
    </span>
  );
}
