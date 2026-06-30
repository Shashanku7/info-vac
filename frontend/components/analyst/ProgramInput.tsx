"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Loader2, Clock, CornerDownLeft, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchPrograms } from "@/lib/api";
import type { Program } from "@/types/api";

interface ProgramInputProps {
  initialValue?: string;
  onSubmit: (input: string | string[]) => void;
  onSelectExisting?: (program: Program) => void;
  isLoading?: boolean;
  isMultiFlow: boolean;
  onModeChange: (isMultiFlow: boolean) => void;
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

interface InputRowProps {
  value: string;
  onChange: (val: string) => void;
  onSelectSuggestion?: (prog: Program) => void;
  onCompareClick?: (prog: Program) => void;
  placeholder: string;
  onRemove?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

function getBrandEmoji(name: string): string {
  const ln = name.toLowerCase();
  if (ln.includes("starbucks")) return "☕";
  if (ln.includes("marriott") || ln.includes("hotel") || ln.includes("hilton") || ln.includes("hyatt")) return "🏨";
  if (ln.includes("delta") || ln.includes("airline") || ln.includes("flyer") || ln.includes("miles")) return "✈️";
  if (ln.includes("sephora") || ln.includes("beauty") || ln.includes("cosmetic")) return "💄";
  if (ln.includes("dunkin")) return "🍩";
  if (ln.includes("target")) return "🎯";
  if (ln.includes("best buy")) return "💻";
  return "⭐";
}


function ProgramInputRow({
  value,
  onChange,
  onSelectSuggestion,
  onCompareClick,
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
          className="absolute left-4 top-1/2 -translate-y-1/2"
          size={16}
          strokeWidth={1.5}
          style={{ color: "rgba(255,255,255,0.3)" }}
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
          className="pl-11 h-11 text-sm rounded-[8px] bg-slate-950/20 border-[rgba(255,255,255,0.08)] focus-visible:ring-[#fd7f4f] focus-visible:ring-1 focus-visible:border-[#fd7f4f] transition-all"
          disabled={disabled}
          autoFocus={autoFocus}
        />
        {isSearching && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <Loader2 size={14} className="animate-spin" style={{ color: "rgba(255,255,255,0.3)" }} />
          </div>
        )}
      </div>

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="h-10 w-10 flex items-center justify-center rounded-[6px] transition-colors shrink-0"
          style={{ color: "rgba(255,255,255,0.3)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
        >
          <Trash2 size={14} strokeWidth={1.5} />
        </button>
      )}

      {/* Autocomplete Dropdown — Kobie ocean style */}
      {showDropdown && suggestions.length > 0 && (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-50 overflow-y-auto max-h-60 rounded-[8px] shadow-2xl flex flex-col text-left"
          style={{
            backgroundColor: "#0d2d3f",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          {suggestions.map((prog, idx) => {
            const completedAt = prog.completed_at ?? prog.created_at;
            const isHighlighted = idx === highlightedIndex;
            const emoji = getBrandEmoji(prog.name);
            return (
              <div
                key={prog.id}
                onClick={() => handleSelect(prog)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className="px-4 py-2.5 flex items-center justify-between cursor-pointer transition-all border-b border-[rgba(255,255,255,0.06)]"
                style={{
                  backgroundColor: isHighlighted ? "rgba(253,127,79,0.1)" : "transparent",
                }}
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs shrink-0">{emoji}</span>
                    <span
                      className="text-[11px] font-bold truncate"
                      style={{ color: isHighlighted ? "#fd7f4f" : "rgba(255,255,255,0.9)" }}
                    >
                      {prog.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[9px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                    <span>{onCompareClick ? "Already analyzed" : "Cached"}</span>
                    <span>·</span>
                    <span className="text-emerald-400 font-semibold">91% verified</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[9px] font-mono text-white/30">
                    {isHighlighted ? (onCompareClick ? "Open instantly →" : "Select target →") : formatRelative(completedAt)}
                  </span>
                  {isHighlighted && (
                    <CornerDownLeft size={9} style={{ color: "#fd7f4f" }} />
                  )}
                </div>
              </div>
            );
          })}

          {highlightedIndex >= 0 && onCompareClick && (
            <>
              <div className="h-px bg-white/5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
              <div
                className="px-4 py-2.5 text-[10px] cursor-pointer hover:bg-white/5 transition-colors text-white/60 flex items-center justify-between"
                onClick={() => {
                  const prog = suggestions[highlightedIndex];
                  onCompareClick(prog);
                  setShowDropdown(false);
                }}
              >
                <span className="flex items-center gap-1.5 truncate pr-2">
                  <span>⚔️</span> Compare <span className="font-bold text-white truncate">{suggestions[highlightedIndex].name}</span> with another...
                </span>
                <span className="text-[#fd7f4f] shrink-0 font-semibold font-mono text-[9px]">Compare Mode →</span>
              </div>
            </>
          )}

          <div
            className="px-4 py-2 text-[9px] text-white/35 font-medium flex items-center justify-between bg-black/20"
            onClick={() => setShowDropdown(false)}
          >
            <span>Press Enter to analyze live instead</span>
            <span>⚡ Real-time</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** ── Main Component ── */
export function ProgramInput({
  initialValue = "",
  onSubmit,
  onSelectExisting,
  isLoading = false,
  isMultiFlow,
  onModeChange,
}: ProgramInputProps) {
  const mode = isMultiFlow ? "compare" : "single";
  const setMode = (m: "single" | "compare") => onModeChange(m === "compare");
  const [singleValue, setSingleValue] = useState(initialValue || "");
  const [compareValues, setCompareValues] = useState<string[]>(["", ""]);

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
    <div className="w-full space-y-3.5 flex flex-col justify-start">

      {/* ── Mode Switcher — Kobie dark pill left aligned ── */}
      <div className="flex justify-start shrink-0">
        <div
          className="inline-flex p-0.5 rounded-[8px]"
          style={{
            backgroundColor: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {(["single", "compare"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              disabled={isLoading}
              className="px-5 py-1.5 rounded-[6px] text-xs font-bold transition-all duration-200 disabled:opacity-40"
              style={{
                fontFamily: "var(--kobie-font-heading)",
                backgroundColor: mode === m ? "#fd7f4f" : "transparent",
                color: mode === m ? "#ffffff" : "rgba(255,255,255,0.45)",
              }}
            >
              {m === "single" ? "Single Program" : "Compare Programs"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main form — tight content ocean card ── */}
      <form
        onSubmit={handleFormSubmit}
        className="rounded-[10px] p-4 flex flex-col justify-between shrink-0"
        style={{
          backgroundColor: "var(--kobie-ocean)",
          border: "1px solid rgba(255,255,255,0.1)",
          minHeight: "72px",
        }}
      >
        {mode === "single" ? (
          <div className="flex items-center gap-3 w-full">
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
              onCompareClick={(prog) => {
                setMode("compare");
                setCompareValues([prog.name, ""]);
              }}
              placeholder="Enter program name (e.g. Starbucks Rewards)"
              disabled={isLoading}
              autoFocus
            />
            <button
              type="submit"
              disabled={!(singleValue || "").trim() || isLoading}
              className="h-11 px-6 font-bold text-sm shrink-0 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              style={{
                fontFamily: "var(--kobie-font-heading)",
                backgroundColor: (singleValue || "").trim() ? "#fd7f4f" : "rgba(255,255,255,0.05)",
                borderColor: (singleValue || "").trim() ? "#fd7f4f" : "rgba(255,255,255,0.08)",
                color: (singleValue || "").trim() ? "#ffffff" : "rgba(255,255,255,0.35)",
                borderRadius: "8px",
                border: "1px solid",
              }}
              onMouseEnter={e => {
                if ((singleValue || "").trim() && !isLoading) {
                  e.currentTarget.style.backgroundColor = "#f56d38";
                  e.currentTarget.style.borderColor = "#f56d38";
                }
              }}
              onMouseLeave={e => {
                if ((singleValue || "").trim() && !isLoading) {
                  e.currentTarget.style.backgroundColor = "#fd7f4f";
                  e.currentTarget.style.borderColor = "#fd7f4f";
                }
              }}
            >
              {isLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                "Analyze →"
              )}
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <span
                className="text-[10px] font-bold block uppercase tracking-widest pl-1"
                style={{ color: "var(--kobie-coral)", fontFamily: "var(--kobie-font-heading)" }}
              >
                Comparison Targets (min. 2)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            </div>

            <div
              className="flex items-center justify-between pt-3 mt-auto"
              style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
            >
              <button
                type="button"
                onClick={addCompareRow}
                disabled={isLoading}
                className="h-8 px-3 text-xs font-bold flex items-center gap-1.5 rounded-[6px] transition-all duration-200 disabled:opacity-40 cursor-pointer"
                style={{
                  fontFamily: "var(--kobie-font-heading)",
                  color: "rgba(255,255,255,0.5)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "transparent",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.color = "#fd7f4f";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(253,127,79,0.4)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)";
                }}
              >
                <Plus size={12} strokeWidth={2} />
                Add Program
              </button>

              <button
                type="submit"
                disabled={!isCompareReady || isLoading}
                className="h-9 px-5 text-xs font-bold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                style={{
                  fontFamily: "var(--kobie-font-heading)",
                  backgroundColor: isCompareReady ? "#fd7f4f" : "rgba(255,255,255,0.05)",
                  borderColor: isCompareReady ? "#fd7f4f" : "rgba(255,255,255,0.08)",
                  color: isCompareReady ? "#ffffff" : "rgba(255,255,255,0.35)",
                  borderRadius: "6px",
                  border: "1px solid",
                }}
                onMouseEnter={e => {
                  if (isCompareReady && !isLoading) {
                    e.currentTarget.style.backgroundColor = "#f56d38";
                    e.currentTarget.style.borderColor = "#f56d38";
                  }
                }}
                onMouseLeave={e => {
                  if (isCompareReady && !isLoading) {
                    e.currentTarget.style.backgroundColor = "#fd7f4f";
                    e.currentTarget.style.borderColor = "#fd7f4f";
                  }
                }}
              >
                {isLoading ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 size={11} className="animate-spin" />
                    Comparing…
                  </span>
                ) : (
                  `Compare ${compareValues.filter(v => v.trim()).length} Programs →`
                )}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
