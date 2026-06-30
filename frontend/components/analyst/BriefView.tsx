"use client";

import { useState, useMemo } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { CitationBadge } from "./CitationBadge";
import type { Narrative, ExtractedField } from "@/types/api";
import {
  parseNarrative,
  splitNarrativeSegments,
  type ParsedReference,
  calculateWordCount,
  WATERMARK_TEXT,
} from "@/lib/narrative";

interface BriefViewProps {
  narrative: Narrative;
  fields: ExtractedField[];
  /** Pre-computed references — if provided, skips re-parsing (pass from parent for PDF/UI sync) */
  parsedRefs?: ParsedReference[];
}

/** Render paragraphs and headings from the narrative text, with inline [N] citation buttons */
function renderParagraphs(
  text: string,
  urlMap: Map<string, number>,
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

    const segments = splitNarrativeSegments(trimmed, urlMap);
    return (
      <p key={i} className="text-sm text-stone-700 leading-[1.75] mb-3">
        {segments.map((seg, j) =>
          seg.type === "text" ? (
            <span key={j}>{seg.text}</span>
          ) : (
            <CitationBadge
              key={j}
              num={seg.num ?? 1}
              url={seg.url}
              onClick={() => seg.url && onCiteClick(seg.url)}
            />
          )
        )}
      </p>
    );
  });
}

function ReferencesSection({
  references,
  onRefClick,
}: {
  references: ParsedReference[];
  onRefClick: (url: string) => void;
}) {
  if (references.length === 0) return null;

  return (
    <div id="references-section" className="mt-10 pt-6 border-t-2 border-stone-200">
      <h2 className="text-sm font-semibold text-stone-800 mb-4 uppercase tracking-wide">References</h2>
      <ol className="space-y-5 list-none">
        {references.map((ref) => {
          const displayDate = ref.accessDate ?? "—";

          return (
            <li key={ref.url} id={`ref-${ref.num}`} className="flex items-start gap-3">
              <span className="text-[11px] font-bold text-[#0F766E] shrink-0 mt-0.5 w-6 text-right">
                [{ref.num}]
              </span>
              <div className="flex-1 space-y-1">
                <div className="flex items-start gap-1.5">
                  <span className="text-[11px] text-stone-500 shrink-0 font-medium w-28">Source</span>
                  <button
                    onClick={() => onRefClick(ref.url)}
                    className="text-[11px] text-[#0F766E] hover:underline text-left break-all transition-colors flex items-center gap-1"
                    title="View evidence"
                  >
                    {ref.url}
                    <ExternalLink size={9} className="shrink-0 opacity-50" />
                  </button>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="text-[11px] text-stone-500 shrink-0 font-medium w-28">Evidence Quote</span>
                  <span className="text-[11px] text-stone-600 italic leading-relaxed">
                    {ref.snippet ? `"${ref.snippet}"` : "—"}
                  </span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="text-[11px] text-stone-500 shrink-0 font-medium w-28">Access Date</span>
                  <span className="text-[11px] text-stone-600">{displayDate}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function BriefView({ narrative, fields, parsedRefs }: BriefViewProps) {
  const [copied, setCopied] = useState(false);
  const [drawerUrl, setDrawerUrl] = useState<string | null>(null);

  // Single source of truth: use pre-parsed refs if parent provided them, otherwise parse here
  const { urlMap, references } = useMemo(() => {
    return parsedRefs
      ? (() => {
          // Rebuild urlMap from parsedRefs so we can render inline citations
          const m = new Map<string, number>();
          parsedRefs.forEach((r) => m.set(r.url, r.num));
          return { urlMap: m, references: parsedRefs };
        })()
      : parseNarrative(narrative.narrative, fields);
  }, [narrative.narrative, fields, parsedRefs]);

  const drawerField = drawerUrl
    ? fields.find(
        (f) => f.source_url === drawerUrl && f.claimed_snippet != null && f.claimed_snippet.length > 0
      ) ?? null
    : null;

  function handleCopy() {
    const clean = narrative.narrative.replace(/\(source:\s*https?:\/\/[^\s)]+\)/g, "");
    navigator.clipboard.writeText(clean);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const wordCount = useMemo(() => {
    return calculateWordCount(narrative.narrative);
  }, [narrative.narrative]);

  return (
    <>
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Analyst Brief</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {wordCount} words · Click{" "}
              <sup className="text-[#0F766E] font-bold text-[9px] border border-[#0F766E] rounded px-1" style={{ color: "#0F766E", borderColor: "#0F766E" }}>
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

        <div className="prose-container">
          {renderParagraphs(narrative.narrative, urlMap, setDrawerUrl)}
        </div>

        <ReferencesSection references={references} onRefClick={setDrawerUrl} />

        {/* Center watermark with lines to left and right */}
        <div className="relative flex py-6 items-center mt-8">
          <div className="flex-grow border-t border-stone-200"></div>
          <span className="flex-shrink mx-4 text-stone-400 text-[9px] font-mono uppercase tracking-wider">
            {WATERMARK_TEXT}
          </span>
          <div className="flex-grow border-t border-stone-200"></div>
        </div>
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
