"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Loader2, Clock, CornerDownLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchPrograms } from "@/lib/api";
import type { Program } from "@/types/api";

interface ProgramInputProps {
  initialValue?: string;
  onSubmit: (name: string) => void;
  onSelectExisting?: (program: Program) => void;
  isLoading?: boolean;
}

function formatRelative(isoDate: string): string {
  const d = new Date(isoDate);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function ProgramInput({ initialValue = "", onSubmit, onSelectExisting, isLoading = false }: ProgramInputProps) {
  const [value, setValue] = useState(initialValue);

  // Sync value when initialValue changes (e.g. program loads)
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);
  const [suggestions, setSuggestions] = useState<Program[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search for suggestions
  useEffect(() => {
    const query = value.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const delayDebounceFn = setTimeout(() => {
      searchPrograms(query)
        .then((data) => {
          setSuggestions(data);
        })
        .finally(() => {
          setIsSearching(false);
        });
    }, 200);

    return () => clearTimeout(delayDebounceFn);
  }, [value]);

  // Click outside listener to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = value.trim();
    if (!name || isLoading) return;

    if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
      handleSelect(suggestions[highlightedIndex]);
    } else {
      onSubmit(name);
      setShowDropdown(false);
    }
  }

  function handleSelect(prog: Program) {
    setValue(prog.name);
    setShowDropdown(false);
    setHighlightedIndex(-1);
    if (onSelectExisting) {
      onSelectExisting(prog);
    } else {
      onSubmit(prog.name);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
      setHighlightedIndex(-1);
    }
  }

  return (
    <div ref={containerRef} className="w-full max-w-2xl mx-auto relative">
      <form onSubmit={handleFormSubmit} className="relative flex items-center gap-3">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={16}
            strokeWidth={1.5}
          />
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setShowDropdown(true);
              setHighlightedIndex(-1);
            }}
            onFocus={() => setShowDropdown(true)}
            onKeyDown={handleKeyDown}
            placeholder="Enter loyalty program name (e.g. Starbucks Rewards)"
            className="pl-9 h-11 text-sm bg-white border-border"
            disabled={isLoading}
            autoFocus
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 size={14} className="animate-spin text-stone-400" />
            </div>
          )}
        </div>
        <Button
          type="submit"
          disabled={!value.trim() || isLoading}
          className="h-11 px-6 bg-[#0F766E] hover:bg-[#0d6b63] text-white text-sm font-medium shrink-0"
        >
          {isLoading ? (
            <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
          ) : (
            "Analyze"
          )}
        </Button>
      </form>

      {/* Autocomplete Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div
          className="absolute left-0 right-0 mt-1.5 bg-white border border-stone-200 rounded-xl shadow-lg z-50 overflow-y-auto max-h-60 divide-y divide-stone-100 animate-in fade-in slide-in-from-top-1 duration-100"
          style={{ width: "calc(100% - 100px)" }} // align with input width
        >
          {suggestions.map((prog, idx) => {
            const completedAt = prog.completed_at ?? prog.created_at;
            const isHighlighted = idx === highlightedIndex;
            return (
              <div
                key={prog.id}
                onClick={() => handleSelect(prog)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-colors ${
                  isHighlighted ? "bg-stone-100 text-[#0F766E]" : "bg-white text-stone-700"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Clock size={13} className="text-stone-400 shrink-0" />
                  <span className="text-sm font-medium text-stone-700 truncate">{prog.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-mono text-stone-400">
                    Extracted {formatRelative(completedAt)}
                  </span>
                  {isHighlighted && (
                    <CornerDownLeft size={10} className="text-[#0F766E]" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-2 text-xs text-muted-foreground text-center">
        InfoVac will discover sources, extract 44 fields, and generate an analyst brief.
      </p>
    </div>
  );
}
