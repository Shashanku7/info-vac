"use client";

import { DollarSign } from "lucide-react";

interface CostCardProps {
  totalCost: number; // USD
  programCount: number;
}

export function CostCard({ totalCost, programCount }: CostCardProps) {
  const avgCost = programCount > 0 ? totalCost / programCount : 0;

  return (
    <div
      className="rounded-[10px] p-4 space-y-1.5 transition-all"
      style={{
        backgroundColor: "var(--kobie-ocean)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
        style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--kobie-font-heading)" }}
      >
        <DollarSign size={13} strokeWidth={1.5} style={{ color: "#fd7f4f" }} />
        Extraction Cost
      </div>
      <div className="space-y-1">
        <p className="text-2xl font-black text-white" style={{ fontFamily: "var(--kobie-font-heading)" }}>
          ${totalCost.toFixed(4)}
        </p>
        <p className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>
          {programCount} program{programCount !== 1 ? "s" : ""} ·{" "}
          avg ${avgCost.toFixed(4)} each
        </p>
      </div>
    </div>
  );
}
