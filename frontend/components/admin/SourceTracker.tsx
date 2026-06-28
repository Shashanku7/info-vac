"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SourceEntry {
  source_type: string;
  count: number;
}

interface SourceTrackerProps {
  sources: SourceEntry[];
}

const SOURCE_COLORS: Record<string, { bar: string; dot: string }> = {
  // --- Source types (retriever) ---
  tnc:                 { bar: "bg-[#0F766E]",  dot: "bg-[#0F766E]" },
  faq:                 { bar: "bg-teal-400",   dot: "bg-teal-400" },
  homepage:            { bar: "bg-sky-400",    dot: "bg-sky-400" },
  press:               { bar: "bg-amber-400",  dot: "bg-amber-400" },
  news:                { bar: "bg-orange-400", dot: "bg-orange-400" },
  app_review:          { bar: "bg-violet-400", dot: "bg-violet-400" },
  forum:               { bar: "bg-pink-400",   dot: "bg-pink-400" },
  benefits:            { bar: "bg-emerald-400",dot: "bg-emerald-400" },
  partners:            { bar: "bg-cyan-400",   dot: "bg-cyan-400" },
  mechanics:           { bar: "bg-indigo-400", dot: "bg-indigo-400" },
  competitors:         { bar: "bg-rose-400",   dot: "bg-rose-400" },

  // --- Extraction categories (extractor) ---
  program_basics:      { bar: "bg-[#0F766E]",  dot: "bg-[#0F766E]" },
  partnerships:        { bar: "bg-sky-500",    dot: "bg-sky-500" },
  earn_mechanics:      { bar: "bg-amber-500",  dot: "bg-amber-500" },
  digital_experience:  { bar: "bg-violet-500", dot: "bg-violet-500" },
  burn_mechanics:      { bar: "bg-rose-500",   dot: "bg-rose-500" },
  member_sentiment:    { bar: "bg-pink-500",   dot: "bg-pink-500" },
  tier_system:         { bar: "bg-emerald-500",dot: "bg-emerald-500" },
  competitive_position:{ bar: "bg-orange-500", dot: "bg-orange-500" },
  meta_insights:       { bar: "bg-indigo-400", dot: "bg-indigo-400" },
};

const DEFAULT_COLORS = [
  { bar: "bg-teal-400",   dot: "bg-teal-400" },
  { bar: "bg-sky-400",    dot: "bg-sky-400" },
  { bar: "bg-amber-400",  dot: "bg-amber-400" },
  { bar: "bg-violet-400", dot: "bg-violet-400" },
  { bar: "bg-rose-400",   dot: "bg-rose-400" },
  { bar: "bg-emerald-400",dot: "bg-emerald-400" },
  { bar: "bg-orange-400", dot: "bg-orange-400" },
  { bar: "bg-pink-400",   dot: "bg-pink-400" },
  { bar: "bg-indigo-400", dot: "bg-indigo-400" },
];


export function SourceTracker({ sources }: SourceTrackerProps) {
  const total = sources.reduce((s, e) => s + e.count, 0);

  return (
    <Card className="border-border shadow-none">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          Source Distribution
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {/* Stacked bar */}
        <div className="flex h-3 rounded-full overflow-hidden gap-px">
          {sources.map((s, i) => {
            const color = SOURCE_COLORS[s.source_type] ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
            return (
              <div
                key={s.source_type}
                className={`${color.bar} transition-all`}
                style={{ width: `${(s.count / total) * 100}%` }}
                title={`${s.source_type}: ${s.count}`}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="space-y-1.5">
          {sources.map((s, i) => {
            const color = SOURCE_COLORS[s.source_type] ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
            const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
            return (
              <div key={s.source_type} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${color.dot}`} />
                  <span className="text-xs text-stone-700 capitalize">
                    {s.source_type.replace(/_/g, " ")}
                  </span>
                </div>
                <span className="text-xs tabular-nums text-stone-500">
                  {s.count}{" "}
                  <span className="text-stone-400">({pct}%)</span>
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

