"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface GateDonutChartProps {
  passed: number;
  failed: number;
}

const COLORS = ["#0F766E", "#E7E5E4"];

export function GateDonutChart({ passed, failed }: GateDonutChartProps) {
  const total = passed + failed;
  const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : "—";

  const data = [
    { name: "Passed", value: passed },
    { name: "Rejected", value: failed },
  ];

  return (
    <Card className="border-border shadow-none">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          Gate Verification
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={28}
                  outerRadius={40}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 11, border: "1px solid #E7E5E4" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-xl font-semibold text-stone-900">{passRate}%</p>
              <p className="text-xs text-muted-foreground">pass rate</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-[#0F766E] shrink-0" />
                <span className="text-xs text-stone-600">{passed} passed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-stone-200 shrink-0" />
                <span className="text-xs text-stone-600">{failed} rejected</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
