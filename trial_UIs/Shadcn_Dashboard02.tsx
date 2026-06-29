"use client";

import { Activity, ShieldCheck, Database, Layers } from "lucide-react";

export default function ShadcnDashboard02() {
  return (
    <div className="min-h-screen bg-[#fafafa] text-stone-850 p-8 font-sans antialiased">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 pb-4">
          <div>
            <span className="text-[10px] text-stone-400 font-mono tracking-widest uppercase block mb-1">SHADCN BLOCKS // DASHBOARD_02</span>
            <h1 className="text-lg font-semibold text-stone-900">Program Administration</h1>
          </div>
        </div>

        {/* Dashboard 02 Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Sidebar Nav (1 col) */}
          <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-2 h-fit shadow-sm">
            <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block px-2 mb-2">Metrics Menu</span>
            <SidebarBtn label="Overview" active />
            <SidebarBtn label="Entities" />
            <SidebarBtn label="Logs" />
          </div>

          {/* Center Main panel (3 cols) */}
          <div className="md:col-span-3 space-y-6">
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="Analyzed Programs" val="8" icon={<Layers className="w-4 h-4 text-stone-600" />} />
              <StatCard label="Crawl Confidence" val="94.2%" icon={<ShieldCheck className="w-4 h-4 text-stone-600" />} />
              <StatCard label="Storage Status" val="Optimal" icon={<Database className="w-4 h-4 text-stone-600" />} />
            </div>

            {/* Ingestion Feed */}
            <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-stone-450 uppercase tracking-widest">Ingestion Monitor</h3>
              <p className="text-xs text-stone-500">
                All background threads are synchronized. No active crawl warnings.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarBtn({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <button className={`w-full text-left text-xs px-3 py-2 rounded-lg transition-all ${
      active ? "bg-stone-100 text-stone-900 font-semibold" : "text-stone-500 hover:bg-stone-50"
    }`}>
      {label}
    </button>
  );
}

function StatCard({ label, val, icon }: { label: string; val: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-2 flex justify-between items-start">
      <div className="space-y-1">
        <span className="text-[10px] text-stone-400 uppercase block font-medium">{label}</span>
        <span className="text-lg font-bold text-stone-900">{val}</span>
      </div>
      <div className="bg-stone-50 border border-stone-200/60 p-2 rounded-lg">{icon}</div>
    </div>
  );
}
