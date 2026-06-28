"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import { ArrowUpDown, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ExtractedField } from "@/types/api";

const col = createColumnHelper<ExtractedField>();

const columns = [
  col.accessor("category", {
    header: "Category",
    cell: (info) => (
      <span className="text-xs text-muted-foreground">{info.getValue()}</span>
    ),
    size: 140,
  }),
  col.accessor("field_name", {
    header: "Field",
    cell: (info) => (
      <span className="text-xs font-medium text-stone-800">{info.getValue()}</span>
    ),
    size: 180,
  }),
  col.accessor("field_value", {
    header: "Value",
    cell: (info) => {
      const val = info.getValue();
      const row = info.row.original;
      if (!val || row.is_null) {
        return (
          <span className="text-xs italic text-muted-foreground">null</span>
        );
      }
      return (
        <span className="text-xs text-stone-700 line-clamp-2">{val}</span>
      );
    },
    size: 240,
  }),
  col.accessor("confidence", {
    header: "Confidence",
    cell: (info) => {
      const val = info.getValue();
      if (val == null)
        return <span className="text-xs text-muted-foreground">—</span>;
      const pct = Math.round(val * 100);
      const color =
        pct >= 70
          ? "text-[#16A34A]"
          : pct >= 40
          ? "text-amber-600"
          : "text-red-500";
      return (
        <span className={`text-xs font-medium ${color}`}>{pct}%</span>
      );
    },
    size: 90,
  }),
  col.accessor("gate_passed", {
    header: "Gate",
    cell: (info) => {
      const passed = info.getValue();
      if (passed == null)
        return <span className="text-xs text-muted-foreground">—</span>;
      return passed ? (
        <Badge className="text-[10px] h-5 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
          Pass
        </Badge>
      ) : (
        <Badge variant="destructive" className="text-[10px] h-5">
          Fail
        </Badge>
      );
    },
    size: 70,
  }),
  col.accessor("contradiction_flag", {
    header: "",
    cell: (info) =>
      info.getValue() ? (
        <span title="Contradiction detected">
          <AlertTriangle size={13} strokeWidth={1.5} className="text-red-500" />
        </span>
      ) : null,
    size: 36,
  }),
];

interface FieldsGridProps {
  fields: ExtractedField[];
}

export function FieldsGrid({ fields }: FieldsGridProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data: fields,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (fields.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
        No extracted fields available.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Input
        placeholder="Filter fields…"
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        className="h-8 text-xs max-w-xs"
      />

      <ScrollArea className="h-[480px] border border-border rounded-lg">
        <Table>
          <TableHeader className="sticky top-0 bg-stone-50 z-10">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="border-b border-border hover:bg-transparent">
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className="text-[11px] font-medium text-stone-500 py-2 px-3 cursor-pointer select-none"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <ArrowUpDown size={11} strokeWidth={1.5} className="text-stone-400" />
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="border-b border-border last:border-0 hover:bg-stone-50/50"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    style={{ width: cell.column.getSize() }}
                    className="py-2 px-3 align-top"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>

      <p className="text-xs text-muted-foreground">
        {table.getFilteredRowModel().rows.length} of {fields.length} fields
      </p>
    </div>
  );
}
