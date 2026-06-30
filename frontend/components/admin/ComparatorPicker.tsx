"use client";

import { useState } from "react";
import { comparePrograms } from "@/lib/api";
import type { Comparison, Program } from "@/types/api";
import { X, Loader2, TrendingUp, TrendingDown, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ComparatorPickerProps {
  programs: Program[];
}

export function ComparatorPicker({ programs }: ComparatorPickerProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Comparison | null>(null);
  const [error, setError] = useState<string | null>(null);

  const completedPrograms = programs.filter((p) => p.status === "complete");

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function runComparison() {
    if (selected.length < 2) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const comp = await comparePrograms(selected);
      setResult(comp);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comparison failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Program selector */}
      <div>
        <p className="text-xs font-semibold mb-2" style={{ color: "rgba(255,255,255,0.45)" }}>
          Select programs to compare (min. 2, must be complete)
        </p>
        <div className="flex flex-wrap gap-2">
          {completedPrograms.length === 0 ? (
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>No completed programs yet.</p>
          ) : (
            completedPrograms.map((p) => {
              const isSelected = selected.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  className="text-xs font-semibold px-2 py-1 rounded-[4px] border transition-all cursor-pointer inline-flex items-center gap-1"
                  style={{
                    backgroundColor: isSelected ? "#fd7f4f" : "rgba(255,255,255,0.04)",
                    color: isSelected ? "#fff" : "rgba(255,255,255,0.65)",
                    borderColor: isSelected ? "transparent" : "rgba(255,255,255,0.12)",
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) e.currentTarget.style.borderColor = "rgba(253,127,79,0.35)";
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                  }}
                >
                  {p.name}
                  {isSelected && (
                    <X size={11} strokeWidth={2} />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      <button
        onClick={runComparison}
        disabled={selected.length < 2 || loading}
        className="flex items-center justify-center gap-1.5 h-8 px-4 text-xs font-bold transition-all rounded-[3px] disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
        style={{
          fontFamily: "var(--kobie-font-heading)",
          backgroundColor: "#fd7f4f",
          color: "#fff",
          border: "none",
        }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#f56d38")}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#fd7f4f")}
      >
        {loading ? (
          <><Loader2 size={12} strokeWidth={1.5} className="animate-spin mr-1" />Comparing…</>
        ) : (
          `Compare ${selected.length} Programs`
        )}
      </button>

      {error && (
        <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>
      )}

      {/* Result matrix */}
      {result && (
        <div className="space-y-4">
          {/* Executive summary */}
          <div className="rounded-[10px] p-4 space-y-2.5" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="kobie-overline" style={{ fontSize: "10px", marginBottom: 0 }}>Executive Summary</span>
            <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
              {result.analysis.executive_summary}
            </p>
          </div>

          {/* Category matrix */}
          <ScrollArea className="max-h-[420px]">
            <div className="space-y-2 pr-1">
              {result.analysis.matrix.map((item, i) => (
                <div
                  key={i}
                  className="rounded-[10px] p-4 space-y-2"
                  style={{ backgroundColor: "var(--kobie-ocean)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white" style={{ fontFamily: "var(--kobie-font-heading)" }}>
                      {item.category}
                    </span>
                    <div className="flex gap-1">
                      {item.rankings.map((name, rank) => {
                        const isFirst = rank === 0;
                        const isLast = rank === item.rankings.length - 1 && item.rankings.length > 1;
                        return (
                          <span
                            key={name}
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-[4px] inline-flex items-center border"
                            style={{
                              backgroundColor: isFirst ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.04)",
                              color: isFirst ? "#10b981" : "rgba(255,255,255,0.5)",
                              borderColor: isFirst ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.12)"
                            }}
                          >
                            {isFirst && (
                              <TrendingUp size={9} strokeWidth={1.5} className="mr-0.5" />
                            )}
                            {isLast && (
                              <TrendingDown size={9} strokeWidth={1.5} className="mr-0.5" />
                            )}
                            {name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                    {item.rationale}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Strategic recommendations */}
          <div className="rounded-[10px] p-4 space-y-2.5" style={{ backgroundColor: "var(--kobie-ocean)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <h4 className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--kobie-font-heading)" }}>
              <Sparkles size={12} style={{ color: "#fd7f4f" }} />
              Strategic Recommendations
            </h4>
            <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
              {result.analysis.strategic_recommendations}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
