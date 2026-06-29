"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Loader2, Clock, CornerDownLeft, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchPrograms } from "@/lib/api";
import type { Program } from "@/types/api";

interface ProgramInputProps {
  initialValue?: string;
  onSubmit: (input: string | string[]) => void;
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

/** ── Self-contained single input row with autocomplete ── */
interface InputRowProps {
  value: string;
  onChange: (val: string) => void;
  onSelectSuggestion?: (prog: Program) => void;
  placeholder: string;
  onRemove?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

function ProgramInputRow({
  value,
  onChange,
  onSelectSuggestion,
  placeholder,
  onRemove,
  disabled = false,
  autoFocus = false,
}: InputRowProps) {
  const [suggestions, setSuggestions] = useState<Program[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search
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

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(prog: Program) {
    onChange(prog.name);
    setShowDropdown(false);
    setHighlightedIndex(-1);
    if (onSelectSuggestion) {
      onSelectSuggestion(prog);
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
    } else if (e.key === "Enter") {
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        e.preventDefault();
        handleSelect(suggestions[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
      setHighlightedIndex(-1);
    }
  }

  return (
    <div ref={containerRef} className="relative flex items-center gap-2 w-full">
      <div className="relative flex-1">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
          size={15}
          strokeWidth={1.5}
        />
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowDropdown(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => { if ((value || "").trim().length >= 2) setShowDropdown(true); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-9 h-10 text-xs bg-white border-border"
          disabled={disabled}
          autoFocus={autoFocus}
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 size={12} className="animate-spin text-stone-400" />
          </div>
        )}
      </div>

      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={disabled}
          className="h-10 w-10 text-stone-400 hover:text-red-500 hover:bg-red-50/50 shrink-0"
        >
          <Trash2 size={14} strokeWidth={1.5} />
        </Button>
      )}

      {/* Autocomplete Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-50 overflow-y-auto max-h-48 divide-y divide-stone-100 animate-in fade-in slide-in-from-top-1 duration-100">
          {suggestions.map((prog, idx) => {
            const completedAt = prog.completed_at ?? prog.created_at;
            const isHighlighted = idx === highlightedIndex;
            return (
              <div
                key={prog.id}
                onClick={() => handleSelect(prog)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`px-4 py-2 flex items-center justify-between cursor-pointer transition-colors ${
                  isHighlighted ? "bg-stone-55 text-[#0F766E]" : "bg-white text-stone-700"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Clock size={12} className="text-stone-450 shrink-0" />
                  <span className="text-xs font-medium text-stone-700 truncate">{prog.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[9px] font-mono text-stone-400">
                    {formatRelative(completedAt)}
                  </span>
                  {isHighlighted && (
                    <CornerDownLeft size={9} className="text-[#0F766E]" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** ── Main Component containing segmented Mode Switcher ── */
export function ProgramInput({
  initialValue = "",
  onSubmit,
  onSelectExisting,
  isLoading = false,
}: ProgramInputProps) {
  const [mode, setMode] = useState<"single" | "compare">("single");
  const [singleValue, setSingleValue] = useState(initialValue || "");
  const [compareValues, setCompareValues] = useState<string[]>(["", ""]);

  // Sync initialValue for single program loads
  useEffect(() => {
    if (initialValue && typeof initialValue === "string") {
      if (initialValue.includes(",")) {
        setMode("compare");
        setCompareValues(initialValue.split(",").map(v => v.trim()).filter(Boolean));
      } else {
        setMode("single");
        setSingleValue(initialValue);
      }
    } else {
      setSingleValue("");
    }
  }, [initialValue]);

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading) return;

    if (mode === "single") {
      const val = (singleValue || "").trim();
      if (val) onSubmit(val);
    } else {
      const valid = compareValues.map((v) => (v || "").trim()).filter(Boolean);
      if (valid.length >= 2) {
        onSubmit(valid);
      }
    }
  }

  function addCompareRow() {
    setCompareValues([...compareValues, ""]);
  }

  function removeCompareRow(idx: number) {
    setCompareValues(compareValues.filter((_, i) => i !== idx));
  }

  function updateCompareRow(idx: number, val: string) {
    const updated = [...compareValues];
    updated[idx] = val;
    setCompareValues(updated);
  }

  const isCompareReady = compareValues.map((v) => (v || "").trim()).filter(Boolean).length >= 2;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Mode Switcher */}
      <div className="flex justify-center">
        <div className="inline-flex bg-stone-100/80 border border-stone-200/40 p-0.5 rounded-xl">
          <button
            type="button"
            onClick={() => setMode("single")}
            disabled={isLoading}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mode === "single"
                ? "bg-white text-stone-900 shadow-sm border border-stone-200/50"
                : "text-stone-500 hover:text-stone-850"
            }`}
          >
            Single Program Analysis
          </button>
          <button
            type="button"
            onClick={() => setMode("compare")}
            disabled={isLoading}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mode === "compare"
                ? "bg-white text-stone-900 shadow-sm border border-stone-200/50"
                : "text-stone-500 hover:text-stone-800"
            }`}
          >
            Comparative Workspace
          </button>
        </div>
      </div>

      {/* Main input form */}
      <form onSubmit={handleFormSubmit} className="bg-white border border-border rounded-2xl p-5 shadow-sm space-y-4">
        {mode === "single" ? (
          <div className="flex items-center gap-3">
            <ProgramInputRow
              value={singleValue}
              onChange={setSingleValue}
              onSelectSuggestion={(prog) => {
                setSingleValue(prog.name);
                if (onSelectExisting) {
                  onSelectExisting(prog);
                } else {
                  onSubmit(prog.name);
                }
              }}
              placeholder="Enter program name (e.g. Starbucks Rewards)"
              disabled={isLoading}
              autoFocus
            />
            <Button
              type="submit"
              disabled={!(singleValue || "").trim() || isLoading}
              className="h-10 px-6 bg-[#0F766E] hover:bg-[#0d6b63] text-white text-xs font-semibold shrink-0 rounded-lg shadow-sm"
            >
              {isLoading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                "Analyze"
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <span className="text-[10px] text-stone-400 font-medium block uppercase tracking-wider pl-1">
              Comparison Targets (min. 2)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pb-2">
              {compareValues.map((val, idx) => (
                <div key={idx} className="w-full">
                  <ProgramInputRow
                    value={val}
                    onChange={(val) => updateCompareRow(idx, val)}
                    onSelectSuggestion={(prog) => updateCompareRow(idx, prog.name)}
                    placeholder={`Program #${idx + 1}`}
                    onRemove={compareValues.length > 2 ? () => removeCompareRow(idx) : undefined}
                    disabled={isLoading}
                    autoFocus={idx === compareValues.length - 1 && idx > 1}
                  />
                </div>
              ))}
            </div>

            {/* Actions row */}
            <div className="flex items-center justify-between border-t border-stone-100 pt-3 mt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCompareRow}
                disabled={isLoading}
                className="h-8 text-xs gap-1 text-stone-600 border-border rounded-lg"
              >
                <Plus size={12} strokeWidth={2} />
                Add Program
              </Button>

              <Button
                type="submit"
                disabled={!isCompareReady || isLoading}
                className="h-8 px-5 bg-[#0F766E] hover:bg-[#0d6b63] text-white text-xs font-semibold rounded-lg shadow-sm"
              >
                {isLoading ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 size={12} className="animate-spin" />
                    Comparing…
                  </span>
                ) : (
                  `Compare ${compareValues.filter(v => v.trim()).length} Programs`
                )}
              </Button>
            </div>
          </div>
        )}
      </form>
      <p className="text-[10px] text-stone-400 text-center">
        {mode === "single" 
          ? "InfoVac discovers web sources, extracts 44 fields, and creates a competitive intelligence brief."
          : "Add multiple targets to cross-evaluate parameters and output strategic competitive recommendations."
        }
      </p>
    </div>
  );
}
