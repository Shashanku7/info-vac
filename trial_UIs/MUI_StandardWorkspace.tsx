"use client";

import { Activity, ShieldAlert, Layers } from "lucide-react";

export default function MUIStandardWorkspace() {
  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#2c3e50] p-8 font-sans antialiased">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center bg-[#1976d2] text-white p-6 rounded-xl shadow-lg">
          <div>
            <span className="text-[10px] text-blue-100 font-mono tracking-widest uppercase block mb-1">MUI STANDARD // TEMPLATE</span>
            <h1 className="text-xl font-bold tracking-tight uppercase">MUI Control Panel</h1>
          </div>
        </div>

        {/* elevated cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MuiCard title="Storage Nodes" val="18 Documents" icon={<Layers className="w-5 h-5 text-[#1976d2]" />} />
          <MuiCard title="Verification Gate" val="98% Success" icon={<ShieldAlert className="w-5 h-5 text-amber-600" />} />
          <MuiCard title="Network Diagnostics" val="Optimal" icon={<Activity className="w-5 h-5 text-emerald-600" />} />
        </div>
      </div>
    </div>
  );
}

function MuiCard({ title, val, icon }: { title: string; val: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow duration-300 border border-stone-200/40 flex justify-between items-start">
      <div className="space-y-1">
        <span className="text-[10px] font-bold text-stone-400 uppercase block">{title}</span>
        <span className="text-lg font-bold text-stone-800">{val}</span>
      </div>
      <div className="bg-stone-50 border border-stone-200/60 p-2.5 rounded-lg">{icon}</div>
    </div>
  );
}
