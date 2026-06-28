"use client";

import { useState } from "react";
import { Download, FileText, TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Narrative, ExtractedField } from "@/types/api";

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

  // Collect unique source URLs in order of appearance
  const urlMap = new Map<string, number>();
  let counter = 1;
  const urlRegex = /\(source:\s*(https?:\/\/[^\s)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = urlRegex.exec(narrative.narrative)) !== null) {
    if (!urlMap.has(m[1])) urlMap.set(m[1], counter++);
  }

  // Build references data
  const references = Array.from(urlMap.entries()).sort((a, b) => a[1] - b[1]);

  // Split narrative into alternating plain-text / linked-[N] segments
  function buildBodyNodes(text: string) {
    const nodes: React.ReactNode[] = [];
    const re = /\(source:\s*(https?:\/\/[^\s)]+)\)/g;
    let last = 0;
    let match: RegExpExecArray | null;
    let idx = 0;
    while ((match = re.exec(text)) !== null) {
      if (match.index > last) {
        nodes.push(
          <Text key={`t${idx++}`} style={styles.body}>
            {text.slice(last, match.index)}
          </Text>
        );
      }
      const srcUrl = match[1];
      const num = urlMap.get(srcUrl) ?? "?";
      nodes.push(
        <Link key={`l${idx++}`} src={srcUrl} style={styles.citationLink}>
          [{num}]
        </Link>
      );
      last = re.lastIndex;
    }
    if (last < text.length) {
      nodes.push(
        <Text key={`t${idx++}`} style={styles.body}>
          {text.slice(last)}
        </Text>
      );
    }
    return nodes;
  }

  const styles = StyleSheet.create({
    page: { padding: 48, fontFamily: "Helvetica", backgroundColor: "#FAFAF9" },
    header: { marginBottom: 24, borderBottom: "1px solid #E7E5E4", paddingBottom: 12 },
    title: { fontSize: 18, fontWeight: "bold", color: "#1C1917", marginBottom: 4 },
    subtitle: { fontSize: 10, color: "#57534E" },
    body: { fontSize: 10, lineHeight: 1.75, color: "#1C1917" },
    bodyWrap: { flexDirection: "row", flexWrap: "wrap", marginBottom: 24 },
    citationLink: { fontSize: 9, color: "#0F766E", fontWeight: "bold", textDecoration: "underline" },
    refSection: { marginTop: 24, borderTop: "1px solid #E7E5E4", paddingTop: 16 },
    refHeading: { fontSize: 11, fontWeight: "bold", color: "#1C1917", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 },
    refItem: { flexDirection: "row", gap: 8, marginBottom: 10 },
    refNum: { fontSize: 9, fontWeight: "bold", color: "#0F766E", width: 20, textAlign: "right" },
    refBlock: { flex: 1, gap: 2 },
    refLabel: { fontSize: 9, color: "#78716C", fontWeight: "bold", width: 90 },
    refValue: { fontSize: 9, color: "#44403C" },
    refRow: { flexDirection: "row", gap: 4 },
    refQuote: { fontSize: 9, color: "#57534E", fontStyle: "italic" },
    watermark: { fontSize: 8, color: "#A8A29E", marginTop: 32 },
  });

  const PDFDoc = () => (
    <Document title={`${programName} — InfoVac Analyst Brief`}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{programName}</Text>
          <Text style={styles.subtitle}>
            InfoVac Competitive Intelligence · {new Date().toLocaleDateString("en-GB")} ·{" "}
            {narrative.word_count} words
          </Text>
        </View>

        {/* Body — [N] citations are clickable links to source URLs */}
        <View style={styles.bodyWrap}>
          {buildBodyNodes(narrative.narrative)}
        </View>

        {/* References */}
        {references.length > 0 && (
          <View style={styles.refSection}>
            <Text style={styles.refHeading}>References</Text>
            {references.map(([url, num]) => {
              const matchedField = fields.find(
                (f) => f.claimed_snippet != null && f.claimed_snippet.length > 0
              );
              const accessDate = matchedField?.access_date
                ? new Date(matchedField.access_date).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "—";
              const snippet = matchedField?.claimed_snippet
                ? `"${matchedField.claimed_snippet.slice(0, 180)}${matchedField.claimed_snippet.length > 180 ? "…" : ""}"`
                : "—";

              return (
                <View key={url} style={styles.refItem}>
                  <Link src={url} style={[styles.refNum, { textDecoration: "none" }]}>[{num}]</Link>
                  <View style={styles.refBlock}>
                    <View style={styles.refRow}>
                      <Text style={styles.refLabel}>Source</Text>
                      <Text style={[styles.refValue, { color: "#0F766E" }]}>{url}</Text>
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
          Generated by InfoVac — Autonomous Competitive Intelligence Agent
        </Text>
      </Page>
    </Document>
  );

  const blob = await pdf(<PDFDoc />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${programName.replace(/\s+/g, "_")}_brief.pdf`;
  a.click();
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
