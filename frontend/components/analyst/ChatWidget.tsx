"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, Send, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { ChatMessage } from "@/types/api";

const QUICK_PROMPTS = [
  "Summarize the earn mechanics",
  "What are the top tier benefits?",
  "What changed recently?",
  "Compare the tiers",
  "What are members complaining about?",
];

interface ChatWidgetProps {
  programId: string;
  messages: ChatMessage[];
  isLoading: boolean;
  onSend: (message: string) => void;
}

export function ChatWidget({ programId, messages, isLoading, onSend }: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [dimensions, setDimensions] = useState({ width: 380, height: 520 });
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef<"w" | "h" | "nw" | null>(null);
  const startPosRef = useRef({ x: 0, y: 0, w: 380, h: 520 });

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    }
  }, [messages, open]);

  // Clean up resize listeners
  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent, type: "w" | "h" | "nw") => {
    e.preventDefault();
    isResizingRef.current = type;
    startPosRef.current = {
      x: e.clientX,
      y: e.clientY,
      w: dimensions.width,
      h: dimensions.height,
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizingRef.current) return;
    const deltaX = e.clientX - startPosRef.current.x;
    const deltaY = e.clientY - startPosRef.current.y;

    let newW = startPosRef.current.w;
    let newH = startPosRef.current.h;

    // Aligned right: moving mouse left (negative deltaX) increases width
    if (isResizingRef.current === "w" || isResizingRef.current === "nw") {
      newW = Math.max(340, Math.min(800, startPosRef.current.w - deltaX));
    }
    // Aligned bottom: moving mouse up (negative deltaY) increases height
    if (isResizingRef.current === "h" || isResizingRef.current === "nw") {
      newH = Math.max(360, Math.min(850, startPosRef.current.h - deltaY));
    }

    setDimensions({ width: newW, height: newH });
  };

  const handleMouseUp = () => {
    isResizingRef.current = null;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const msg = input.trim();
    if (!msg || isLoading) return;
    setInput("");
    onSend(msg);
  }

  // Simple Markdown Parsing Helper
  function renderMessageContent(content: string, role: string) {
    if (!content) return null;
    const isUser = role === "user";
    const lines = content.split("\n");

    return (
      <div className="space-y-1.5">
        {lines.map((line, lineIdx) => {
          const isBullet = line.trim().startsWith("* ") || line.trim().startsWith("- ");
          const isNumbered = /^\d+\.\s/.test(line.trim());

          let cleanLine = line;
          if (isBullet) {
            cleanLine = line.trim().substring(2);
          } else if (isNumbered) {
            const match = line.match(/^(\d+\.\s)(.*)/);
            if (match) {
              cleanLine = match[2];
            }
          }

          // Replace bold (**text**), italics (*text*), and code (`text`)
          const parts = [];
          const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
          let match;
          let lastIdx = 0;

          while ((match = regex.exec(cleanLine)) !== null) {
            const start = match.index;
            const matchedText = match[0];

            if (start > lastIdx) {
              parts.push(cleanLine.substring(lastIdx, start));
            }

            if (matchedText.startsWith("**") && matchedText.endsWith("**")) {
              parts.push(
                <strong key={start} className={`font-semibold ${isUser ? "text-white" : "text-stone-900"}`}>
                  {matchedText.slice(2, -2)}
                </strong>
              );
            } else if (matchedText.startsWith("*") && matchedText.endsWith("*")) {
              parts.push(<em key={start} className="italic">{matchedText.slice(1, -1)}</em>);
            } else if (matchedText.startsWith("`") && matchedText.endsWith("`")) {
              parts.push(
                <code key={start} className={`px-1 py-0.5 rounded font-mono text-[10px] ${
                  isUser ? "bg-teal-800 text-teal-100" : "bg-stone-200 text-stone-900"
                }`}>
                  {matchedText.slice(1, -1)}
                </code>
              );
            }

            lastIdx = regex.lastIndex;
          }

          if (lastIdx < cleanLine.length) {
            parts.push(cleanLine.substring(lastIdx));
          }

          if (isBullet) {
            return (
              <ul key={lineIdx} className="list-disc pl-4 space-y-0.5">
                <li className={`text-[11px] leading-normal ${isUser ? "text-white" : "text-stone-700"}`}>
                  {parts}
                </li>
              </ul>
            );
          }

          if (isNumbered) {
            const numStr = line.match(/^(\d+\.)\s/)?.[1] || "";
            return (
              <div key={lineIdx} className={`flex gap-1.5 text-[11px] leading-normal pl-1 ${
                isUser ? "text-white" : "text-stone-700"
              }`}>
                <span className={`font-bold shrink-0 ${isUser ? "text-white" : "text-[#0F766E]"}`}>
                  {numStr}
                </span>
                <div>{parts}</div>
              </div>
            );
          }

          return (
            <p key={lineIdx} className={`text-[11px] leading-normal min-h-[1em] ${
              isUser ? "text-white" : "text-stone-700"
            }`}>
              {parts}
            </p>
          );
        })}
      </div>
    );
  }

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-[#0F766E] text-white shadow-md flex items-center justify-center hover:bg-[#0d6b63] transition-colors"
        aria-label="Toggle chat"
      >
        {open ? (
          <ChevronDown size={18} strokeWidth={1.5} />
        ) : (
          <MessageCircle size={18} strokeWidth={1.5} />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div 
          className="fixed bottom-24 right-6 z-50 bg-white border border-border rounded-xl shadow-md flex flex-col overflow-hidden select-none"
          style={{ 
            width: `${dimensions.width}px`, 
            height: `${dimensions.height}px`,
            maxHeight: "85vh",
            maxWidth: "90vw"
          }}
        >
          {/* Resize handles */}
          {/* Top-left diagonal corner grip */}
          <div
            onMouseDown={(e) => handleMouseDown(e, "nw")}
            className="absolute top-0 left-0 w-3 h-3 cursor-nwse-resize z-50 flex items-center justify-center group"
          >
            <div className="w-1.5 h-1.5 border-t border-l border-stone-400 group-hover:border-stone-600 transition-colors" />
          </div>
          {/* Left border resize bar */}
          <div
            onMouseDown={(e) => handleMouseDown(e, "w")}
            className="absolute top-0 left-0 w-1.5 h-full cursor-ew-resize z-40 hover:bg-stone-200/50 transition-colors"
          />
          {/* Top border resize bar */}
          <div
            onMouseDown={(e) => handleMouseDown(e, "h")}
            className="absolute top-0 left-0 w-full h-1.5 cursor-ns-resize z-40 hover:bg-stone-200/50 transition-colors"
          />

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-stone-50 shrink-0">
            <div>
              <p className="text-xs font-semibold text-stone-900">Program Chat</p>
              <p className="text-[10px] text-muted-foreground">Grounded Q&amp;A — no hallucinations</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setOpen(false)}
            >
              <X size={13} strokeWidth={1.5} />
            </Button>
          </div>

          {/* Messages scroll box */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 select-text">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-3">
                  Ask anything about this program. Try:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PROMPTS.map((p) => (
                    <Badge
                      key={p}
                      variant="outline"
                      className="cursor-pointer text-[10px] hover:bg-stone-100 transition-colors"
                      onClick={() => onSend(p)}
                    >
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[#0F766E] text-white shadow-sm"
                        : "bg-stone-100 text-stone-800 border border-border shadow-sm"
                    }`}
                  >
                    {renderMessageContent(msg.content, msg.role)}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-stone-100 border border-border rounded-lg px-3 py-2">
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce [animation-delay:300ms]" />
                    </span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input Form */}
          <form
            onSubmit={handleSend}
            className="flex items-center gap-2 px-3 py-3 border-t border-border shrink-0 bg-white"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about this program…"
              className="h-8 text-xs flex-1"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              className="h-8 w-8 bg-[#0F766E] hover:bg-[#0d6b63] shrink-0"
              disabled={!input.trim() || isLoading}
            >
              <Send size={13} strokeWidth={1.5} />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
