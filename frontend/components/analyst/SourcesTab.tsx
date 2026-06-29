"use client";

import { useState, useEffect } from "react";
import { Globe, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { getProgramSources } from "@/lib/api";
import type { ProgramSource } from "@/types/api";

interface SourcesTabProps {
  programId: string;
}

const SOURCE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  tnc:          { label: "T&C",        color: "bg-purple-50 text-purple-700 border-purple-200" },
  press:        { label: "Press",      color: "bg-blue-50 text-blue-700 border-blue-200" },
  faq:          { label: "FAQ",        color: "bg-sky-50 text-sky-700 border-sky-200" },
  homepage:     { label: "Homepage",   color: "bg-stone-50 text-stone-600 border-stone-200" },
  benefits:     { label: "Benefits",   color: "bg-teal-50 text-teal-700 border-teal-200" },
  news:         { label: "News",       color: "bg-amber-50 text-amber-700 border-amber-200" },
  mechanics:    { label: "Mechanics",  color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  partners:     { label: "Partners",   color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  app_review:   { label: "App Review", color: "bg-orange-50 text-orange-700 border-orange-200" },
  competitors:  { label: "Competitor", color: "bg-red-50 text-red-700 border-red-200" },
  forum:        { label: "Forum",      color: "bg-rose-50 text-rose-700 border-rose-200" },
};

function Favicon({ url }: { url: string }) {
  const [err, setErr] = useState(false);
  const domain = url ? url.split("/")[2] || "" : "";
  if (err || !domain) {
    return <Globe size={14} className="text-stone-400 shrink-0" />;
  }
  return (
    <img
      src={`https://www.google.com/s2/favicons?sz=32&domain=${domain}`}
      onError={() => setErr(true)}
      className="w-3.5 h-3.5 rounded-sm object-contain shrink-0"
      alt=""
    />
  );
}

export function SourcesTab({ programId }: SourcesTabProps) {
  const [sources, setSources] = useState<ProgramSource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getProgramSources(programId).then((data) => {
      setSources(data);
      setLoading(false);
    });
  }, [programId]);

  const succeeded = sources.filter((s) => s.fetch_status === "success");
  const failed = sources.filter((s) => s.fetch_status !== "success");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-stone-400 text-sm">
        <Loader2 size={16} className="animate-spin" />
        Loading sources…
      </div>
    );
  }

  if (sources.length === 0) {
    return (
      <p className="text-sm text-stone-400 text-center py-12">No source data available.</p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-4 text-xs text-stone-600 font-mono bg-stone-50 border border-stone-200 rounded-lg px-4 py-2.5">
        <span className="text-stone-400">Total crawled:</span>
        <span className="font-bold text-stone-800">{sources.length}</span>
        <span className="text-stone-300">·</span>
        <span className="text-emerald-600 font-semibold">{succeeded.length} succeeded</span>
        <span className="text-stone-300">·</span>
        <span className="text-red-500 font-semibold">{failed.length} failed</span>
      </div>

      {/* Source list */}
      <div className="divide-y divide-stone-100 border border-stone-200 rounded-lg overflow-hidden">
        {sources.map((src) => {
          const badge = SOURCE_TYPE_LABELS[src.source_type] ?? {
            label: src.source_type,
            color: "bg-stone-50 text-stone-500 border-stone-200",
          };
          const domain = src.url.split("/")[2] ?? src.url;
          const date = new Date(src.fetched_at).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });

          return (
            <div key={src.id} className="flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-stone-50/60 transition-colors">
              {/* Status icon */}
              {src.fetch_status === "success" ? (
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
              ) : (
                <XCircle size={14} className="text-red-400 shrink-0" />
              )}

              {/* Favicon */}
              <Favicon url={src.url} />

              {/* URL + title */}
              <div className="flex-1 min-w-0">
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-stone-700 hover:text-[#0F766E] hover:underline truncate block transition-colors"
                  title={src.url}
                >
                  {src.title || domain}
                </a>
                <span className="text-[10px] text-stone-400 font-mono truncate block">{domain}</span>
              </div>

              {/* Source type badge */}
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${badge.color}`}>
                {badge.label}
              </span>

              {/* Date */}
              <span className="text-[10px] text-stone-400 font-mono shrink-0 w-20 text-right">{date}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
