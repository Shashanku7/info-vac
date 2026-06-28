"use client";

import { useState, useRef } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ProgramInputProps {
  onSubmit: (name: string) => void;
  isLoading?: boolean;
}

export function ProgramInput({ onSubmit, isLoading = false }: ProgramInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = value.trim();
    if (!name || isLoading) return;
    onSubmit(name);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="relative flex items-center gap-3">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={16}
            strokeWidth={1.5}
          />
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter loyalty program name (e.g. Starbucks Rewards)"
            className="pl-9 h-11 text-sm bg-white border-border"
            disabled={isLoading}
            autoFocus
          />
        </div>
        <Button
          type="submit"
          disabled={!value.trim() || isLoading}
          className="h-11 px-6 bg-[#0F766E] hover:bg-[#0d6b63] text-white text-sm font-medium"
        >
          {isLoading ? (
            <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
          ) : (
            "Analyze"
          )}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground text-center">
        InfoVac will discover sources, extract 44 fields, and generate an analyst brief.
      </p>
    </form>
  );
}
