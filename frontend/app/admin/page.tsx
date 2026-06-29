"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { RefreshCw, Activity, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CostCard } from "@/components/admin/CostCard";
import { GateDonutChart } from "@/components/admin/GateDonutChart";
import { ConfidenceBarChart } from "@/components/admin/ConfidenceBarChart";
import { SourceTracker } from "@/components/admin/SourceTracker";
import { ComparatorPicker } from "@/components/admin/ComparatorPicker";
import { FieldsGrid } from "@/components/analyst/FieldsGrid";
import { checkHealth, getProgram } from "@/lib/api";
import { API_BASE } from "@/lib/api";
import type { Program, ExtractedField } from "@/types/api";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

// ── Derived stats helpers ─────────────────────────────────────────────────────

function deriveStats(fields: ExtractedField[]) {
  const gateFields = fields.filter((f) => f.gate_passed !== null);
  const passed = gateFields.filter((f) => f.gate_passed).length;
  const failed = gateFields.filter((f) => !f.gate_passed).length;

  const confFields = fields.filter((f) => f.confidence !== null);
  const avgConf =
    confFields.length > 0
      ? confFields.reduce((s, f) => s + (f.confidence ?? 0), 0) / confFields.length
      : 0;
  const avgCorr =
    confFields.length > 0
      ? confFields.reduce((s, f) => s + (f.corroboration_score ?? 0), 0) / confFields.length
      : 0;
  const avgAuth =
    confFields.length > 0
      ? confFields.reduce((s, f) => s + (f.authority_score ?? 0), 0) / confFields.length
      : 0;
  const avgRec =
    confFields.length > 0
      ? confFields.reduce((s, f) => s + (f.recency_score ?? 0), 0) / confFields.length
      : 0;

  return { passed, failed, avgConf, avgCorr, avgAuth, avgRec };
}

// ── Placeholder: fetch all programs (replace with real endpoint when available)

async function fetchPrograms(): Promise<Program[]> {
  try {
    const res = await fetch(`${API_BASE}/api/programs`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function fetchAllFields(): Promise<ExtractedField[]> {
  try {
    const res = await fetch(`${API_BASE}/api/fields`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

// ── Admin Page ────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [fields, setFields] = useState<ExtractedField[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [progs, flds, ok] = await Promise.all([
      fetchPrograms(),
      fetchAllFields(),
      checkHealth(),
    ]);
    setPrograms(progs);
    setFields(flds);
    setHealthy(ok);
    // Sum total_cost from all completed program records
    const cost = progs.reduce((sum, p) => sum + (p.total_cost ?? 0), 0);
    setTotalCost(cost);
    if (!ok) {
      toast.error("Backend unreachable", {
        description: `Could not reach ${API_BASE}/health`,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const stats = deriveStats(fields);
  const sourceMap = new Map<string, number>();
  fields.forEach((f) => {
    if (f.category) sourceMap.set(f.category, (sourceMap.get(f.category) ?? 0) + 1);
  });
  const sourceEntries = Array.from(sourceMap.entries()).map(([source_type, count]) => ({
    source_type,
    count,
  }));

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      <Toaster position="bottom-right" />

      {/* Nav */}
      <header className="border-b border-border bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-stone-900 tracking-tight">InfoVac</span>
            <span className="text-xs text-muted-foreground">Admin Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Health dot */}
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  healthy === null
                    ? "bg-stone-300"
                    : healthy
                    ? "bg-[#16A34A]"
                    : "bg-red-500"
                }`}
              />
              <span className="text-xs text-muted-foreground">
                {healthy === null ? "Checking…" : healthy ? "Backend online" : "Backend offline"}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={loading}
              className="h-8 text-xs gap-1.5 border-border"
            >
              {loading ? (
                <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
              ) : (
                <RefreshCw size={12} strokeWidth={1.5} />
              )}
              Refresh
            </Button>

            <Link
              href="/"
              className="text-xs text-muted-foreground hover:text-stone-800 transition-colors"
            >
              ← Analyst Workspace
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Metric cards row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <CostCard totalCost={totalCost} programCount={programs.length} />
          <GateDonutChart passed={stats.passed} failed={stats.failed} />
          <ConfidenceBarChart
            avgCorroboration={stats.avgCorr}
            avgAuthority={stats.avgAuth}
            avgRecency={stats.avgRec}
            avgConfidence={stats.avgConf}
          />
          <SourceTracker sources={sourceEntries} />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="fields">
          <TabsList className="h-8 bg-stone-100 p-0.5">
            <TabsTrigger value="fields" className="text-xs h-7 px-4 data-[state=active]:bg-white data-[state=active]:shadow-none">
              Data Grid {fields.length > 0 && `(${fields.length})`}
            </TabsTrigger>
            <TabsTrigger value="programs" className="text-xs h-7 px-4 data-[state=active]:bg-white data-[state=active]:shadow-none">
              Programs {programs.length > 0 && `(${programs.length})`}
            </TabsTrigger>
            <TabsTrigger value="compare" className="text-xs h-7 px-4 data-[state=active]:bg-white data-[state=active]:shadow-none">
              Comparator
            </TabsTrigger>
          </TabsList>

          {/* 43-field data grid */}
          <TabsContent value="fields" className="mt-4">
            <div className="bg-white border border-border rounded-lg p-4">
              {fields.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-10">
                  No field data available. Requires{" "}
                  <code className="text-xs bg-stone-100 px-1 rounded">GET /api/fields</code> endpoint.
                </p>
              ) : (
                <FieldsGrid fields={fields} />
              )}
            </div>
          </TabsContent>

          {/* Programs queue */}
          <TabsContent value="programs" className="mt-4">
            <div className="bg-white border border-border rounded-lg divide-y divide-border">
              {programs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-10">
                  No programs found. Requires{" "}
                  <code className="text-xs bg-stone-100 px-1 rounded">GET /api/programs</code> endpoint.
                </p>
              ) : (
                programs.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-xs font-medium text-stone-800">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{p.id}</p>
                    </div>
                    <Badge
                      variant={p.status === "complete" ? "outline" : p.status === "failed" ? "destructive" : "secondary"}
                      className={`text-[10px] h-5 ${
                        p.status === "complete"
                          ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                          : ""
                      }`}
                    >
                      {p.status}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* Comparator */}
          <TabsContent value="compare" className="mt-4">
            <div className="bg-white border border-border rounded-lg p-4">
              <ComparatorPicker programs={programs} />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
