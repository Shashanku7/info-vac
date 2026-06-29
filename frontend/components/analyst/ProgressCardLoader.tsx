"use client";

interface ProgressCardLoaderProps {
  title: string;
  subtitle: string;
  stageName: string;
  progressPercent: number;
  className?: string;
}

export function ProgressCardLoader({
  title,
  subtitle,
  stageName,
  progressPercent,
  className = "",
}: ProgressCardLoaderProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-16 bg-white border border-stone-200 rounded-xl max-w-4xl mx-auto shadow-sm space-y-5 px-8 ${className} animate-in fade-in slide-in-from-bottom-1 duration-300`}
    >
      <div className="text-center space-y-1">
        <h3 className="text-sm font-semibold text-stone-850">{title}</h3>
        <p className="text-xs text-stone-400">{subtitle}</p>
      </div>

      <div className="w-full max-w-xs space-y-1.5">
        <div className="flex justify-between text-[10px] text-stone-500 font-mono">
          <span className="capitalize">{stageName}</span>
          <span>{Math.round(progressPercent)}%</span>
        </div>
        <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden border border-stone-200/50">
          <div
            className="h-full rounded-full bg-[#0F766E] transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
