"use client";

import { useEffect, useState } from "react";
import { Loader2, TrendingUp, TrendingDown, AlertCircle, Sparkles, ArrowRight, Activity } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { API_BASE } from "@/lib/api";
import type { Evolution } from "@/types/api";

interface EvolutionTabProps {
  programId: string;
}

export function EvolutionTab({ programId }: EvolutionTabProps) {
  const [evolution, setEvolution] = useState<Evolution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function fetchEvolution() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/programs/${programId}/evolution`);
        if (!res.ok) {
          const detail = await res.text().catch(() => "Unknown error");
          throw new Error(detail || `API ${res.status}`);
        }
        const data = await res.json();
        if (active) {
          setEvolution(data);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load evolution data.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    fetchEvolution();
    return () => {
      active = false;
    };
  }, [programId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3 rounded-[10px]" style={{ backgroundColor: "var(--kobie-ocean)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <Loader2 className="animate-spin" size={24} style={{ color: "#fd7f4f" }} />
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Analyzing program evolution and changes...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="my-2 rounded-[8px]">
        <AlertCircle size={14} />
        <AlertDescription className="text-xs">
          {error.includes("No extraction data") 
            ? "Run at least two analyses for this program to see the historical evolution changelog."
            : error}
        </AlertDescription>
      </Alert>
    );
  }

  if (!evolution || (evolution.changelog && evolution.changelog.length === 0)) {
    return (
      <div className="text-center py-12 space-y-2 rounded-[10px]" style={{ backgroundColor: "var(--kobie-ocean)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <Activity size={20} className="mx-auto" style={{ color: "rgba(255,255,255,0.3)" }} />
        <p className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>No program changes detected yet.</p>
        <p className="text-[10px] max-w-sm mx-auto" style={{ color: "rgba(255,255,255,0.35)" }}>
          Evolution tracking comparison requires running a fresh analysis on this program after a period of time to spot changes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      <div className="rounded-[10px] p-5 space-y-2.5" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <h4 className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--kobie-font-heading)" }}>
          <Sparkles size={12} style={{ color: "#fd7f4f" }} />
          Historical Evolution Summary
        </h4>
        <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
          {evolution.executive_summary}
        </p>
      </div>

      {/* Changelog Timeline */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wide px-1" style={{ color: "rgba(255,255,255,0.45)", fontFamily: "var(--kobie-font-heading)" }}>
          Detailed Change Log
        </h4>
        <div className="grid grid-cols-1 gap-3">
          {evolution.changelog.map((item, i) => {
            const changeColorStyleMap: Record<string, { bg: string; text: string; border: string }> = {
              upgraded: { bg: "rgba(16,185,129,0.12)", text: "#10b981", border: "1px solid rgba(16,185,129,0.3)" },
              devalued: { bg: "rgba(239,68,68,0.12)", text: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" },
              altered: { bg: "rgba(253,127,79,0.12)", text: "#fd7f4f", border: "1px solid rgba(253,127,79,0.3)" },
              none: { bg: "rgba(255,255,255,0.05)", text: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.12)" },
            };
            const theme = changeColorStyleMap[item.change_type] ?? changeColorStyleMap.none;

            return (
              <div
                key={i}
                className="rounded-[10px] p-4 space-y-3 transition-all duration-300"
                style={{
                  backgroundColor: "var(--kobie-ocean)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(253,127,79,0.3)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
              >
                {/* Category + Type header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="min-w-0">
                    <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.85)", fontFamily: "var(--kobie-font-heading)" }}>
                      {item.field_name.replace(/_/g, " ")}
                    </span>
                    <span className="text-[9px] block font-mono tracking-tight" style={{ color: "rgba(255,255,255,0.3)" }}>
                      Category: {item.category}
                    </span>
                  </div>
                  <span
                    className="text-[9px] uppercase font-mono px-2 py-0.5 rounded-[4px] font-bold inline-flex items-center shrink-0"
                    style={{ backgroundColor: theme.bg, color: theme.text, border: theme.border }}
                  >
                    {item.change_type === "upgraded" && <TrendingUp size={9} className="mr-1" />}
                    {item.change_type === "devalued" && <TrendingDown size={9} className="mr-1" />}
                    {item.change_type}
                  </span>
                </div>

                {/* Old vs New values compare */}
                <div className="flex items-center gap-2 p-2 rounded-[6px] text-[11px]" style={{ backgroundColor: "rgba(5,28,44,0.4)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] block uppercase font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>Old Value</span>
                    <span className="truncate block font-mono" style={{ color: "rgba(255,255,255,0.5)" }}>{item.old_value || "null"}</span>
                  </div>
                  <ArrowRight size={14} className="shrink-0" style={{ color: "#fd7f4f" }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] block uppercase font-bold" style={{ color: "#fd7f4f" }}>New Value</span>
                    <span className="font-bold truncate block font-mono" style={{ color: "#fd7f4f" }}>{item.new_value || "null"}</span>
                  </div>
                </div>

                {/* Strategic Analysis */}
                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>Strategic Impact</span>
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
                    {item.analysis}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
