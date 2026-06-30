"use client";

import { useState } from "react";
import { Download, FileText, TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Narrative, ExtractedField } from "@/types/api";
import { parseNarrative, splitNarrativeSegments, calculateWordCount, WATERMARK_TEXT } from "@/lib/narrative";

interface ExportBarProps {
  narrative?: Narrative | null;
  fields: ExtractedField[];
  programName: string;
}

function exportCSV(fields: ExtractedField[], programName: string) {
  const header = [
    "category",
    "field_name",
    "field_value",
    "gate_passed",
    "confidence",
    "match_score",
    "contradiction_flag",
    "claimed_snippet",
  ].join(",");

  const rows = fields.map((f) =>
    [
      f.category,
      f.field_name,
      `"${(f.field_value ?? "").replace(/"/g, '""')}"`,
      f.gate_passed,
      f.confidence ?? "",
      f.match_score ?? "",
      f.contradiction_flag,
      `"${(f.claimed_snippet ?? "").replace(/"/g, '""')}"`,
    ].join(",")
  );

  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${programName.replace(/\s+/g, "_")}_fields.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportPDF(narrative: Narrative, fields: ExtractedField[], programName: string) {
  const { pdf, Document, Page, Text, View, StyleSheet, Link } = await import(
    "@react-pdf/renderer"
  );

  // ── Single source of truth: use the same parseNarrative used by the UI ──
  const { urlMap, references } = parseNarrative(narrative.narrative, fields);

  const styles = StyleSheet.create({
    page: { padding: 48, fontFamily: "Helvetica", backgroundColor: "#FAFAF9" },
    header: { marginBottom: 24, borderBottom: "1px solid #E7E5E4", paddingBottom: 12 },
    title: { fontSize: 18, fontWeight: "bold", color: "#1C1917", marginBottom: 4 },
    subtitle: { fontSize: 10, color: "#57534E" },
    body: { fontSize: 10, lineHeight: 1.75, color: "#1C1917" },
    bodyWrap: { marginBottom: 24 },
    citationLink: { fontSize: 9, color: "#0F766E", fontWeight: "bold", textDecoration: "underline" },
    refSection: { marginTop: 24, borderTop: "1px solid #E7E5E4", paddingTop: 16 },
    refHeading: { fontSize: 11, fontWeight: "bold", color: "#1C1917", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 },
    refItem: { flexDirection: "row", gap: 8, marginBottom: 10 },
    refNum: { fontSize: 9, fontWeight: "bold", color: "#0F766E", width: 20, textAlign: "right" },
    refBlock: { flex: 1, gap: 2 },
    refLabel: { fontSize: 9, color: "#78716C", fontWeight: "bold", width: 90, flexShrink: 0 },
    refValue: { fontSize: 9, color: "#44403C", flex: 1 },
    refRow: { flexDirection: "row", gap: 4 },
    refQuote: { fontSize: 9, color: "#57534E", fontStyle: "italic", flex: 1 },
    watermark: { fontSize: 8, color: "#A8A29E", marginTop: 32, textAlign: "center" },
  });

  // Build narrative body: same segment logic as the UI (splitNarrativeSegments)
  function buildBodyNodes(text: string) {
    const segments = splitNarrativeSegments(text, urlMap);
    return segments.map((seg, idx) =>
      seg.type === "text" ? (
        <Text key={`t${idx}`} style={styles.body}>{seg.text}</Text>
      ) : (
        <Link key={`l${idx}`} src={`#ref-${seg.num}`} style={styles.citationLink}>
          [{seg.num}]
        </Link>
      )
    );
  }

  const PDFDoc = () => (
    <Document title={`${programName} — InfoVac Analyst Brief`}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{programName}</Text>
          <Text style={styles.subtitle}>
            InfoVac Competitive Intelligence · {new Date().toLocaleDateString("en-GB")} ·{" "}
            {calculateWordCount(narrative.narrative)} words
          </Text>
        </View>

        {/* Body */}
        <Text style={styles.bodyWrap}>
          {buildBodyNodes(narrative.narrative)}
        </Text>

        {/* References — built from the same parsed data as the UI */}
        {references.length > 0 && (
          <View style={styles.refSection}>
            <Text style={styles.refHeading}>References</Text>
            {references.map((ref) => {
              const accessDate = ref.accessDate ?? "—";
              const snippet = ref.snippet
                ? `"${ref.snippet.slice(0, 180)}${ref.snippet.length > 180 ? "…" : ""}"`
                : "—";
              const displayUrl = ref.url.length > 65 ? ref.url.slice(0, 65) + "..." : ref.url;

              return (
                <View key={ref.url} style={styles.refItem} id={`ref-${ref.num}`}>
                  <Link src={ref.url} style={[styles.refNum, { textDecoration: "none" }]}>
                    [{ref.num}]
                  </Link>
                  <View style={styles.refBlock}>
                    <View style={styles.refRow}>
                      <Text style={styles.refLabel}>Source</Text>
                      <Text style={[styles.refValue, { color: "#0F766E" }]}>{displayUrl}</Text>
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
  a.download = `${programName.replace(/\s+/g, "_")}_brief.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ExportBar({ narrative, fields, programName }: ExportBarProps) {
  const [pdfLoading, setPdfLoading] = useState(false);

  async function handlePDF() {
    if (!narrative) return;
    setPdfLoading(true);
    try {
      await exportPDF(narrative, fields, programName);
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {narrative && (
        <Button
          variant="outline"
          size="sm"
          onClick={handlePDF}
          disabled={pdfLoading}
          className="h-8 text-xs gap-1.5 border-border"
        >
          <FileText size={13} strokeWidth={1.5} />
          {pdfLoading ? "Generating…" : "Export PDF"}
        </Button>
      )}

      {fields.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportCSV(fields, programName)}
          className="h-8 text-xs gap-1.5 border-border"
        >
          <TableIcon size={13} strokeWidth={1.5} />
          Export CSV
        </Button>
      )}
    </div>
  );
}
