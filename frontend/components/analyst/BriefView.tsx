"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EvidenceDrawer } from "./EvidenceDrawer";
import type { Narrative, ExtractedField } from "@/types/api";

interface BriefViewProps {
  narrative: Narrative;
  fields: ExtractedField[];
}

/**
 * Parses (source: https://...) citations from narrator output.
 * Returns:
 *   - parts: React nodes with [N] superscript buttons replacing raw citations
 *   - urlMap: ordered Map<url, refNumber>
 */
function parseBriefWithSuperscripts(
  text: string,
  onCiteClick: (url: string) => void
): { parts: React.ReactNode[]; urlMap: Map<string, number> } {
  const urlMap = new Map<string, number>();
  let counter = 1;

  // First pass — collect unique URLs in order of appearance
  const urlRegex = /\(source:\s*(https?:\/\/[^\s)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = urlRegex.exec(text)) !== null) {
    if (!urlMap.has(m[1])) urlMap.set(m[1], counter++);
  }

  // Second pass — split and replace with superscript [N] buttons
  const parts: React.ReactNode[] = [];
  const splitRegex = /\(source:\s*(https?:\/\/[^\s)]+)\)/g;
  let lastIndex = 0;
  let partIndex = 0;

  splitRegex.lastIndex = 0;
  while ((m = splitRegex.exec(text)) !== null) {
    if (m.index > lastIndex) {
      parts.push(
        <span key={`t-${partIndex++}`}>{text.slice(lastIndex, m.index)}</span>
      );
    }
    const url = m[1];
    const num = urlMap.get(url) ?? 0;
    parts.push(
      <button
        key={`ref-${partIndex++}`}
        onClick={() => onCiteClick(url)}
        className="inline-flex items-center justify-center text-[9px] font-bold text-[#0F766E] hover:text-white bg-transparent hover:bg-[#0F766E] border border-[#0F766E] rounded px-1 py-0 leading-none align-super mx-0.5 transition-colors"
        title={url}
      >
        {num}
      </button>
    );
    lastIndex = splitRegex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(<span key={`t-${partIndex++}`}>{text.slice(lastIndex)}</span>);
  }

  return { parts, urlMap };
}

/** Render paragraphs and headings from markdown-like text with citation badges */
function renderParagraphs(
  text: string,
  onCiteClick: (url: string) => void
): React.ReactNode[] {
  const paragraphs = text.split(/\n{2,}/);
  return paragraphs.map((para, i) => {
    const trimmed = para.trim();
    if (!trimmed) return null;

    const h2Match = trimmed.match(/^##\s+(.+)/);
    const h3Match = trimmed.match(/^###\s+(.+)/);
    if (h2Match) {
      return (
        <h2 key={i} className="text-base font-semibold text-stone-800 mt-6 mb-2">
          {h2Match[1]}
        </h2>
      );
    }
    if (h3Match) {
      return (
        <h3 key={i} className="text-sm font-semibold text-stone-700 mt-4 mb-1">
          {h3Match[1]}
        </h3>
      );
    }

    const { parts } = parseBriefWithSuperscripts(trimmed, onCiteClick);
    return (
      <p key={i} className="text-sm text-stone-700 leading-[1.75] mb-3">
        {parts}
      </p>
    );
  });
}

/** Render a References section at the bottom, matching academic style */
function ReferencesSection({
  urlMap,
  fields,
  onRefClick,
}: {
  urlMap: Map<string, number>;
  fields: ExtractedField[];
  onRefClick: (url: string) => void;
}) {
  if (urlMap.size === 0) return null;

  // Invert the map for sorted output: number → url
  const entries = Array.from(urlMap.entries()).sort((a, b) => a[1] - b[1]);

  return (
    <div id="references-section" className="mt-10 pt-6 border-t-2 border-stone-200">
      <h2 className="text-sm font-semibold text-stone-800 mb-4 uppercase tracking-wide">References</h2>
      <ol className="space-y-5 list-none">
        {entries.map(([url, num]) => {
          // Find the field that matched this source URL
          const matchedField = fields.find(
            (f) =>
              f.claimed_snippet != null &&
              // match by source_id or fall back to any field with a snippet
              f.claimed_snippet.length > 0
          ) ?? null;

          const accessDate = matchedField?.access_date
            ? new Date(matchedField.access_date).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : null;

          const snippet = matchedField?.claimed_snippet
            ? matchedField.claimed_snippet.slice(0, 200) +
              (matchedField.claimed_snippet.length > 200 ? "…" : "")
            : null;

          return (
            <li key={url} id={`ref-${num}`} className="flex items-start gap-3">
              {/* Number */}
              <span className="text-[11px] font-bold text-[#0F766E] shrink-0 mt-0.5 w-6 text-right">
                [{num}]
              </span>

              {/* Details */}
              <div className="flex-1 space-y-1">
                {/* Source URL */}
                <div className="flex items-start gap-1.5">
                  <span className="text-[11px] text-stone-500 shrink-0 font-medium w-28">Source</span>
                  <button
                    onClick={() => onRefClick(url)}
                    className="text-[11px] text-[#0F766E] hover:underline text-left break-all transition-colors"
                    title="View evidence"
                  >
                    {url}
                  </button>
                </div>

                {/* Evidence Quote */}
                <div className="flex items-start gap-1.5">
                  <span className="text-[11px] text-stone-500 shrink-0 font-medium w-28">Evidence Quote</span>
                  <span className="text-[11px] text-stone-600 italic leading-relaxed">
                    {snippet ? `"${snippet}"` : "—"}
                  </span>
                </div>

                {/* Access Date */}
                <div className="flex items-start gap-1.5">
                  <span className="text-[11px] text-stone-500 shrink-0 font-medium w-28">Access Date</span>
                  <span className="text-[11px] text-stone-600">
                    {accessDate ?? "—"}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function BriefView({ narrative, fields }: BriefViewProps) {
  const [copied, setCopied] = useState(false);
  const [drawerUrl, setDrawerUrl] = useState<string | null>(null);

  function handleCopy() {
    // Export clean text (strip raw citation annotations)
    const clean = narrative.narrative.replace(
      /\(source:\s*https?:\/\/[^\s)]+\)/g,
      ""
    );
    navigator.clipboard.writeText(clean);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Collect all unique URLs from narrative in order for references
  const { urlMap } = parseBriefWithSuperscripts(narrative.narrative, () => {});

  // Find matching field for evidence drawer
  const drawerField = drawerUrl
    ? fields.find((f) => f.claimed_snippet != null) ?? null
    : null;

  return (
    <>
      <div className="relative">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Analyst Brief</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {narrative.word_count} words · Click{" "}
              <sup className="text-[#0F766E] font-bold text-[9px] border border-[#0F766E] rounded px-1">
                N
              </sup>{" "}
              citations to view source evidence
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="text-xs text-stone-500 hover:text-stone-800 h-8 gap-1.5"
          >
            {copied ? (
              <Check size={13} strokeWidth={1.5} className="text-[#0F766E]" />
            ) : (
              <Copy size={13} strokeWidth={1.5} />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        {/* Body */}
        <div className="prose-container">
          {renderParagraphs(narrative.narrative, setDrawerUrl)}
        </div>

        {/* References section */}
        <ReferencesSection urlMap={urlMap} fields={fields} onRefClick={setDrawerUrl} />
      </div>

      <EvidenceDrawer
        open={drawerUrl !== null}
        onClose={() => setDrawerUrl(null)}
        sourceUrl={drawerUrl ?? ""}
        field={drawerField}
      />
    </>
  );
}
