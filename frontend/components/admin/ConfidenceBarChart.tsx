"use client";

import { Award } from "lucide-react";

interface ConfidenceBarChartProps {
  avgCorroboration: number;
  avgAuthority: number;
  avgRecency: number;
  avgConfidence: number;
}

export function ConfidenceBarChart({
  avgCorroboration,
  avgAuthority,
  avgRecency,
  avgConfidence,
}: ConfidenceBarChartProps) {
  const corrPct = Math.round(avgCorroboration * 100);
  const authPct = Math.round(avgAuthority * 100);
  const recPct  = Math.round(avgRecency * 100);
  const compPct = Math.round(avgConfidence * 100);

  // Determine highest/lowest parameters
  const params = [
    { name: "Corroboration", val: corrPct },
    { name: "Authority", val: authPct },
    { name: "Recency", val: recPct },
  ];
  const sorted = [...params].sort((a, b) => a.val - b.val);
  const lowest = sorted[0]?.name ?? "—";
  const highest = sorted[sorted.length - 1]?.name ?? "—";

  return (
    <div
      className="rounded-[10px] p-4 transition-all flex flex-col justify-between"
      style={{
        backgroundColor: "var(--kobie-ocean)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div>
        <div
          className="text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5"
          style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--kobie-font-heading)" }}
        >
          <Award size={12} strokeWidth={1.5} style={{ color: "#fd7f4f" }} />
          Confidence Breakdown
        </div>

        {/* Big overall confidence stat */}
        <div className="flex items-baseline gap-2 mb-3">
          <p className="text-xl font-black text-white" style={{ fontFamily: "var(--kobie-font-heading)" }}>
            {compPct}%
          </p>
          <span className="text-[9px] uppercase font-bold text-white/30 tracking-wider">
            Average Confidence
          </span>
        </div>

        {/* Horizontal parameters progress bars */}
        <div className="space-y-2">
          {/* Corroboration */}
          <div className="space-y-0.5">
            <div className="flex justify-between text-[9px] font-mono text-white/50">
              <span>Corroboration</span>
              <span>{corrPct}%</span>
            </div>
            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${corrPct}%`, backgroundColor: "#fd7f4f" }} />
            </div>
          </div>

          {/* Authority */}
          <div className="space-y-0.5">
            <div className="flex justify-between text-[9px] font-mono text-white/50">
              <span>Authority</span>
              <span>{authPct}%</span>
            </div>
            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${authPct}%`, backgroundColor: "#fd7f4f" }} />
            </div>
          </div>

          {/* Recency */}
          <div className="space-y-0.5">
            <div className="flex justify-between text-[9px] font-mono text-white/50">
              <span>Recency</span>
              <span>{recPct}%</span>
            </div>
            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${recPct}%`, backgroundColor: "#5461c9" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Q&A Insights Footer */}
      <div className="pt-2.5 mt-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-[9px] leading-relaxed text-white/45">
          Highest metric: <strong style={{ color: "#10b981" }}>{highest}</strong> <br />
          Lowest metric: <strong style={{ color: "#ef4444" }}>{lowest}</strong>
        </p>
      </div>
    </div>
  );
}
