"use client";

import { useState } from "react";
import { comparePrograms } from "@/lib/api";
import type { Comparison, Program } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        <p className="text-xs font-medium text-stone-700 mb-2">
          Select programs to compare (min. 2, must be complete)
        </p>
        <div className="flex flex-wrap gap-2">
          {completedPrograms.length === 0 ? (
            <p className="text-xs text-muted-foreground">No completed programs yet.</p>
          ) : (
            completedPrograms.map((p) => (
              <Badge
                key={p.id}
                variant={selected.includes(p.id) ? "default" : "outline"}
                className={`cursor-pointer text-xs transition-colors ${
                  selected.includes(p.id)
                    ? "bg-[#0F766E] text-white hover:bg-[#0d6b63] border-transparent"
                    : "hover:bg-stone-100"
                }`}
                onClick={() => toggle(p.id)}
              >
                {p.name}
                {selected.includes(p.id) && (
                  <X size={11} className="ml-1" strokeWidth={1.5} />
                )}
              </Badge>
            ))
          )}
        </div>
      </div>

      <Button
        onClick={runComparison}
        disabled={selected.length < 2 || loading}
        className="h-8 text-xs bg-[#0F766E] hover:bg-[#0d6b63] text-white"
        size="sm"
      >
        {loading ? (
          <><Loader2 size={12} strokeWidth={1.5} className="animate-spin mr-1.5" />Comparing…</>
        ) : (
          `Compare ${selected.length} Programs`
        )}
      </Button>

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      {/* Result matrix */}
      {result && (
        <div className="space-y-4">
          {/* Executive summary */}
          <Card className="border-border shadow-none">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-stone-700">
                Executive Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-xs text-stone-600 leading-relaxed">
                {result.analysis.executive_summary}
              </p>
            </CardContent>
          </Card>

          {/* Category matrix */}
          <ScrollArea className="max-h-[420px]">
            <div className="space-y-2">
              {result.analysis.matrix.map((item, i) => (
                <Card key={i} className="border-border shadow-none">
                  <CardContent className="px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-stone-800">
                        {item.category}
                      </span>
                      <div className="flex gap-1">
                        {item.rankings.map((name, rank) => (
                          <Badge
                            key={name}
                            variant="outline"
                            className={`text-[10px] h-5 ${
                              rank === 0
                                ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                                : "border-stone-200 text-stone-500"
                            }`}
                          >
                            {rank === 0 && (
                              <TrendingUp size={9} strokeWidth={1.5} className="mr-0.5" />
                            )}
                            {rank === item.rankings.length - 1 && item.rankings.length > 1 && (
                              <TrendingDown size={9} strokeWidth={1.5} className="mr-0.5" />
                            )}
                            {name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-stone-500 leading-relaxed">
                      {item.rationale}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>

          {/* Strategic recommendations */}
          <Card className="border-border shadow-none bg-stone-50">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-stone-700">
                Strategic Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-xs text-stone-600 leading-relaxed">
                {result.analysis.strategic_recommendations}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
