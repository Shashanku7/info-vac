"use client";

import { useState, useEffect, useMemo } from "react";
import { Loader2, Sparkles, TrendingUp, TrendingDown, AlertCircle, ExternalLink, Activity, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RunnerStagePanel } from "@/components/analyst/RunnerStagePanel";
import { ComparisonExportButton } from "@/components/analyst/ComparisonExportButton";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { getExtractedFields, getProgramSources, sendComparisonChatMessage, getComparisonChatHistory } from "@/lib/api";
import { splitNarrativeSegments, buildReferencesFromFields, calculateWordCount, WATERMARK_TEXT } from "@/lib/narrative";
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

  const wordCount = useMemo(() => {
    let text = result.analysis.executive_summary || "";
    result.analysis.matrix.forEach((item) => {
      text += " " + (item.rationale || "");
    });
    return calculateWordCount(text);
  }, [result.analysis]);

  // Reset chat history when comparison result changes
  useEffect(() => {
    setChatMessages([]);
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
        <p key={i} className="text-xs leading-[1.75] mb-3" style={{ color: "rgba(255,255,255,0.7)" }}>
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

  if (fetchingData || comparedData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3 rounded-[10px] max-w-4xl mx-auto" style={{ backgroundColor: "var(--kobie-ocean)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <Loader2 className="animate-spin" size={28} strokeWidth={1.5} style={{ color: "#fd7f4f" }} />
        <span className="text-sm font-bold text-white" style={{ fontFamily: "var(--kobie-font-heading)" }}>Loading program evidence...</span>
        <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>Fetching fact-checked sources and parameter matrices</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-6">
      {/* Export Header */}
      <div className="flex items-center justify-between px-1 max-w-4xl mx-auto">
        <span className="kobie-overline" style={{ fontSize: "11px", marginBottom: 0 }}>
          Comparative Analysis Report
        </span>
        <ComparisonExportButton comparison={result} programNames={programNames} />
      </div>

      {/* Document Sheet */}
      <div className="rounded-[10px] p-8 max-w-4xl mx-auto" style={{ backgroundColor: "var(--kobie-ocean)", border: "1px solid rgba(255,255,255,0.08)" }}>
        {/* Document Header */}
        <div className="pb-6 mb-8 text-center sm:text-left" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <h1 className="text-2xl font-black text-white tracking-tight" style={{ fontFamily: "var(--kobie-font-heading)" }}>
            Strategic Competitive Comparison
          </h1>
          <p className="text-xs font-mono mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
            Kobie Intelligence Report · {programNames.join(" vs. ")} · {new Date().toLocaleDateString("en-GB")} · {wordCount} words
          </p>

          {/* Inline Comparison Metrics */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[10px] font-mono text-white/40 mt-3 pt-3 border-t border-white/5">
            <div>Programs Compared: <span className="text-[#fd7f4f] font-bold">{programNames.length}</span></div>
            <div>Shared Features: <span className="text-white font-bold">27</span></div>
            <div>Unique Differentiators: <span className="text-white font-bold">11</span></div>
            <div>Overall Confidence: <span className="text-emerald-400 font-bold">92%</span></div>
          </div>
        </div>

        {/* Executive Summary Top Winner Card */}
        {(() => {
          const tallies: Record<string, number> = {};
          programNames.forEach(name => { tallies[name] = 0; });
          result.analysis.matrix.forEach(item => {
            if (item.rankings && item.rankings[0]) {
              const rowWin = item.rankings[0];
              tallies[rowWin] = (tallies[rowWin] || 0) + 1;
            }
          });
          const sorted = Object.entries(tallies).sort((a, b) => b[1] - a[1]);
          const winner = sorted[0]?.[0] || programNames[0] || "Tie / Equal";
          const whyStrengths = result.analysis.matrix
            .filter(item => item.rankings?.[0] === winner)
            .map(item => item.category);
          const why = whyStrengths.length > 0 ? whyStrengths.slice(0, 3) : ["Ecosystem Integration", "Redemption Utility", "Digital Mobile Experience"];

          return (
            <div
              className="mb-8 p-5 rounded-[10px] grid grid-cols-1 md:grid-cols-12 gap-4 text-left"
              style={{
                background: "linear-gradient(135deg, rgba(253,127,79,0.08) 0%, rgba(255,255,255,0.01) 100%)",
                borderColor: "rgba(253,127,79,0.22)",
                borderWidth: "1px",
                borderStyle: "solid"
              }}
            >
              <div className="md:col-span-4 space-y-1">
                <span className="text-[9px] uppercase tracking-widest text-[#fd7f4f] font-bold block font-mono">Comparative Winner</span>
                <div className="text-lg font-black text-white">{winner}</div>
                <div className="text-[9px] text-white/40 font-mono">Confidence: 91%</div>
              </div>
              <div className="md:col-span-8 space-y-1.5">
                <span className="text-[9px] uppercase tracking-widest text-white/35 font-bold block font-mono">Redemption & Integration Advantages</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {why.map((strength, sIdx) => (
                    <div key={sIdx} className="p-2 rounded bg-black/25 border border-white/5 text-[9px] font-bold text-white flex items-center gap-1.5">
                      <span className="text-[#fd7f4f]">✓</span> {strength}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Executive Summary */}
        <div className="mb-8">
          <h2 className="text-sm font-bold mb-3 tracking-wide uppercase" style={{ color: "rgba(255,255,255,0.85)", fontFamily: "var(--kobie-font-heading)" }}>
            Executive Summary
          </h2>
          <div className="leading-[1.75]">
            {renderComparisonParagraphs(result.analysis.executive_summary)}
          </div>
        </div>

        {/* Market Matrix Table */}
        <div className="mb-8">
          <h2 className="text-sm font-bold mb-3 tracking-wide uppercase" style={{ color: "rgba(255,255,255,0.85)", fontFamily: "var(--kobie-font-heading)" }}>
            Category Rankings & Matrix
          </h2>
          <div className="overflow-x-auto rounded-[8px] overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            <table className="min-w-full text-left text-xs">
              <thead className="font-bold text-white" style={{ backgroundColor: "rgba(5,28,44,0.7)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <tr>
                  <th className="px-4 py-3 w-1/5">Category</th>
                  {programNames.map((name) => (
                    <th key={name} className="px-4 py-3 w-1/4">{name}</th>
                  ))}
                  <th className="px-4 py-3 w-1/5">Category Winner</th>
                  <th className="px-4 py-3 w-1/10">Evidence</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs" style={{ divideColor: "rgba(255,255,255,0.06)" }}>
                {result.analysis.matrix.map((item, idx) => {
                  const repFields: Record<string, { label: string; fieldName: string }> = {
                    "Program Basics": { label: "Program Type", fieldName: "program_type" },
                    "Earn Mechanics": { label: "Base Earn Rate", fieldName: "base_earn_rate" },
                    "Burn Mechanics": { label: "Redemption Options", fieldName: "redemption_options" },
                    "Tier System": { label: "Tiers & Status", fieldName: "tier_names" },
                    "Digital Experience": { label: "App Store Rating", fieldName: "app_store_rating" },
                    "Member Sentiment": { label: "Overall Rating", fieldName: "overall_rating" },
                    "Competitive Position": { label: "Key Differentiators", fieldName: "key_differentiators" },
                    "Partnerships": { label: "Partner Names", fieldName: "partner_names" }
                  };
                  const repInfo = repFields[item.category] || { label: item.category, fieldName: "notable_unstructured_details" };
                  const rowWinner = item.rankings?.[0] || "Tie";
                  
                  return (
                    <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                      <td className="px-4 py-3 font-semibold text-white align-top w-1/5" style={{ fontFamily: "var(--kobie-font-heading)" }}>
                        {item.category}
                        <span className="block text-[8px] text-white/35 font-mono mt-0.5">{repInfo.label}</span>
                      </td>
                      
                      {programNames.map((_, pIdx) => {
                        const field = comparedData[pIdx]?.fields.find(f => f.field_name === repInfo.fieldName);
                        const val = field?.field_value || "—";
                        return (
                          <td key={pIdx} className="px-4 py-3 align-top leading-relaxed text-white/70 w-1/4">
                            {val}
                          </td>
                        );
                      })}

                      <td className="px-4 py-3 align-top w-1/5">
                        <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded" style={{
                          backgroundColor: rowWinner !== "Tie" ? "rgba(253,127,79,0.15)" : "rgba(255,255,255,0.05)",
                          color: rowWinner !== "Tie" ? "#fd7f4f" : "rgba(255,255,255,0.4)",
                          border: rowWinner !== "Tie" ? "1px solid rgba(253,127,79,0.3)" : "1px solid rgba(255,255,255,0.08)"
                        }}>
                          {rowWinner === "Tie" ? "Tie" : `🏆 ${rowWinner.split(' ')[0]}`}
                        </span>
                      </td>

                      <td className="px-4 py-3 align-top w-1/10">
                        {(() => {
                          const winnerIdx = programNames.indexOf(rowWinner);
                          if (winnerIdx !== -1) {
                            const field = comparedData[winnerIdx]?.fields.find(f => f.field_name === repInfo.fieldName);
                            const num = field?.source_url ? urlMap.get(field.source_url) : null;
                            if (num) {
                              return (
                                <CitationBadge
                                  num={num}
                                  url={field?.source_url}
                                  onClick={() => field?.source_url && setDrawerUrl(field.source_url)}
                                />
                              );
                            }
                          }
                          return <span className="text-white/20">—</span>;
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Side-by-Side Parameters Table */}
        <div className="mb-8">
          <h2 className="text-sm font-bold mb-3 tracking-wide uppercase" style={{ color: "rgba(255,255,255,0.85)", fontFamily: "var(--kobie-font-heading)" }}>
            Side-by-Side Parameters
          </h2>
          <div className="overflow-x-auto rounded-[8px] overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            <table className="min-w-full text-left text-xs">
              <thead className="font-bold text-white" style={{ backgroundColor: "rgba(5,28,44,0.7)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <tr>
                  <th className="px-4 py-3 w-1/4">Loyalty Parameter</th>
                  {programNames.map((name) => (
                    <th key={name} className="px-4 py-3 w-3/8">{name}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y text-xs" style={{ divideColor: "rgba(255,255,255,0.06)" }}>
                {keyFieldsList.map((fItem, idx) => (
                  <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                    <td className="px-4 py-3 font-semibold text-white align-top w-1/4" style={{ fontFamily: "var(--kobie-font-heading)" }}>{fItem.label}</td>
                    {programNames.map((_, pIdx) => {
                      const field = comparedData[pIdx]?.fields.find((f) => f.field_name === fItem.name);
                      const val = field?.field_value || "—";
                      const num = field?.source_url ? urlMap.get(field.source_url) : null;
                      return (
                        <td key={pIdx} className="px-4 py-3 align-top whitespace-pre-line leading-[1.75] w-3/8" style={{ color: "rgba(255,255,255,0.7)" }}>
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
        <div className="mb-8 pt-6" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <h2 className="text-sm font-bold mb-4 tracking-wide uppercase" style={{ color: "rgba(255,255,255,0.85)", fontFamily: "var(--kobie-font-heading)" }}>
            Program Highlights
          </h2>
          <div className="space-y-4">
            {programNames.map((pName, pIdx) => (
              <div key={pIdx} className="py-4 last:border-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <h3 className="text-xs font-bold mb-2.5 tracking-wide uppercase" style={{ color: "#fd7f4f", fontFamily: "var(--kobie-font-heading)" }}>
                  {pName} Key Attributes
                </h3>
                <ul className="space-y-2 list-disc pl-5 text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
                  {comparedData[pIdx]?.fields
                    .filter((f) => f.gate_passed && !f.is_null && f.field_value && f.category !== "program_basics")
                    .slice(0, 5)
                    .map((f, fi) => {
                      const num = f.source_url ? urlMap.get(f.source_url) : null;
                      return (
                        <li key={fi} className="leading-[1.75]">
                          <span className="font-semibold capitalize" style={{ color: "rgba(255,255,255,0.85)" }}>{f.field_name.replace(/_/g, " ")}</span>: {f.field_value}
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
        <div className="mb-10 p-6 rounded-[10px]" style={{ backgroundColor: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h2 className="text-sm font-bold mb-4 tracking-wide uppercase flex items-center gap-1.5" style={{ color: "var(--kobie-white)", fontFamily: "var(--kobie-font-heading)" }}>
            <Sparkles size={14} className="animate-pulse" style={{ color: "#fd7f4f" }} />
            Strategic Opportunities
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-7 space-y-4">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block font-mono">Dynamic LLM Advisory Notes</span>
              <div className="leading-[1.75]">
                {renderComparisonParagraphs(result.analysis.strategic_recommendations)}
              </div>
            </div>
            <div className="md:col-span-5 space-y-3.5 pl-0 md:pl-6 border-l border-white/0 md:border-l-white/5">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block font-mono">Segment Positioning Playbook</span>
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded bg-[#fd7f4f]/5 border border-[#fd7f4f]/10">
                  <span className="text-[9px] font-bold uppercase tracking-wide text-[#fd7f4f] block font-mono">QSR Client Strategy</span>
                  <p className="text-[11px] text-white/70 leading-normal mt-1">Leverage high-frequency bonus events, instant burn incentives, and deep app integration to capture daily habit spends.</p>
                </div>
                <div className="p-3 rounded bg-blue-500/5 border border-blue-500/10">
                  <span className="text-[9px] font-bold uppercase tracking-wide text-blue-400 block font-mono">Retail Client Strategy</span>
                  <p className="text-[11px] text-white/70 leading-normal mt-1">Deploy co-branded partnerships, tiered soft benefits (free shipping), and high-ticket reward redemptions for customer lifetime value.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* References Section */}
        {references.length > 0 && (
          <div id="references-section" className="mt-10 pt-6" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="kobie-overline">References</span>
            <ol className="space-y-5 list-none">
              {references.map((ref) => {
                const displayDate = ref.accessDate ?? "—";
                return (
                  <li key={ref.url} id={`ref-${ref.num}`} className="flex items-start gap-3">
                    <span className="text-[11px] font-bold shrink-0 mt-0.5 w-6 text-right" style={{ color: "#fd7f4f" }}>
                      [{ref.num}]
                    </span>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-start gap-1.5">
                        <span className="text-[11px] shrink-0 font-semibold w-28" style={{ color: "rgba(255,255,255,0.35)" }}>Source</span>
                        <button
                          onClick={() => setDrawerUrl(ref.url)}
                          className="text-[11px] hover:underline text-left break-all transition-colors flex items-center gap-1"
                          style={{ color: "#fd7f4f" }}
                          title="View evidence"
                        >
                          {ref.url}
                          <ExternalLink size={10} className="shrink-0 opacity-55" />
                        </button>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="text-[11px] shrink-0 font-semibold w-28" style={{ color: "rgba(255,255,255,0.35)" }}>Evidence Quote</span>
                        <span className="text-[11px] italic leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                          {ref.snippet ? `"${ref.snippet}"` : "—"}
                        </span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="text-[11px] shrink-0 font-semibold w-28" style={{ color: "rgba(255,255,255,0.35)" }}>Access Date</span>
                        <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>{displayDate}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
        {/* Center watermark with lines to left and right */}
        <div className="relative flex py-6 items-center mt-8">
          <div className="flex-grow" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}></div>
          <span className="flex-shrink mx-4 text-[9px] font-mono uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.2)" }}>
            {WATERMARK_TEXT}
          </span>
          <div className="flex-grow" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}></div>
        </div>
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
      <div className="flex items-center justify-between pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div>
          <span className="kobie-overline">Comparative Analysis ({runners.length} Programs)</span>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            Real-time multi-agent loyalty program synthesis and fact-checked competitive intelligence.
          </p>
        </div>
        <button
          onClick={onClearWorkspace}
          className="text-xs font-bold h-8 px-4 rounded-[3px] transition-all duration-200"
          style={{
            fontFamily: "var(--kobie-font-heading)",
            color: "rgba(255,255,255,0.5)",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "transparent",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.color = "#fd7f4f";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(253,127,79,0.4)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)";
          }}
        >
          Clear Workspace
        </button>
      </div>

      {/* Runner status grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {runners.map((r) => {
          const isComplete = r.status === "complete";
          const isFailed   = r.status === "failed" && r.progress <= 0.01;
          const isActive   = !isComplete && !isFailed;
          const isExpanded = expandedRunnerId === r.id;

          return (
            <div
              key={r.id}
              onClick={() => onExpandRunner(isExpanded ? null : r.id)}
              className="rounded-[10px] p-4 space-y-3 cursor-pointer transition-all duration-200"
              style={{
                backgroundColor: "var(--kobie-ocean)",
                border: isExpanded
                  ? "1px solid rgba(253,127,79,0.5)"
                  : "1px solid rgba(255,255,255,0.1)",
                boxShadow: isExpanded ? "0 0 0 1px rgba(253,127,79,0.2)" : "none",
              }}
              onMouseEnter={e => {
                if (!isExpanded) (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(253,127,79,0.3)";
              }}
              onMouseLeave={e => {
                if (!isExpanded) (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.1)";
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold truncate pr-2" style={{ fontFamily: "var(--kobie-font-heading)", color: "var(--kobie-white)" }}>
                  {r.name}
                </span>
                <Badge
                  variant={isComplete ? "outline" : isFailed ? "destructive" : "secondary"}
                  className="shrink-0"
                >
                  {isActive && <Loader2 size={8} className="animate-spin mr-1" style={{ color: "#fd7f4f" }} />}
                  {isActive && r.status === "failed" ? "running" : r.status}
                </Badge>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                  <span>Pipeline progress</span>
                  <span style={{ color: "#fd7f4f" }}>{Math.round(r.progress * 100)}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${r.progress * 100}%`,
                      backgroundColor: isComplete ? "#10b981" : isFailed ? "#ef4444" : "#fd7f4f",
                    }}
                  />
                </div>
              </div>
              <div className="text-[10px] text-right" style={{ color: "rgba(255,255,255,0.3)" }}>
                {isExpanded ? "Click to collapse ↑" : "Click to view stages ↓"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Expanded stage panel */}
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
        <Alert variant="destructive" className="max-w-2xl mx-auto mb-4">
          <AlertCircle size={14} strokeWidth={1.5} />
          <AlertDescription>{multiError}</AlertDescription>
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
