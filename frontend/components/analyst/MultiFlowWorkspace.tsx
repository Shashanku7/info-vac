"use client";

import { useState, useEffect, useMemo } from "react";
import { Loader2, Sparkles, TrendingUp, TrendingDown, AlertCircle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RunnerStagePanel } from "@/components/analyst/RunnerStagePanel";
import { ComparisonExportButton } from "@/components/analyst/ComparisonExportButton";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { getExtractedFields, getProgramSources, sendComparisonChatMessage, getComparisonChatHistory } from "@/lib/api";
import { parseNarrative, splitNarrativeSegments, buildReferencesFromFields } from "@/lib/narrative";
import { CitationBadge } from "./CitationBadge";
import { ProgressCardLoader } from "./ProgressCardLoader";
import { ChatWidget } from "./ChatWidget";
import type { Comparison, ExtractedField, ChatMessage } from "@/types/api";

// ── Comparison Results ───────────────────────────────────────────────────────
function ComparisonResults({ result }: { result: Comparison }) {
  const programNames = result.analysis.matrix[0]?.rankings || [];
  const [comparedData, setComparedData] = useState<Array<{
    id: string;
    fields: ExtractedField[];
    sources: any[];
  }>>([]);
  const [fetchingData, setFetchingData] = useState(false);
  const [drawerUrl, setDrawerUrl] = useState<string | null>(null);

  // Comparison Chat States
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Load chat history when comparison result changes
  useEffect(() => {
    if (result?.comparison_id) {
      setChatMessages([]);
      getComparisonChatHistory(result.comparison_id)
        .then((hist) => {
          if (hist?.messages) setChatMessages(hist.messages);
        })
        .catch(() => {});
    }
  }, [result?.comparison_id]);

  const sendComparisonMessage = async (msg: string) => {
    if (!result?.comparison_id) return;
    const userMsg: ChatMessage = {
      role: "user",
      content: msg,
      created_at: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setIsChatLoading(true);
    try {
      const resp = await sendComparisonChatMessage(result.comparison_id, msg);
      const botMsg: ChatMessage = {
        role: "assistant",
        content: resp.reply,
        created_at: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      const errMsg: ChatMessage = {
        role: "assistant",
        content: `⚠️ Failed to send message.`,
        created_at: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsChatLoading(false);
    }
  };

  useEffect(() => {
    if (result) {
      setFetchingData(true);
      const pids = result.program_ids || [];
      Promise.all(
        pids.map(async (pid) => {
          const [fields, sources] = await Promise.all([
            getExtractedFields(pid),
            getProgramSources(pid),
          ]);
          return { id: pid, fields, sources };
        })
      )
        .then((data) => {
          setComparedData(data);
          setFetchingData(false);
        })
        .catch((err) => {
          console.error("Failed to fetch compared data:", err);
          setFetchingData(false);
        });
    } else {
      setComparedData([]);
    }
  }, [result]);

  const allFields = useMemo(() => {
    return comparedData.flatMap((p) => p.fields);
  }, [comparedData]);

  const combinedText = useMemo(() => {
    return [
      result.analysis.executive_summary,
      ...result.analysis.matrix.map((m: any) => m.rationale),
      result.analysis.strategic_recommendations,
    ].join("\n\n");
  }, [result]);

  const { urlMap, references } = useMemo(() => {
    return buildReferencesFromFields(allFields);
  }, [allFields]);

  const drawerField = useMemo(() => {
    if (!drawerUrl) return null;
    return allFields.find(
      (f) => f.source_url === drawerUrl && f.claimed_snippet != null && f.claimed_snippet.length > 0
    ) ?? null;
  }, [drawerUrl, allFields]);

  function renderComparisonParagraphs(text: string) {
    const paragraphs = text.split(/\n{2,}/);
    return paragraphs.map((para, i) => {
      const trimmed = para.trim().replace(/\[[a-zA-Z0-9_]+\]/g, "").replace(/\s{2,}/g, " ");
      if (!trimmed) return null;

      const segments = splitNarrativeSegments(trimmed, urlMap);
      return (
        <p key={i} className="text-xs text-stone-600 leading-[1.75] mb-3">
          {segments.map((seg, j) =>
            seg.type === "text" ? (
              <span key={j}>{seg.text}</span>
            ) : (
              <CitationBadge
                key={j}
                num={seg.num ?? 1}
                url={seg.url}
                onClick={() => seg.url && setDrawerUrl(seg.url)}
              />
            )
          )}
        </p>
      );
    });
  }

  // Loyalty parameters list for side-by-side comparison table
  const keyFieldsList = [
    { label: "Base Earn Rate", name: "base_earn_rate" },
    { label: "Minimum Redemption", name: "minimum_redemption" },
    { label: "Points Expiry Policy", name: "expiry_policy" },
    { label: "Mobile App Rating", name: "app_store_rating" },
    { label: "Loyalty Tiers Enabled", name: "has_tiers" },
  ];

  function getFieldValue(progIdx: number, fieldName: string): string {
    const field = comparedData[progIdx]?.fields.find((f) => f.field_name === fieldName);
    return field?.field_value || "—";
  }

  if (fetchingData || comparedData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3 bg-white border border-stone-200 rounded-xl max-w-4xl mx-auto shadow-sm">
        <Loader2 className="animate-spin text-[#0F766E]" size={28} strokeWidth={1.5} />
        <span className="text-sm font-semibold text-stone-700">Loading program evidence...</span>
        <span className="text-xs text-stone-400">Fetching fact-checked sources and parameter matrices</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-6">
      {/* Export Header */}
      <div className="flex items-center justify-between px-1 max-w-4xl mx-auto">
        <span className="text-[10px] text-stone-500 font-semibold uppercase tracking-wider">
          Comparative Analysis Report
        </span>
        <ComparisonExportButton comparison={result} programNames={programNames} />
      </div>

      {/* Document Sheet */}
      <div className="bg-white shadow-sm border border-stone-200 rounded-xl p-8 max-w-4xl mx-auto font-sans">
        {/* Document Header */}
        <div className="border-b border-stone-200 pb-6 mb-8 text-center sm:text-left">
          <h1 className="text-2xl font-serif font-semibold text-stone-900 tracking-tight">
            Strategic Competitive Comparison
          </h1>
          <p className="text-xs text-stone-500 font-mono mt-1">
            InfoVac Analyst Report · {programNames.join(" vs. ")} · {new Date().toLocaleDateString("en-GB")}
          </p>
        </div>

        {/* Executive Summary */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-stone-900 mb-3 tracking-wide uppercase">
            Executive Summary
          </h2>
          <div className="leading-[1.75]">
            {renderComparisonParagraphs(result.analysis.executive_summary)}
          </div>
        </div>

        {/* Market Matrix Table */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-stone-900 mb-3 tracking-wide uppercase">
            Market Matrix Comparison
          </h2>
          <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
            <table className="min-w-full divide-y divide-stone-200 text-left text-xs">
              <thead className="bg-stone-50 text-stone-700 font-semibold">
                <tr>
                  <th className="px-4 py-3 w-1/4">Category</th>
                  <th className="px-4 py-3 w-3/4">Comparative Analysis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 bg-white text-stone-600">
                {result.analysis.matrix.map((item, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-stone-50/30"}>
                    <td className="px-4 py-3 font-semibold text-stone-900 align-top w-1/4">{item.category}</td>
                    <td className="px-4 py-3 align-top leading-[1.75] w-3/4">
                      {renderComparisonParagraphs(item.rationale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Side-by-Side Parameters Table */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-stone-900 mb-3 tracking-wide uppercase">
            Side-by-Side Parameters
          </h2>
          <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
            <table className="min-w-full divide-y divide-stone-200 text-left text-xs">
              <thead className="bg-stone-50 text-stone-700 font-semibold">
                <tr>
                  <th className="px-4 py-3 w-1/4">Loyalty Parameter</th>
                  {programNames.map((name) => (
                    <th key={name} className="px-4 py-3 w-3/8">{name}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 bg-white text-stone-600">
                {keyFieldsList.map((fItem, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-stone-50/30"}>
                    <td className="px-4 py-3 font-semibold text-stone-900 align-top w-1/4">{fItem.label}</td>
                    {programNames.map((_, pIdx) => {
                      const field = comparedData[pIdx]?.fields.find((f) => f.field_name === fItem.name);
                      const val = field?.field_value || "—";
                      const num = field?.source_url ? urlMap.get(field.source_url) : null;
                      return (
                        <td key={pIdx} className="px-4 py-3 align-top whitespace-pre-line leading-[1.75] w-3/8">
                          {val}
                          {num && (
                            <CitationBadge
                              num={num}
                              url={field?.source_url}
                              onClick={() => field?.source_url && setDrawerUrl(field.source_url)}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Program Highlights - Stacked Vertically */}
        <div className="mb-8 border-t border-stone-200 pt-6">
          <h2 className="text-sm font-bold text-stone-900 mb-4 tracking-wide uppercase">
            Program Highlights
          </h2>
          <div className="space-y-4">
            {programNames.map((pName, pIdx) => (
              <div key={pIdx} className="py-4 border-b border-stone-100 last:border-0">
                <h3 className="text-xs font-bold text-stone-850 mb-2.5 tracking-wide uppercase">
                  {pName} Key Attributes
                </h3>
                <ul className="space-y-2 list-disc pl-5 text-xs text-stone-600">
                  {comparedData[pIdx]?.fields
                    .filter((f) => f.gate_passed && !f.is_null && f.field_value && f.category !== "program_basics")
                    .slice(0, 5)
                    .map((f, fi) => {
                      const num = f.source_url ? urlMap.get(f.source_url) : null;
                      return (
                        <li key={fi} className="leading-[1.75]">
                          <span className="font-semibold text-stone-700 capitalize">{f.field_name.replace(/_/g, " ")}</span>: {f.field_value}
                          {num && (
                            <CitationBadge
                              num={num}
                              url={f.source_url}
                              onClick={() => f.source_url && setDrawerUrl(f.source_url)}
                            />
                          )}
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Strategic Recommendations */}
        <div className="mb-10 bg-stone-50 border border-stone-200 rounded-xl p-6">
          <h2 className="text-sm font-bold text-stone-900 mb-3 tracking-wide uppercase flex items-center gap-1.5">
            <Sparkles size={14} className="text-[#0F766E] animate-pulse" />
            Strategic Takeaways & Recommendations
          </h2>
          <div className="leading-[1.75]">
            {renderComparisonParagraphs(result.analysis.strategic_recommendations)}
          </div>
        </div>

        {/* References Section */}
        {references.length > 0 && (
          <div id="references-section" className="mt-10 pt-6 border-t border-stone-200">
            <h2 className="text-xs font-bold text-stone-900 mb-4 uppercase tracking-wide">
              References
            </h2>
            <ol className="space-y-5 list-none">
              {references.map((ref) => {
                const displayDate = ref.accessDate ?? "—";
                return (
                  <li key={ref.url} id={`ref-${ref.num}`} className="flex items-start gap-3">
                    <span className="text-[11px] font-bold text-[#0F766E] shrink-0 mt-0.5 w-6 text-right font-mono" style={{ color: "#0F766E" }}>
                      [{ref.num}]
                    </span>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-start gap-1.5">
                        <span className="text-[11px] text-stone-500 shrink-0 font-medium w-28 uppercase" style={{ color: "#0F766E" }}>Source</span>
                        <button
                          onClick={() => setDrawerUrl(ref.url)}
                          className="text-[11px] text-[#0F766E] hover:underline text-left break-all transition-colors flex items-center gap-1 font-mono"
                          style={{ color: "#0F766E" }}
                          title="View evidence"
                        >
                          {ref.url}
                          <ExternalLink size={10} className="shrink-0 opacity-55" style={{ color: "#0F766E" }} />
                        </button>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="text-[11px] text-stone-500 shrink-0 font-medium w-28 uppercase" style={{ color: "#0F766E" }}>Evidence Quote</span>
                        <span className="text-[11px] text-stone-600 italic leading-relaxed">
                          {ref.snippet ? `"${ref.snippet}"` : "—"}
                        </span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="text-[11px] text-stone-500 shrink-0 font-medium w-28 uppercase" style={{ color: "#0F766E" }}>Access Date</span>
                        <span className="text-[11px] text-stone-600">{displayDate}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>

      {/* Evidence Drawer */}
      <EvidenceDrawer
        open={drawerUrl !== null}
        onClose={() => setDrawerUrl(null)}
        sourceUrl={drawerUrl ?? ""}
        field={drawerField}
      />

      {/* Comparative Chatbot */}
      {result?.comparison_id && (
        <ChatWidget
          programId={result.comparison_id}
          messages={chatMessages}
          isLoading={isChatLoading}
          onSend={sendComparisonMessage}
          isComparative={true}
        />
      )}
    </div>
  );
}

// ── Runner card type ─────────────────────────────────────────────────────────
export interface Runner {
  id: string;
  name: string;
  status: string;
  progress: number;
}

// ── Multi-Flow Workspace ─────────────────────────────────────────────────────
interface MultiFlowWorkspaceProps {
  runners: Runner[];
  expandedRunnerId: string | null;
  onExpandRunner: (id: string | null) => void;
  closeExpandedPanel: () => void;
  multiError: string | null;
  isComparing: boolean;
  comparisonResult: Comparison | null;
  onClearWorkspace: () => void;
}

export function MultiFlowWorkspace({
  runners,
  expandedRunnerId,
  onExpandRunner,
  closeExpandedPanel,
  multiError,
  isComparing,
  comparisonResult,
  onClearWorkspace,
}: MultiFlowWorkspaceProps) {
  const activeRunner = runners.find(r => r.id === expandedRunnerId);
  const [simulatedProgress, setSimulatedProgress] = useState(0);

  useEffect(() => {
    let interval: any = null;
    if (isComparing) {
      setSimulatedProgress(0);
      interval = setInterval(() => {
        setSimulatedProgress((prev) => {
          if (prev < 40) return prev + 2.5;
          if (prev < 70) return prev + 1.2;
          if (prev < 90) return prev + 0.6;
          if (prev < 95) return prev + 0.15;
          return prev;
        });
      }, 150);
    } else {
      setSimulatedProgress(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isComparing]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h2 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
            Comparative Pipelines ({runners.length} Selected)
          </h2>
          <p className="text-[11px] text-muted-foreground">
            InfoVac is crawling, extracting, and verifying each program before cross-analysis.
          </p>
        </div>
        <button
          onClick={onClearWorkspace}
          className="text-xs text-[#0F766E] border border-[#0F766E]/20 bg-[#0F766E]/5 hover:bg-[#0F766E]/10 px-3 h-8 rounded-md transition-all font-medium"
        >
          Clear Workspace
        </button>
      </div>

        {/* Runner status grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {runners.map((r) => {
          const isComplete = r.status === "complete";
          // Only treat as truly failed if progress is zero (never started)
          // If progress > 0, the pipeline was running — DB may have set failed prematurely
          const isFailed   = r.status === "failed" && r.progress <= 0.01;
          const isActive   = !isComplete && !isFailed;
          const isExpanded = expandedRunnerId === r.id;

          return (
            <Card
              key={r.id}
              onClick={() => onExpandRunner(isExpanded ? null : r.id)}
              className={`shadow-none bg-white relative overflow-hidden transition-all duration-200 cursor-pointer hover:border-[#0F766E]/40 hover:shadow-sm ${
                isExpanded ? "ring-1 ring-[#0F766E] border-[#0F766E]" : "border-border"
              }`}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-850 truncate pr-2">{r.name}</span>
                  <Badge
                    variant={isComplete ? "outline" : isFailed ? "destructive" : "secondary"}
                    className={`text-[10px] h-5 px-1.5 shrink-0 ${
                      isComplete ? "border-emerald-300 text-emerald-700 bg-emerald-50" : ""
                    }`}
                  >
                    {isActive && <Loader2 size={8} className="animate-spin mr-1 text-[#0F766E]" />}
                    {isActive && r.status === "failed" ? "running" : r.status}
                  </Badge>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-stone-500">
                    <span>Pipeline progress</span>
                    <span>{Math.round(r.progress * 100)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isComplete ? "bg-emerald-500" : isFailed ? "bg-red-500" : "bg-[#0F766E]"
                      }`}
                      style={{ width: `${r.progress * 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-[10px] text-stone-400 text-right">
                  {isExpanded ? "Click to collapse" : "Click to view stages"}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Expanded stage panel — memoised */}
      {expandedRunnerId && activeRunner && (
        <RunnerStagePanel
          key={expandedRunnerId}
          runnerId={activeRunner.id}
          runnerName={activeRunner.name}
          status={activeRunner.status}
          onClose={closeExpandedPanel}
        />
      )}

      {/* Error banner */}
      {multiError && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle size={14} strokeWidth={1.5} className="text-red-500" />
          <AlertDescription className="text-xs text-red-700">{multiError}</AlertDescription>
        </Alert>
      )}

      {/* Comparing progress */}
      {isComparing && (
        <ProgressCardLoader
          title="Generating comparative analysis..."
          subtitle="Synthesizing executive summary, matrix, and recommendations"
          stageName="Synthesizing matrix"
          progressPercent={simulatedProgress}
        />
      )}

      {/* Comparison results */}
      {comparisonResult && <ComparisonResults result={comparisonResult} />}
    </div>
  );
}
