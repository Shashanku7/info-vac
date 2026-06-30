"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface GateDonutChartProps {
  passed: number;
  failed: number;
}

const COLORS = ["#10b981", "rgba(255,255,255,0.08)"];

export function GateDonutChart({ passed, failed }: GateDonutChartProps) {
  const total = passed + failed;
  const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : "—";

  const data = [
    { name: "Passed", value: passed },
    { name: "Rejected", value: failed },
  ];

  return (
    <div
      className="rounded-[10px] p-4 transition-all flex flex-col justify-between h-full"
      style={{
        backgroundColor: "var(--kobie-ocean)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div>
        <div
          className="text-[10px] font-bold uppercase tracking-wider mb-2"
          style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--kobie-font-heading)" }}
        >
          Gate Verification
        </div>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={22}
                  outerRadius={34}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    fontSize: 10,
                    backgroundColor: "#051c2c",
                    borderColor: "rgba(255,255,255,0.12)",
                    color: "#fff",
                    borderRadius: "4px"
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-xl font-black text-white" style={{ fontFamily: "var(--kobie-font-heading)" }}>{passRate}%</p>
              <p className="text-[10px] uppercase font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>pass rate</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ backgroundColor: "#10b981" }} />
                <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.6)" }}>{passed} passed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />
                <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.6)" }}>{failed} rejected</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Validation Insight Footer */}
      <div className="pt-2.5 mt-2.5 flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="text-[9px] text-white/35 font-mono">Z-Gate Validation Active</span>
        <span className="text-[9px] text-[#10b981] font-bold">Passed {passed}/{total}</span>
      </div>
    </div>
  );
}
