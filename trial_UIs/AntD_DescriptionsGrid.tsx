"use client";

export default function AntDDescriptionsGrid() {
  return (
    <div className="min-h-screen bg-[#fafafa] text-stone-800 p-8 font-sans antialiased">
      <div className="max-w-4xl mx-auto space-y-8 border border-stone-200 bg-white rounded-2xl p-8 shadow-sm">
        {/* Title */}
        <div>
          <span className="text-[10px] text-stone-400 font-mono tracking-widest uppercase block mb-1">ANT_DESIGN COMPONENT // DESCRIPTIONS</span>
          <h2 className="text-sm font-bold text-stone-900">// Structured Entity Details</h2>
        </div>

        {/* Descriptions layout grid (AntD Descriptions component mock) */}
        <div className="border border-stone-200 rounded-xl overflow-hidden bg-stone-50/50">
          <div className="grid grid-cols-1 md:grid-cols-2 border-b border-stone-200">
            <DescCell label="Program Name" val="Starbucks Rewards" />
            <DescCell label="Status" val="Complete" active />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 border-b border-stone-200">
            <DescCell label="Base Earn Rate" val="1-2 stars per $1 spent" />
            <DescCell label="Point Expiry" val="6 months" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2">
            <DescCell label="Redemption Options" val="Free drinks, food, merchandise, and bakery items" />
            <DescCell label="Membership Count" val="31 Million" />
          </div>
        </div>
      </div>
    </div>
  );
}

function DescCell({ label, val, active = false }: { label: string; val: string; active?: boolean }) {
  return (
    <div className="flex divide-x divide-stone-250 border-r border-stone-200/40 last:border-r-0">
      <div className="w-36 bg-stone-100/60 p-3 font-semibold text-xs text-stone-500 flex items-center shrink-0">
        {label}
      </div>
      <div className="p-3 text-xs text-stone-700 flex items-center bg-white flex-grow">
        {active ? (
          <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] px-2 py-0.5 rounded font-medium">
            ● {val}
          </span>
        ) : (
          val
        )}
      </div>
    </div>
  );
}
