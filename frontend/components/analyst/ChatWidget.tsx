"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, Send, X, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { ChatMessage } from "@/types/api";

const SINGLE_QUICK_PROMPTS = [
  "Summarize the earn mechanics",
  "What are the top tier benefits?",
  "What changed recently?",
  "Compare the tiers",
  "What are members complaining about?",
];

const COMPARATIVE_QUICK_PROMPTS = [
  "What is the main differentiator between these programs?",
  "Compare their tier qualification criteria",
  "Which program has the better mobile app experience?",
  "Which program offers the best reward value?",
  "Compare their customer sentiment and complaints",
];

interface ChatWidgetProps {
  programId: string;
  messages: ChatMessage[];
  isLoading: boolean;
  onSend: (message: string) => void;
  isComparative?: boolean;
}

function getFollowUpSuggestions(text: string, isComparative: boolean, askedQuestions: string[]): string[] {
  const t = (text || "").toLowerCase();
  const suggestions: string[] = [];
  const normalizedAsked = askedQuestions.map(q => q.toLowerCase().replace(/[?.\s]/g, ""));

  const isDuplicate = (s: string) => {
    const norm = s.toLowerCase().replace(/[?.\s]/g, "");
    return normalizedAsked.includes(norm);
  };

  if (isComparative) {
    if (t.includes("tier") || t.includes("status") || t.includes("level")) {
      ["Which program has the easiest tier qualification?", "Compare their tier benefits side-by-side"].forEach(c => {
        if (!isDuplicate(c)) suggestions.push(c);
      });
    }
    if (t.includes("earn") || t.includes("point") || t.includes("reward")) {
      ["Which program offers better base earn rates?", "Are there bonus categories in either program?"].forEach(c => {
        if (!isDuplicate(c)) suggestions.push(c);
      });
    }
    if (t.includes("redeem") || t.includes("burn") || t.includes("threshold")) {
      ["Which program has a lower redemption threshold?", "How do point expiry policies compare?"].forEach(c => {
        if (!isDuplicate(c)) suggestions.push(c);
      });
    }
    if (t.includes("app") || t.includes("digital") || t.includes("mobile")) {
      ["Which program has the better mobile app rating?", "Compare their digital personalization features"].forEach(c => {
        if (!isDuplicate(c)) suggestions.push(c);
      });
    }
    if (t.includes("sentiment") || t.includes("complaint") || t.includes("praise")) {
      ["What are the key complaints for both?", "Which program is rated higher by members?"].forEach(c => {
        if (!isDuplicate(c)) suggestions.push(c);
      });
    }
    if (t.includes("partner") || t.includes("partnership")) {
      ["Which program has more partnerships?", "Compare their earn/burn partners"].forEach(c => {
        if (!isDuplicate(c)) suggestions.push(c);
      });
    }

    if (suggestions.length < 3) {
      const fallbacks = [
        "What is the main differentiator between these programs?",
        "Which program offers the best overall reward value?",
        "Summarize the key advantages of each",
        "Compare their qualification requirements"
      ];
      for (const f of fallbacks) {
        if (!isDuplicate(f) && !suggestions.includes(f)) {
          suggestions.push(f);
        }
        if (suggestions.length >= 3) break;
      }
    }
  } else {
    if (t.includes("tier") || t.includes("status") || t.includes("level")) {
      ["How do members qualify for the top tier?", "What are the qualification periods?"].forEach(c => {
        if (!isDuplicate(c)) suggestions.push(c);
      });
    }
    if (t.includes("earn") || t.includes("point") || t.includes("reward")) {
      ["What is the base earn rate?", "Can members earn on non-transactional actions?"].forEach(c => {
        if (!isDuplicate(c)) suggestions.push(c);
      });
    }
    if (t.includes("redeem") || t.includes("burn") || t.includes("threshold")) {
      ["What are the main redemption options?", "Do points expire in this program?"].forEach(c => {
        if (!isDuplicate(c)) suggestions.push(c);
      });
    }
    if (t.includes("app") || t.includes("digital") || t.includes("mobile")) {
      ["What is the mobile app store rating?", "Does the app support gamification?"].forEach(c => {
        if (!isDuplicate(c)) suggestions.push(c);
      });
    }
    if (t.includes("sentiment") || t.includes("complaint") || t.includes("praise")) {
      ["What are the most common member complaints?", "What do members praise most about the program?"].forEach(c => {
        if (!isDuplicate(c)) suggestions.push(c);
      });
    }
    if (t.includes("partner") || t.includes("partnership")) {
      ["Who are the key earn/burn partners?", "How do the partnerships work?"].forEach(c => {
        if (!isDuplicate(c)) suggestions.push(c);
      });
    }

    if (suggestions.length < 3) {
      const fallbacks = [
        "Summarize the key program benefits",
        "What are the qualification criteria for the tiers?",
        "What is the overall customer sentiment?",
        "What are the program's main weaknesses?"
      ];
      for (const f of fallbacks) {
        if (!isDuplicate(f) && !suggestions.includes(f)) {
          suggestions.push(f);
        }
        if (suggestions.length >= 3) break;
      }
    }
  }

  return suggestions.slice(0, 3);
}

export function ChatWidget({ programId, messages, isLoading, onSend, isComparative = false }: ChatWidgetProps) {
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
          const headingMatch = line.trim().match(/^(#{1,6})\s+(.*)/);
          const isHeading = !!headingMatch;
          const isBullet = !isHeading && (line.trim().startsWith("* ") || line.trim().startsWith("- "));
          const isNumbered = !isHeading && !isBullet && /^\d+\.\s/.test(line.trim());

          let cleanLine = line;
          if (isHeading) {
            cleanLine = headingMatch[2];
          } else if (isBullet) {
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
                <strong key={start} className="font-semibold text-white">
                  {matchedText.slice(2, -2)}
                </strong>
              );
            } else if (matchedText.startsWith("*") && matchedText.endsWith("*")) {
              parts.push(<em key={start} className="italic">{matchedText.slice(1, -1)}</em>);
            } else if (matchedText.startsWith("`") && matchedText.endsWith("`")) {
              parts.push(
                <code key={start} className="px-1 py-0.5 rounded font-mono text-[10px]" style={{
                  backgroundColor: isUser ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
                  color: isUser ? '#fff' : '#fd7f4f'
                }}>
                  {matchedText.slice(1, -1)}
                </code>
              );
            }

            lastIdx = regex.lastIndex;
          }

          if (lastIdx < cleanLine.length) {
            parts.push(cleanLine.substring(lastIdx));
          }

          if (isHeading) {
            const level = headingMatch[1].length;
            const sizeClass = level === 1 ? 'text-xs' : level <= 3 ? 'text-[11px]' : 'text-[10px]';
            const colorStyle = isUser ? '#ffffff' : (level === 3 ? '#fd7f4f' : 'rgba(255,255,255,0.9)');
            return (
              <div key={lineIdx} className={`${sizeClass} font-bold leading-snug mt-2 mb-1`} style={{ color: colorStyle }}>
                {parts}
              </div>
            );
          }

          if (isBullet) {
            return (
              <ul key={lineIdx} className="list-disc pl-4 space-y-0.5">
                <li className="text-[11px] leading-normal" style={{ color: isUser ? '#fff' : 'rgba(255, 255, 255, 0.9)' }}>
                  {parts}
                </li>
              </ul>
            );
          }

          if (isNumbered) {
            const numStr = line.match(/^(\d+\.)\s/)?.[1] || "";
            return (
              <div key={lineIdx} className="flex gap-1.5 text-[11px] leading-normal pl-1" style={{ color: isUser ? '#fff' : 'rgba(255, 255, 255, 0.9)' }}>
                <span className="font-bold shrink-0" style={{ color: isUser ? '#fff' : '#ffffff' }}>
                  {numStr}
                </span>
                <div>{parts}</div>
              </div>
            );
          }

          return (
            <p key={lineIdx} className="text-[11px] leading-normal min-h-[1em]" style={{ color: isUser ? '#fff' : 'rgba(255, 255, 255, 0.9)' }}>
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
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full text-white shadow-lg flex items-center justify-center transition-all duration-200"
        style={{ backgroundColor: '#fd7f4f', boxShadow: '0 4px 20px rgba(253,127,79,0.4)' }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f56d38')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#fd7f4f')}
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
          className="fixed bottom-24 right-6 z-50 border rounded-[10px] shadow-2xl flex flex-col overflow-hidden select-none"
          style={{ 
            backgroundColor: '#051c2c',
            borderColor: 'rgba(255,255,255,0.12)',
            width: `${dimensions.width}px`, 
            height: `${dimensions.height}px`,
            maxHeight: "85vh",
            maxWidth: "90vw",
            boxShadow: '0 20px 60px rgba(0,0,0,0.6)'
          }}
        >
          {/* Resize handles */}
          {/* Top-left diagonal corner grip */}
          <div
            onMouseDown={(e) => handleMouseDown(e, "nw")}
            className="absolute top-0 left-0 w-3 h-3 cursor-nwse-resize z-50 flex items-center justify-center group"
          >
            <div className="w-1.5 h-1.5 border-t border-l border-white/20 group-hover:border-white/40 transition-colors" />
          </div>
          {/* Left border resize bar */}
          <div
            onMouseDown={(e) => handleMouseDown(e, "w")}
            className="absolute top-0 left-0 w-1.5 h-full cursor-ew-resize z-40 hover:bg-white/08 transition-colors"
          />
          <div
            onMouseDown={(e) => handleMouseDown(e, "h")}
            className="absolute top-0 left-0 w-full h-1.5 cursor-ns-resize z-40 hover:bg-white/08 transition-colors"
          />

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)' }}>
            <div>
              <span className="kobie-overline" style={{ fontSize: '10px', marginBottom: '2px' }}>Program Chat</span>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Grounded Q&amp;A</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="h-7 w-7 flex items-center justify-center rounded-[5px] transition-colors outline-none focus:outline-none"
              style={{ color: 'rgba(255,255,255,0.4)', border: 'none', background: 'transparent', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fd7f4f')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
            >
              <X size={13} strokeWidth={1.5} />
            </button>
          </div>

          {/* Messages scroll box */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 select-text" style={{ backgroundColor: 'var(--kobie-midnight)' }}>
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {isComparative ? "Ask anything comparing these programs. Try:" : "Ask anything about this program. Try:"}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(isComparative ? COMPARATIVE_QUICK_PROMPTS : SINGLE_QUICK_PROMPTS).map((p) => (
                    <button
                      key={p}
                      onClick={() => onSend(p)}
                      className="text-[10px] font-medium px-2.5 py-1.5 rounded-[5px] border transition-all cursor-pointer text-left"
                      style={{
                        backgroundColor: "rgba(255, 255, 255, 0.03)",
                        color: "rgba(255, 255, 255, 0.65)",
                        borderColor: "rgba(255, 255, 255, 0.08)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)";
                        e.currentTarget.style.color = "rgba(255, 255, 255, 0.95)";
                        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.03)";
                        e.currentTarget.style.color = "rgba(255, 255, 255, 0.65)";
                        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {messages.map((msg, i) => {
                const SOURCES_SEPARATOR = "\n\n---\n[SOURCES]";
                let messageBody = msg.content;
                let sourcesList: string[] = [];

                if (msg.role === "assistant" && msg.content.includes(SOURCES_SEPARATOR)) {
                  const parts = msg.content.split(SOURCES_SEPARATOR);
                  messageBody = parts[0];
                  const sourcesRaw = parts[1] || "";
                  sourcesList = sourcesRaw
                    .split("\n")
                    .map((line) => line.replace(/^-\s*/, "").trim())
                    .filter((line) => line.length > 0);
                }

                return (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className="max-w-[85%] rounded-[8px] px-3 py-2 text-xs leading-relaxed"
                      style={{
                        backgroundColor: msg.role === "user" ? '#fd7f4f' : '#092538',
                        color: '#ffffff',
                        border: msg.role === "user" ? 'none' : '1px solid rgba(255,255,255,0.1)'
                      }}
                    >
                      {renderMessageContent(messageBody, msg.role)}
                      
                      {sourcesList.length > 0 && (
                        <div className="mt-2.5 pt-2.5 border-t border-white/5 space-y-1.5 text-left">
                          <details className="group">
                            <summary className="text-[10px] text-white/50 group-open:text-white/85 hover:text-white/85 font-semibold cursor-pointer select-none flex items-center gap-1 list-none [&::-webkit-details-marker]:hidden">
                              <ChevronRight size={10} className="transition-transform group-open:rotate-90 shrink-0 text-white/45" />
                              Sources:
                            </summary>
                            <div className="mt-2 pl-2 space-y-1 animate-in slide-in-from-top-1 duration-150">
                              {sourcesList.map((url, idx) => (
                                <div key={idx} className="flex gap-1.5 text-[10px] leading-normal items-center truncate max-w-[280px]">
                                  <span className="font-bold text-white/60 shrink-0 select-none">
                                    {idx + 1}.
                                  </span>
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-blue-400 hover:text-blue-300 hover:underline truncate"
                                  >
                                    {url}
                                  </a>
                                </div>
                              ))}
                            </div>
                          </details>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="rounded-[8px] px-3 py-2" style={{ backgroundColor: '#092538', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0ms]" style={{ backgroundColor: '#fd7f4f', opacity: 0.6 }} />
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:150ms]" style={{ backgroundColor: '#fd7f4f', opacity: 0.6 }} />
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:300ms]" style={{ backgroundColor: '#fd7f4f', opacity: 0.6 }} />
                    </span>
                  </div>
                </div>
              )}

              {/* Follow-up suggestions */}
              {!isLoading && messages.length > 0 && messages[messages.length - 1].role === "assistant" && !messages[messages.length - 1].content.startsWith("⚠️") && (
                <div className="space-y-2 pt-2 animate-in fade-in duration-200">
                  <p className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    Suggested follow-up:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {getFollowUpSuggestions(
                      messages[messages.length - 1].content,
                      isComparative,
                      messages.filter((m) => m.role === "user").map((m) => m.content)
                    ).map((p) => (
                      <button
                        key={p}
                        onClick={() => onSend(p)}
                        className="text-[10px] font-medium px-2.5 py-1.5 rounded-[5px] border transition-all cursor-pointer text-left"
                        style={{
                          backgroundColor: "rgba(255, 255, 255, 0.03)",
                          color: "rgba(255, 255, 255, 0.65)",
                          borderColor: "rgba(255, 255, 255, 0.08)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)";
                          e.currentTarget.style.color = "rgba(255, 255, 255, 0.95)";
                          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.03)";
                          e.currentTarget.style.color = "rgba(255, 255, 255, 0.65)";
                          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input Form */}
          <form
            onSubmit={handleSend}
            className="flex items-center gap-2 px-3 py-3 shrink-0"
            style={{ borderTop: '1px solid rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)' }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about this program…"
              className="h-8 text-xs flex-1"
              disabled={isLoading}
            />
            <button
              type="submit"
              className="h-8 w-8 flex items-center justify-center rounded-[5px] shrink-0 disabled:opacity-40 transition-colors"
              style={{ backgroundColor: '#fd7f4f' }}
              disabled={!input.trim() || isLoading}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f56d38')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#fd7f4f')}
            >
              <Send size={13} strokeWidth={1.5} style={{ color: '#fff' }} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
