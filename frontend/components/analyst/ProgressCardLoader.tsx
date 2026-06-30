import { Loader2, CheckCircle2, Circle } from "lucide-react";

interface ProgressCardLoaderProps {
  title: string;
  subtitle: string;
  stageName: string;
  progressPercent: number;
  className?: string;
}

const COMPARISON_STEPS = [
  { label: "Consolidating verified program parameters", thresh: 20 },
  { label: "Cross-checking source citation coordinates", thresh: 45 },
  { label: "Evaluating category rankings and head-to-head leaders", thresh: 70 },
  { label: "Synthesizing strategic playbooks for QSR & Retail", thresh: 90 },
  { label: "Structuring final competitive matrix document", thresh: 100 }
];

const SINGLE_STEPS = [
  { label: "Consolidating verified program parameters", thresh: 20 },
  { label: "Cross-checking source citation coordinates", thresh: 45 },
  { label: "Structuring executive narrative highlights", thresh: 70 },
  { label: "Synthesizing category-by-category briefs", thresh: 90 },
  { label: "Structuring final analyst brief document", thresh: 100 }
];

export function ProgressCardLoader({
  title,
  subtitle,
  stageName,
  progressPercent,
  className = "",
}: ProgressCardLoaderProps) {
  const isCompare = title.toLowerCase().includes("compare") || title.toLowerCase().includes("multi");
  const steps = isCompare ? COMPARISON_STEPS : SINGLE_STEPS;

  return (
    <div
      className={`flex flex-col items-center justify-center py-12 rounded-[10px] max-w-4xl mx-auto space-y-6 px-8 ${className} animate-in fade-in slide-in-from-bottom-1 duration-300`}
      style={{
        backgroundColor: "rgba(9,37,56,0.6)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="text-center space-y-1">
        <h3
          className="text-sm font-bold"
          style={{ fontFamily: "var(--kobie-font-heading)", color: "var(--kobie-white)" }}
        >
          {title}
        </h3>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
          {subtitle}
        </p>
      </div>

      <div className="w-full max-w-sm space-y-1.5">
        <div
          className="flex justify-between text-[10px] font-mono"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          <span className="capitalize">{stageName}</span>
          <span style={{ color: "#fd7f4f" }}>{Math.round(progressPercent)}%</span>
        </div>
        <div
          className="h-1.5 w-full rounded-full overflow-hidden"
          style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%`, backgroundColor: "#fd7f4f" }}
          />
        </div>
      </div>

      {/* SaaS Premium Checklist */}
      <div className="w-full max-w-sm pt-4 space-y-3 border-t border-white/5 text-left">
        {steps.map((step, idx) => {
          const isCompleted = progressPercent >= step.thresh;
          const isActive = progressPercent < step.thresh && (idx === 0 || progressPercent >= steps[idx - 1].thresh);
          
          return (
            <div key={idx} className="flex items-center gap-3 animate-in fade-in duration-200">
              {isCompleted ? (
                <CheckCircle2 size={13} className="text-[#10b981] shrink-0" />
              ) : isActive ? (
                <Loader2 size={13} className="text-[#fd7f4f] animate-spin shrink-0" />
              ) : (
                <Circle size={13} className="text-white/20 shrink-0" />
              )}
              <span
                className="text-xs transition-colors duration-300"
                style={{
                  color: isCompleted ? "rgba(255, 255, 255, 0.85)" : isActive ? "#fd7f4f" : "rgba(255, 255, 255, 0.25)",
                  fontWeight: isActive ? 600 : 400
                }}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
