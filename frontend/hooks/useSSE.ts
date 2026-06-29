"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getSSEUrl, getProgram, getProgramEvents } from "@/lib/api";
import type { PipelineEvent, ProgramStatus } from "@/types/api";

interface UseSSEOptions {
  onComplete?: () => void;
  onFailed?: (detail: string) => void;
}

interface UseSSEReturn {
  events: PipelineEvent[];
  status: ProgramStatus | null;
  isConnected: boolean;
  isDegraded: boolean; // true = fell back to polling
}

const POLL_INTERVAL_MS = 3000;
const SSE_FALLBACK_MS = 10000; // Only fallback if SSE never opens within 10s

export function useSSE(
  programId: string | null,
  options: UseSSEOptions = {}
): UseSSEReturn {
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [status, setStatus] = useState<ProgramStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isDegraded, setIsDegraded] = useState(false);

  const onCompleteRef = useRef(options.onComplete);
  const onFailedRef = useRef(options.onFailed);
  onCompleteRef.current = options.onComplete;
  onFailedRef.current = options.onFailed;

  const appendEvent = useCallback((evt: PipelineEvent) => {
    setEvents((prev) => [...prev, evt]);
    setStatus(evt.stage as ProgramStatus);
    if (evt.stage === "complete") onCompleteRef.current?.();
    if (evt.stage === "failed") onFailedRef.current?.(evt.detail);
  }, []);

  useEffect(() => {
    if (!programId) return;

    let destroyed = false;

    setEvents([]);
    setStatus(null);
    setIsConnected(false);
    setIsDegraded(false);

    // Fetch initial event history on mount/programId change
    getProgramEvents(programId).then((history) => {
      if (destroyed) return;
      if (history.length > 0) {
        setEvents(history);
        const lastEvt = history[history.length - 1];
        setStatus(lastEvt.stage as ProgramStatus);
      }
    }).catch(() => {
      // ignore history load failures
    });

    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const STATUS_TO_EVENT: Record<string, { progress: number; detail: string }> = {
      pending:      { progress: 0.0,  detail: "Queued for analysis..." },
      retrieving:   { progress: 0.05, detail: "Discovering sources via Tavily..." },
      retrieved:    { progress: 0.25, detail: "Sources discovered successfully" },
      embedding:    { progress: 0.28, detail: "Embedding source text for Chat search..." },
      extracting:   { progress: 0.30, detail: "Extracting 44 fields across 9 categories..." },
      extracted:    { progress: 0.55, detail: "Field extraction complete" },
      verifying:    { progress: 0.60, detail: "Verifying LLM citations against raw sites..." },
      verified:     { progress: 0.80, detail: "Citations verified successfully" },
      narrating:    { progress: 0.85, detail: "Writing analyst brief..." },
      complete:     { progress: 1.0,  detail: "Analysis complete" },
      failed:       { progress: 0.0,  detail: "Analysis failed" },
    };

    function startPolling() {
      if (destroyed || pollTimer) return;
      let pollCount = 0;
      pollTimer = setInterval(async () => {
        if (destroyed) return;
        pollCount++;
        // Only show degraded banner after 4 cycles (12s) to avoid false positives on slow connections
        if (pollCount >= 4) setIsDegraded(true);
        setIsConnected(false);
        try {
          const prog = await getProgram(programId!);
          setStatus(prog.status);

          // Append intermediate synthetic event to update logs & progress bar
          setEvents((prev) => {
            const hasEvent = prev.some((e) => e.stage === prog.status);
            if (hasEvent) return prev;

            const cfg = STATUS_TO_EVENT[prog.status];
            if (!cfg) return prev;

            return [
              ...prev,
              {
                stage: prog.status,
                progress: cfg.progress,
                detail: cfg.detail,
              },
            ];
          });

          if (prog.status === "complete" || prog.status === "failed") {
            clearInterval(pollTimer!);
            if (prog.status === "complete") {
              onCompleteRef.current?.();
            } else {
              onFailedRef.current?.("Pipeline failed");
            }
          }
        } catch {
          // ignore transient errors
        }
      }, POLL_INTERVAL_MS);
    }

    let fallbackTimer = setTimeout(() => {
      if (!destroyed && !pollTimer) {
        startPolling();
      }
    }, SSE_FALLBACK_MS);

    try {
      es = new EventSource(getSSEUrl(programId));

      es.onopen = () => {
        if (!destroyed) setIsConnected(true);
      };

      es.addEventListener("stage_update", (e: MessageEvent) => {
        if (destroyed) return;
        clearTimeout(fallbackTimer);
        try {
          const data = JSON.parse(e.data) as PipelineEvent;
          appendEvent(data);
          if (data.stage === "complete" || data.stage === "failed") {
            es?.close();
          }
        } catch {
          // malformed payload — ignore
        }
      });

      es.addEventListener("heartbeat", () => {
        if (destroyed) return;
        clearTimeout(fallbackTimer);
      });

      es.onerror = () => {
        if (destroyed) return;
        clearTimeout(fallbackTimer);
        es?.close();
        startPolling();
      };
    } catch {
      clearTimeout(fallbackTimer);
      startPolling();
    }

    return () => {
      destroyed = true;
      es?.close();
      clearTimeout(fallbackTimer);
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [programId, appendEvent]);

  return { events, status, isConnected, isDegraded };
}
