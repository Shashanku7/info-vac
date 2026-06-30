"use client";

import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/lib/api";
import { parseNarrative, buildReferencesFromFields, calculateWordCount, WATERMARK_TEXT } from "@/lib/narrative";
import type { Comparison, ExtractedField } from "@/types/api";

interface LocalSource {
  id?: string;
  url: string;
  source_type?: string;
}

interface ComparisonExportButtonProps {
  comparison: Comparison;
  programNames: string[];
}

export function ComparisonExportButton({ comparison, programNames }: ComparisonExportButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handlePDF() {
    setLoading(true);
    try {
      const { pdf, Document, Page, Text, View, StyleSheet, Link } = await import(
        "@react-pdf/renderer"
      );

      // 1. Fetch fields and sources for all compared programs in parallel
      const programData = await Promise.all(
        comparison.program_ids.map(async (pid) => {
          const [fieldsRes, sourcesRes] = await Promise.all([
            fetch(`${API_BASE}/api/programs/${pid}/fields`),
            fetch(`${API_BASE}/api/programs/${pid}/sources`),
          ]);
          const fields: ExtractedField[] = fieldsRes.ok ? await fieldsRes.json() : [];
          const sources: LocalSource[] = sourcesRes.ok ? await sourcesRes.json() : [];
          return { id: pid, fields, sources };
        })
      );

      // Combine all fields and sources to resolve citations from either program
      const allFields = programData.flatMap((p) => p.fields);
      const allSources = programData.flatMap((p) => p.sources);

      // Map source ID to URL for reference lookup
      const url_by_source_id: Record<string, string> = {};
      allSources.forEach((src) => {
        if (src.id) url_by_source_id[String(src.id)] = src.url;
      });

      const analysis = comparison.analysis;
      const { urlMap, references } = buildReferencesFromFields(allFields);

      const wordCount = (() => {
        let text = analysis.executive_summary || "";
        analysis.matrix.forEach((item) => {
          text += " " + (item.rationale || "");
        });
        return calculateWordCount(text);
      })();

      // Helper to convert inline citations (source: URL) to [N] link nodes
      const styles = StyleSheet.create({
        page: { padding: 40, fontFamily: "Helvetica", backgroundColor: "#FAFAF9" },
        header: { marginBottom: 20, borderBottom: "1px solid #E7E5E4", paddingBottom: 10 },
        title: { fontSize: 16, fontWeight: "bold", color: "#1C1917", marginBottom: 4 },
        subtitle: { fontSize: 9, color: "#78716C" },
        sectionHeading: { fontSize: 11, fontWeight: "bold", color: "#1C1917", marginTop: 18, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
        body: { fontSize: 9, lineHeight: 1.6, color: "#1C1917" },
        bodyWrap: { marginBottom: 12 },
        citationLink: { fontSize: 8, color: "#0F766E", fontWeight: "bold" },
        
        // Table layout styles
        table: { marginTop: 10, marginBottom: 15, border: "1px solid #E7E5E4", borderRadius: 4, overflow: "hidden" },
        tableHeaderRow: { flexDirection: "row", backgroundColor: "#F5F5F4", padding: 6, borderBottom: "1px solid #E7E5E4" },
        tableRow: { flexDirection: "row", borderBottom: "1px solid #E7E5E4", minHeight: 28, backgroundColor: "#FFFFFF" },
        tableRowAlt: { flexDirection: "row", borderBottom: "1px solid #E7E5E4", minHeight: 28, backgroundColor: "#FAFAF9" },
        tableHeaderCell: { color: "#1C1917", fontSize: 8.5, fontWeight: "bold", padding: 4 },
        tableCellCategory: { fontSize: 8.5, fontWeight: "bold", color: "#1C1917", padding: 5, borderRight: "1px solid #E7E5E4", backgroundColor: "#F5F5F4" },
        tableCellContent: { fontSize: 8, color: "#44403C", padding: 5, borderRight: "1px solid #E7E5E4" },
        rankBadge: { fontSize: 7.5, fontWeight: "bold", color: "#44403C", marginBottom: 3 },

        // Highlights column styles (no box/borders)
        highlightsContainer: { flexDirection: "column", gap: 12, marginTop: 10, marginBottom: 15 },
        highlightCol: { marginBottom: 10 },
        highlightColTitle: { fontSize: 10, fontWeight: "bold", color: "#1C1917", marginBottom: 4 },
        highlightItem: { fontSize: 8, color: "#44403C", marginBottom: 4, lineHeight: 1.4 },

        // References styles
        refSection: { marginTop: 20, borderTop: "1px solid #E7E5E4", paddingTop: 12 },
        refHeading: { fontSize: 10, fontWeight: "bold", color: "#1C1917", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 },
        refItem: { flexDirection: "row", gap: 6, marginBottom: 8 },
        refNum: { fontSize: 8, fontWeight: "bold", color: "#0F766E", width: 18, textAlign: "right" },
        refBlock: { flex: 1, gap: 1 },
        refLabel: { fontSize: 8, color: "#78716C", fontWeight: "bold", width: 80, flexShrink: 0 },
        refValue: { fontSize: 8, color: "#44403C", flex: 1 },
        refRow: { flexDirection: "row", gap: 4 },
        refQuote: { fontSize: 8, color: "#57534E", fontStyle: "italic", flex: 1 },
        watermark: { fontSize: 7.5, color: "#A8A29E", marginTop: 24, textAlign: "center" },
      });

      function buildTextWithCitations(text: string) {
        const cleanText = text.replace(/\[[a-zA-Z0-9_]+\]/g, "").replace(/\s{2,}/g, " ");
        // Splitting logic using standard regex to extract URLs and map to [N] citation badges
        const parts = [];
        const regex = /\(source:\s*(https?:\/\/[^\s)]+)\)/g;
        let lastIdx = 0;
        let match;

        while ((match = regex.exec(cleanText)) !== null) {
          const rawText = cleanText.slice(lastIdx, match.index);
          if (rawText) {
            parts.push(<Text key={`t-${match.index}`} style={styles.body}>{rawText}</Text>);
          }
          const url = match[1];
          const num = urlMap.get(url) || 1;
          parts.push(
            <Link key={`l-${match.index}`} src={`#ref-${num}`} style={styles.citationLink}>
              [{num}]
            </Link>
          );
          lastIdx = regex.lastIndex;
        }
        const remaining = text.slice(lastIdx);
        if (remaining) {
          parts.push(<Text key="t-end" style={styles.body}>{remaining}</Text>);
        }
        return parts;
      }

      // Map key comparison parameters side-by-side
      const keyFieldsList = [
        { label: "Base Earn Rate", name: "base_earn_rate" },
        { label: "Minimum Redemption", name: "minimum_redemption" },
        { label: "Points Expiry Policy", name: "expiry_policy" },
        { label: "Mobile App Rating", name: "app_store_rating" },
        { label: "Loyalty Tiers Enabled", name: "has_tiers" },
      ];

      function getFieldValue(progIdx: number, fieldName: string): string {
        const field = programData[progIdx]?.fields.find((f) => f.field_name === fieldName);
        return field?.field_value || "—";
      }

      const categoryWidth = "24%";
      const programColWidth = `${76 / programNames.length}%`;

      const PDFDoc = () => (
        <Document title={`Competitive Matrix — ${programNames.join(" vs ")}`}>
          <Page size="A4" style={styles.page}>
            {/* Document Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Strategic Competitive Comparison</Text>
              <Text style={styles.subtitle}>
                InfoVac Analyst Report · {programNames.join(" vs ")} · {new Date().toLocaleDateString("en-GB")} · {wordCount} words
              </Text>
            </View>

            {/* Executive Summary */}
            <Text style={styles.sectionHeading}>Executive Summary</Text>
            <View style={styles.bodyWrap}>
              <Text style={styles.body}>
                {buildTextWithCitations(analysis.executive_summary)}
              </Text>
            </View>

            {/* Comparison Table */}
            <Text style={styles.sectionHeading}>Market Matrix Table</Text>
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, { width: "24%" }]}>Category</Text>
                <Text style={[styles.tableHeaderCell, { width: "76%" }]}>Comparative Analysis</Text>
              </View>

              {analysis.matrix.map((item: any, i: number) => {
                const isAlt = i % 2 !== 0;
                return (
                  <View key={i} wrap={false} style={isAlt ? styles.tableRowAlt : styles.tableRow}>
                    <Text style={[styles.tableCellCategory, { width: "24%" }]}>{item.category}</Text>
                    <View style={[styles.tableCellContent, { width: "76%", borderRightWidth: 0 }]}>
                      <Text style={styles.body}>
                        {buildTextWithCitations(item.rationale)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Detailed Parameters Table */}
            <Text style={styles.sectionHeading}>Side-by-Side Parameters</Text>
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, { width: categoryWidth }]}>Loyalty Parameter</Text>
                {programNames.map((name, i) => (
                  <Text key={i} style={[styles.tableHeaderCell, { width: programColWidth }]}>{name}</Text>
                ))}
              </View>

              {keyFieldsList.map((fItem, i) => {
                const isAlt = i % 2 !== 0;
                return (
                  <View key={i} wrap={false} style={isAlt ? styles.tableRowAlt : styles.tableRow}>
                    <Text style={[styles.tableCellCategory, { width: categoryWidth }]}>{fItem.label}</Text>
                    {programNames.map((_, pIdx) => {
                      const field = programData[pIdx]?.fields.find((f) => f.field_name === fItem.name);
                      const val = field?.field_value || "—";
                      const num = field?.source_url ? urlMap.get(field.source_url) : null;
                      return (
                        <View key={pIdx} style={[styles.tableCellContent, { width: programColWidth }]}>
                          <Text style={styles.body}>
                            {val}
                            {num && (
                              <Link src={`#ref-${num}`} style={styles.citationLink}>
                                {" "}[{num}]
                              </Link>
                            )}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>

            {/* Individual Highlights */}
            <Text style={styles.sectionHeading}>Program Highlights</Text>
            <View style={styles.highlightsContainer}>
              {programNames.map((pName, pIdx) => (
                <View key={pIdx} wrap={false} style={styles.highlightCol}>
                  <Text style={styles.highlightColTitle}>{pName} Highlights</Text>
                  {programData[pIdx]?.fields
                    .filter((f: any) => f.gate_passed && !f.is_null && f.field_value && f.category !== "program_basics")
                    .slice(0, 5)
                    .map((f: any, fi: number) => {
                      const num = f.source_url ? urlMap.get(f.source_url) : null;
                      return (
                        <Text key={fi} style={styles.highlightItem}>
                          • <Text style={{ fontWeight: "bold" }}>{f.field_name.replace(/_/g, " ")}</Text>: {f.field_value}
                          {num && (
                            <Link src={`#ref-${num}`} style={styles.citationLink}>
                              {" "}[{num}]
                            </Link>
                          )}
                        </Text>
                      );
                    })}
                </View>
              ))}
            </View>

            {/* References Section */}
            {references.length > 0 && (
              <View break style={styles.refSection}>
                <Text style={styles.refHeading}>References</Text>
                {references.map((ref) => {
                  const accessDate = ref.accessDate ?? "—";
                  const snippet = ref.snippet
                    ? `"${ref.snippet.slice(0, 150)}${ref.snippet.length > 150 ? "…" : ""}"`
                    : "—";
                  const displayUrl = ref.url.length > 70 ? ref.url.slice(0, 70) + "..." : ref.url;

                  return (
                    <View key={ref.url} wrap={false} style={styles.refItem} id={`ref-${ref.num}`}>
                      <Link src={ref.url} style={[styles.refNum, { textDecoration: "none" }]}>
                        [{ref.num}]
                      </Link>
                      <View style={styles.refBlock}>
                        <View style={styles.refRow}>
                          <Text style={styles.refLabel}>Source</Text>
                          <Text style={[styles.refValue, { color: "#0F766E", textDecoration: "underline" }]}>{displayUrl}</Text>
                        </View>
                        <View style={styles.refRow}>
                          <Text style={styles.refLabel}>Evidence Quote</Text>
                          <Text style={styles.refQuote}>{snippet}</Text>
                        </View>
                        <View style={styles.refRow}>
                          <Text style={styles.refLabel}>Access Date</Text>
                          <Text style={styles.refValue}>{accessDate}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <Text style={styles.watermark}>
              {WATERMARK_TEXT}
            </Text>
          </Page>
        </Document>
      );

      const blob = await pdf(<PDFDoc />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Competitive_Analysis_${programNames.join("_vs_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setLoading(false);
    }
  }

  // Simple string representation helper for safety
  function str(val: any): string {
    return val ? String(val) : "";
  }

  function escapeCSVCell(value: string): string {
    const stringified = value ? String(value) : "";
    if (stringified.includes(",") || stringified.includes('"') || stringified.includes("\n")) {
      return `"${stringified.replace(/"/g, '""')}"`;
    }
    return stringified;
  }

  async function handleCSV() {
    setLoading(true);
    try {
      const programData = await Promise.all(
        comparison.program_ids.map(async (pid) => {
          const fieldsRes = await fetch(`${API_BASE}/api/programs/${pid}/fields`);
          const fields: ExtractedField[] = fieldsRes.ok ? await fieldsRes.json() : [];
          return { id: pid, fields };
        })
      );

      const rows: string[][] = [];

      // Section 1: STRATEGIC OVERVIEW
      rows.push(["STRATEGIC OVERVIEW"]);
      rows.push(["Metric", "Analysis"]);
      rows.push(["Executive Summary", comparison.analysis.executive_summary]);
      rows.push(["Strategic Recommendations", comparison.analysis.strategic_recommendations]);
      rows.push([]);

      // Section 2: COMPETITIVE MATRIX RANKINGS
      rows.push(["COMPETITIVE MATRIX RANKINGS"]);
      rows.push(["Category", "Rankings (Best to Worst)", "Rationale"]);
      comparison.analysis.matrix.forEach((m: any) => {
        rows.push([m.category, m.rankings.join(" > "), m.rationale]);
      });
      rows.push([]);

      // Section 3: DETAILED PROGRAM PARAMETERS
      rows.push(["DETAILED PROGRAM PARAMETERS"]);
      const headers = ["Field Category", "Field Name", ...programNames];
      rows.push(headers);

      const sampleFields = programData[0]?.fields || [];
      const sortedFieldKeys = [...sampleFields].sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.field_name.localeCompare(b.field_name);
      });

      sortedFieldKeys.forEach((f) => {
        const row = [f.category, f.field_name];
        programData.forEach((pData) => {
          const match = pData.fields.find((pf) => pf.field_name === f.field_name);
          row.push(match?.field_value || "—");
        });
        rows.push(row);
      });

      const csvContent = rows.map(r => r.map(escapeCSVCell).join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Competitive_Analysis_${programNames.join("_vs_")}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("CSV generation failed:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleCSV}
        disabled={loading}
        className="h-8 text-xs gap-1.5 border-border bg-white text-stone-700 hover:bg-stone-50"
      >
        <Download size={13} strokeWidth={1.5} />
        {loading ? "Exporting…" : "Export CSV Data"}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handlePDF}
        disabled={loading}
        className="h-8 text-xs gap-1.5 border-border bg-white text-stone-700 hover:bg-stone-50"
      >
        <FileText size={13} strokeWidth={1.5} />
        {loading ? "Generating…" : "Export Report PDF"}
      </Button>
    </div>
  );
}
