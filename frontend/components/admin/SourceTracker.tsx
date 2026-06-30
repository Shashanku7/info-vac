"use client";

import { PieChart } from "lucide-react";

interface SourceEntry {
  source_type: string;
  count: number;
}

interface SourceTrackerProps {
  sources: SourceEntry[];
}

const SOURCE_COLORS: Record<string, string> = {
  tnc:                  "#fd7f4f",
  faq:                  "#38bdf8",
  homepage:             "rgba(255,255,255,0.45)",
  press:                "#fbbf24",
  news:                 "#f97316",
  app_review:           "#a78bfa",
  forum:                "#fb7185",
  benefits:             "#2dd4bf",
  partners:             "#34d399",
  mechanics:            "#818cf8",
  competitors:          "#f43f5e",

  program_basics:       "#fd7f4f",
  partnerships:         "#38bdf8",
  earn_mechanics:       "#fbbf24",
  digital_experience:   "#a78bfa",
  burn_mechanics:       "#f43f5e",
  member_sentiment:     "#fb7185",
  tier_system:          "#34d399",
  competitive_position: "#f97316",
  meta_insights:        "#818cf8",
};

const DEFAULT_COLORS = [
  "#2dd4bf",
  "#38bdf8",
  "#fbbf24",
  "#a78bfa",
  "#f43f5e",
  "#34d399",
  "#f97316",
  "#fb7185",
  "#818cf8",
];

export function SourceTracker({ sources }: SourceTrackerProps) {
  const total = sources.reduce((s, e) => s + e.count, 0);
  const maxCount = sources.length > 0 ? Math.max(...sources.map(s => s.count)) : 0;

  // Sort and display top 4 categories
  const sorted = [...sources].sort((a, b) => b.count - a.count).slice(0, 4);

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
          <PieChart size={12} strokeWidth={1.5} style={{ color: "#fd7f4f" }} />
          Source Distribution
        </div>

        <div className="space-y-2 mt-1">
          {sorted.map((s, i) => {
            const color = SOURCE_COLORS[s.source_type] ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
            const pct = maxCount > 0 ? (s.count / maxCount) * 100 : 0;
            const sharePct = total > 0 ? Math.round((s.count / total) * 100) : 0;
            return (
              <div key={s.source_type} className="space-y-0.5">
                <div className="flex justify-between text-[9px] font-mono text-white/60">
                  <span className="capitalize truncate max-w-[120px]">{s.source_type.replace(/_/g, " ")}</span>
                  <span>{s.count} ({sharePct}%)</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
            );
          })}

          {sources.length === 0 && (
            <p className="text-[10px] text-white/30 italic text-center py-4">No source types found.</p>
          )}
        </div>
      </div>

      <div className="pt-2 mt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-[9px] text-white/40">
          Total extracted categories: <strong className="text-white">{sources.length}</strong>
        </p>
      </div>
    </div>
  );
}
