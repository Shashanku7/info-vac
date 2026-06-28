"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ConfidenceBarChartProps {
  avgCorroboration: number;
  avgAuthority: number;
  avgRecency: number;
  avgConfidence: number;
}

export function ConfidenceBarChart({
  avgCorroboration,
  avgAuthority,
  avgRecency,
  avgConfidence,
}: ConfidenceBarChartProps) {
  const data = [
    { name: "Corroboration", value: avgCorroboration, weight: "50%" },
    { name: "Authority", value: avgAuthority, weight: "30%" },
    { name: "Recency", value: avgRecency, weight: "20%" },
    { name: "Composite", value: avgConfidence, weight: "—" },
  ];

  const BAR_COLORS = ["#0F766E", "#0F766E", "#0F766E", "#F59E0B"];

  return (
    <Card className="border-border shadow-none">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          Confidence Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barSize={18} margin={{ left: -20 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "#A8A29E" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 1]}
                tick={{ fontSize: 10, fill: "#A8A29E" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${Math.round(v * 100)}%`}
              />
              <Tooltip
                contentStyle={{ fontSize: 11, border: "1px solid #E7E5E4" }}
                formatter={(v) => [`${((v as number ?? 0) * 100).toFixed(1)}%`]}
              />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {data.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Formula: 0.5 × corroboration + 0.3 × authority + 0.2 × recency
        </p>
      </CardContent>
    </Card>
  );
}
