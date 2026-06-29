"use client";

interface CitationBadgeProps {
  num: number;
  url?: string | null;
  onClick: () => void;
}

export function CitationBadge({ num, url, onClick }: CitationBadgeProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex items-center justify-center text-[9px] font-bold text-[#0F766E] hover:text-white bg-transparent hover:bg-[#0F766E] border border-[#0F766E] rounded px-1 py-0 leading-none align-super ml-1 mr-0.5 transition-colors cursor-pointer"
      style={{ color: "#0F766E", borderColor: "#0F766E" }}
      title={url ?? undefined}
    >
      {num}
    </button>
  );
}
