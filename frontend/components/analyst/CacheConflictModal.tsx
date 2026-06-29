"use client";

import { useEffect, useRef } from "react";
import { Clock, Zap, RefreshCw, X, Search } from "lucide-react";
import type { Program } from "@/types/api";

interface SimilarProgramsModalProps {
  query: string;
  matches: Program[];
  onSelect: (program: Program) => void;
  onRunFresh: () => void;
  onDismiss: () => void;
}

function formatRelative(isoDate: string): string {
  const d = new Date(isoDate);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay} days ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatFull(isoDate: string): string {
  const d = new Date(isoDate);
  return (
    d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })
  );
}

/** Highlight the matching portion of the name */
function HighlightedName({ name, query }: { name: string; query: string }) {
  const idx = name.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1 || !query) return <span>{name}</span>;
  return (
    <span>
      {name.slice(0, idx)}
      <mark className="bg-[#0F766E]/15 text-[#0a5c56] rounded px-0.5 not-italic font-semibold">
        {name.slice(idx, idx + query.length)}
      </mark>
      {name.slice(idx + query.length)}
    </span>
  );
}

export function SimilarProgramsModal({
  query,
  matches,
  onSelect,
  onRunFresh,
  onDismiss,
}: SimilarProgramsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onDismiss(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  useEffect(() => { modalRef.current?.focus(); }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(28, 25, 23, 0.5)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="similar-modal-title"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl outline-none border border-stone-200 overflow-hidden"
        style={{
          animation: "slideUp 0.22s cubic-bezier(0.34,1.2,0.64,1) both",
          boxShadow: "0 32px 64px -12px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.04)",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
              <Search size={15} className="text-amber-600" />
            </div>
            <div>
              <h2 id="similar-modal-title" className="text-sm font-semibold text-stone-900 leading-tight">
                Similar analyses found
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                {matches.length} result{matches.length !== 1 ? "s" : ""} matching
                {" "}<span className="font-medium text-stone-700">"{query}"</span>
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="text-stone-400 hover:text-stone-700 transition-colors rounded-lg p-1 -mr-1 -mt-1"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>

        {/* Match list */}
        <div className="max-h-72 overflow-y-auto divide-y divide-stone-100">
          {matches.map((prog) => {
            const completedAt = prog.completed_at ?? prog.created_at;
            return (
              <button
                key={prog.id}
                onClick={() => onSelect(prog)}
                className="w-full text-left px-5 py-3.5 hover:bg-stone-50 active:bg-stone-100
                           transition-colors group flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-sm font-medium text-stone-800 truncate leading-tight">
                    <HighlightedName name={prog.name} query={query} />
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
                    <Clock size={10} className="shrink-0" />
                    <span className="font-medium text-stone-600">{formatRelative(completedAt)}</span>
                    <span>·</span>
                    <span>{formatFull(completedAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-semibold text-[#0F766E] bg-[#0F766E]/8 border border-[#0F766E]/20 px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    Load
                  </span>
                  <Zap size={13} className="text-[#0F766E] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer: run fresh */}
        <div className="border-t border-stone-100 px-5 py-3.5 bg-stone-50/60">
          <button
            onClick={onRunFresh}
            className="w-full flex items-center justify-between text-xs text-stone-600 hover:text-stone-900
                       group transition-colors"
          >
            <span>
              None of these?{" "}
              <span className="font-semibold">
                Run fresh analysis for <span className="text-[#0F766E]">"{query}"</span>
              </span>
            </span>
            <RefreshCw
              size={13}
              className="text-stone-400 group-hover:text-[#0F766E] group-hover:rotate-180 transition-all duration-500"
            />
          </button>
        </div>
      </div>
    </div>
  );
}
