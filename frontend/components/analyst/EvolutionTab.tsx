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
      <div className="flex flex-col items-center justify-center py-16 space-y-3 bg-white">
        <Loader2 className="animate-spin text-[#0F766E]" size={24} />
        <span className="text-xs text-stone-500 font-medium">Analyzing program evolution and changes...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="border-red-150 bg-red-50/50 my-2">
        <AlertCircle size={14} className="text-red-500" />
        <AlertDescription className="text-xs text-red-700">
          {error.includes("No extraction data") 
            ? "Run at least two analyses for this program to see the historical evolution changelog."
            : error}
        </AlertDescription>
      </Alert>
    );
  }

  if (!evolution || (evolution.changelog && evolution.changelog.length === 0)) {
    return (
      <div className="text-center py-12 space-y-2 bg-white">
        <Activity size={20} className="mx-auto text-stone-400" />
        <p className="text-xs text-stone-500 font-medium">No program changes detected yet.</p>
        <p className="text-[10px] text-stone-400 max-w-sm mx-auto">
          Evolution tracking comparison requires running a fresh analysis on this program after a period of time to spot changes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      <Card className="border-border shadow-none bg-stone-50/40">
        <CardContent className="p-5 space-y-2.5">
          <h4 className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles size={12} className="text-[#0F766E]" />
            Historical Evolution Summary
          </h4>
          <p className="text-xs text-stone-700 leading-relaxed">
            {evolution.executive_summary}
          </p>
        </CardContent>
      </Card>

      {/* Changelog Timeline */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wide px-1">
          Detailed Change Log
        </h4>
        <div className="grid grid-cols-1 gap-3">
          {evolution.changelog.map((item, i) => {
            const changeColorMap: Record<string, string> = {
              upgraded: "border-emerald-300 text-emerald-700 bg-emerald-50",
              devalued: "border-red-300 text-red-700 bg-red-50",
              altered: "border-teal-300 text-teal-700 bg-teal-50",
              none: "border-stone-200 text-stone-500 bg-stone-50",
            };

            return (
              <Card key={i} className="border-border shadow-none bg-white hover:border-[#0F766E]/20 transition-all duration-300">
                <CardContent className="p-4 space-y-3">
                  {/* Category + Type header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-stone-50 pb-2">
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-stone-800">
                        {item.field_name.replace(/_/g, " ")}
                      </span>
                      <span className="text-[9px] text-stone-400 block font-mono tracking-tight">
                        Category: {item.category}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded-md ${
                        changeColorMap[item.change_type] ?? changeColorMap.none
                      }`}
                    >
                      {item.change_type === "upgraded" && <TrendingUp size={9} className="mr-1" />}
                      {item.change_type === "devalued" && <TrendingDown size={9} className="mr-1" />}
                      {item.change_type}
                    </Badge>
                  </div>

                  {/* Old vs New values compare */}
                  <div className="flex items-center gap-2 bg-stone-50/50 p-2 rounded-md border border-stone-100/50 text-[11px]">
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] text-stone-400 block uppercase font-semibold">Old Value</span>
                      <span className="text-stone-600 truncate block font-mono">{item.old_value || "null"}</span>
                    </div>
                    <ArrowRight size={14} className="text-stone-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] text-[#0F766E] block uppercase font-semibold">New Value</span>
                      <span className="text-[#0F766E] font-semibold truncate block font-mono">{item.new_value || "null"}</span>
                    </div>
                  </div>

                  {/* Strategic Analysis */}
                  <div className="space-y-1">
                    <span className="text-[9px] text-stone-400 uppercase font-semibold">Strategic Impact</span>
                    <p className="text-xs text-stone-600 leading-relaxed">
                      {item.analysis}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
