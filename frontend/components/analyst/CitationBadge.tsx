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
      className="inline-flex items-center justify-center text-[9px] font-bold bg-transparent rounded px-1 py-0 leading-none align-super ml-1 mr-0.5 transition-colors cursor-pointer"
      style={{
        color: "#fd7f4f",
        borderColor: "rgba(253,127,79,0.45)",
        borderWidth: "1px",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.backgroundColor = "#fd7f4f";
        e.currentTarget.style.color = "#fff";
        e.currentTarget.style.borderColor = "transparent";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = "transparent";
        e.currentTarget.style.color = "#fd7f4f";
        e.currentTarget.style.borderColor = "rgba(253,127,79,0.45)";
      }}
      title={url ?? undefined}
    >
      {num}
    </button>
  );
}
