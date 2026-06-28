"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";

interface CostCardProps {
  totalCost: number; // USD
  programCount: number;
}

export function CostCard({ totalCost, programCount }: CostCardProps) {
  const avgCost = programCount > 0 ? totalCost / programCount : 0;

  return (
    <Card className="border-border shadow-none">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <DollarSign size={13} strokeWidth={1.5} />
          Extraction Cost
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-1">
        <p className="text-2xl font-semibold text-stone-900">
          ${totalCost.toFixed(4)}
        </p>
        <p className="text-xs text-muted-foreground">
          {programCount} program{programCount !== 1 ? "s" : ""} ·{" "}
          avg ${avgCost.toFixed(4)} each
        </p>
      </CardContent>
    </Card>
  );
}
