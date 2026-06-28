"use client";

import { ExternalLink, Calendar } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ExtractedField } from "@/types/api";

interface EvidenceDrawerProps {
  open: boolean;
  onClose: () => void;
  sourceUrl: string;
  field: ExtractedField | null;
}

/** Highlight the claimed snippet within source text using character offsets. */
function HighlightedContent({
  content,
  start,
  end,
}: {
  content: string;
  start: number | null;
  end: number | null;
}) {
  if (start == null || end == null || start < 0 || end <= start) {
    return <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-wrap">{content}</p>;
  }

  const before = content.slice(0, start);
  const highlighted = content.slice(start, end);
  const after = content.slice(end);

  return (
    <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-wrap">
      {before}
      <mark className="bg-amber-100 text-amber-900 rounded px-0.5 not-italic">
        {highlighted}
      </mark>
      {after}
    </p>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-stone-100 last:border-0">
      <span className="text-[11px] text-stone-500 shrink-0 pt-0.5">{label}</span>
      <span className="text-[11px] font-medium text-stone-800 text-right break-all">{value}</span>
    </div>
  );
}

export function EvidenceDrawer({ open, onClose, sourceUrl, field }: EvidenceDrawerProps) {
  // Format access_date nicely
  const accessDate = field?.access_date
    ? new Date(field.access_date).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[480px] sm:w-[520px] flex flex-col p-0 gap-0">
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border bg-stone-50">
          <SheetTitle className="text-sm font-semibold text-stone-900">
            Evidence Source
          </SheetTitle>
          <SheetDescription className="text-xs mt-1">
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[#0F766E] hover:underline break-all"
              >
                <ExternalLink size={11} strokeWidth={1.5} className="shrink-0" />
                {sourceUrl}
              </a>
            ) : (
              "No source URL"
            )}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-5 py-5 space-y-5">
            {field ? (
              <>
                {/* Field metadata card */}
                <div className="bg-white border border-border rounded-lg px-4 py-1">
                  <MetaRow label="Field" value={`${field.category}.${field.field_name}`} />
                  <MetaRow
                    label="Value"
                    value={
                      <span className="max-w-[200px] block text-right">
                        {String(field.field_value ?? "—")}
                      </span>
                    }
                  />
                  {field.confidence != null && (
                    <MetaRow
                      label="Confidence"
                      value={
                        <span
                          className={`font-semibold ${
                            field.confidence >= 0.6
                              ? "text-emerald-700"
                              : field.confidence >= 0.4
                              ? "text-amber-600"
                              : "text-red-600"
                          }`}
                        >
                          {(field.confidence * 100).toFixed(0)}%
                        </span>
                      }
                    />
                  )}
                  {field.match_score != null && (
                    <MetaRow
                      label="Gate score"
                      value={
                        <span
                          className={`font-semibold ${
                            field.match_score >= 0.8 ? "text-emerald-700" : "text-red-600"
                          }`}
                        >
                          {(field.match_score * 100).toFixed(0)}%
                        </span>
                      }
                    />
                  )}
                  {accessDate ? (
                    <MetaRow
                      label="Accessed"
                      value={
                        <span className="flex items-center gap-1 justify-end">
                          <Calendar size={10} strokeWidth={1.5} className="text-stone-400" />
                          {accessDate}
                        </span>
                      }
                    />
                  ) : (
                    <MetaRow label="Accessed" value="—" />
                  )}
                </div>

                {/* Evidence quote */}
                {field.claimed_snippet && (
                  <div>
                    <p className="text-[11px] font-semibold text-stone-600 uppercase tracking-wide mb-2">
                      Evidence Quote
                    </p>
                    <div className="border border-border rounded-lg p-4 bg-white">
                      <HighlightedContent
                        content={field.claimed_snippet}
                        start={field.citation_start}
                        end={field.citation_end}
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
                No field evidence available for this citation.
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
