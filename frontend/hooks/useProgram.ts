"use client";

import { useState, useCallback, useEffect } from "react";
import {
  createProgram,
  runProgram,
  getNarrative,
  getChatHistory,
  sendChatMessage,
  getExtractedFields,
  getProgram,
} from "@/lib/api";
import type {
  Program,
  Narrative,
  ChatMessage,
  ExtractedField,
} from "@/types/api";

export type WorkspacePhase =
  | "idle"        // nothing yet
  | "running"     // pipeline in progress
  | "complete"    // pipeline done, narrative ready
  | "failed";     // pipeline failed

interface UseProgramReturn {
  phase: WorkspacePhase;
  program: Program | null;
  narrative: Narrative | null;
  chatMessages: ChatMessage[];
  fields: ExtractedField[];
  isChatLoading: boolean;
  error: string | null;
  startPipeline: (name: string, force?: boolean) => Promise<string | null>; // returns programId
  forceReanalyse: () => Promise<string | null>; // re-runs current program ignoring cache
  onPipelineComplete: (programId: string) => Promise<void>;
  onPipelineFailed: (detail: string) => void;
  sendMessage: (programId: string, message: string) => Promise<void>;
  reset: () => void;
}

export function useProgram(programId: string | null): UseProgramReturn {
  const [phase, setPhase] = useState<WorkspacePhase>("idle");
  const [program, setProgram] = useState<Program | null>(null);
  const [narrative, setNarrative] = useState<Narrative | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [fields, setFields] = useState<ExtractedField[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setPhase("idle");
    setProgram(null);
    setNarrative(null);
    setChatMessages([]);
    setFields([]);
    setError(null);
  }, []);

  useEffect(() => {
    if (!programId) {
      reset();
      return;
    }

    setPhase("running");
    getProgram(programId)
      .then(async (prog) => {
        setProgram(prog);
        if (prog.status === "complete") {
          setPhase("complete");
          // Use allSettled so a missing narrative doesn't block fields/chat
          const [narResult, fldsResult, histResult] = await Promise.allSettled([
            getNarrative(programId),
            getExtractedFields(programId),
            getChatHistory(programId),
          ]);
          if (narResult.status === "fulfilled") setNarrative(narResult.value);
          if (fldsResult.status === "fulfilled") setFields(fldsResult.value);
          if (histResult.status === "fulfilled") setChatMessages(histResult.value.messages);
        } else if (prog.status === "failed") {
          setPhase("failed");
        } else {
          setPhase("running");
        }
      })
      .catch(() => {
        reset();
      });
  }, [programId, reset]);



  const startPipeline = useCallback(async (name: string, force = false) => {
    setError(null);
    try {
      const prog = await createProgram(name, force);
      setProgram(prog);

      // Smart cache hit: backend returned an already-complete program
      if (prog.status === "complete") {
        setPhase("complete");
        const [narResult, fldsResult, histResult] = await Promise.allSettled([
          getNarrative(prog.id),
          getExtractedFields(prog.id),
          getChatHistory(prog.id),
        ]);
        if (narResult.status === "fulfilled") setNarrative(narResult.value);
        if (fldsResult.status === "fulfilled") setFields(fldsResult.value);
        if (histResult.status === "fulfilled") setChatMessages(histResult.value.messages);
        return prog.id;
      }

      // Normal flow: new program, kick off the pipeline
      setPhase("running");
      await runProgram(prog.id);
      return prog.id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setPhase("failed");
      return null;
    }
  }, []);

  // Force re-analyse: bypass cache and always run a fresh pipeline
  const forceReanalyse = useCallback(async () => {
    if (!program?.name) return null;
    return startPipeline(program.name, true);
  }, [program?.name, startPipeline]);

  const onPipelineComplete = useCallback(async (programId: string) => {
    setPhase("complete");
    // Load narrative
    try {
      const nar = await getNarrative(programId);
      setNarrative(nar);
    } catch {
      // narrative may not exist yet — tolerate
    }
    // Load fields
    try {
      const flds = await getExtractedFields(programId);
      setFields(flds);
    } catch {
      // tolerate
    }
    // Load chat history (may be empty)
    try {
      const history = await getChatHistory(programId);
      setChatMessages(history.messages);
    } catch {
      // no history yet
    }
  }, []);

  const onPipelineFailed = useCallback((detail: string) => {
    setPhase("failed");
    setError(detail);
  }, []);

  const sendMessage = useCallback(
    async (programId: string, message: string) => {
      const userMsg: ChatMessage = {
        role: "user",
        content: message,
        created_at: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, userMsg]);
      setIsChatLoading(true);
      try {
        const resp = await sendChatMessage(programId, message);
        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: resp.reply,
          created_at: new Date().toISOString(),
        };
        setChatMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Chat failed";
        const errMsg: ChatMessage = {
          role: "assistant",
          content: `⚠️ ${msg}`,
          created_at: new Date().toISOString(),
        };
        setChatMessages((prev) => [...prev, errMsg]);
      } finally {
        setIsChatLoading(false);
      }
    },
    []
  );

  return {
    phase,
    program,
    narrative,
    chatMessages,
    fields,
    isChatLoading,
    error,
    startPipeline,
    forceReanalyse,
    onPipelineComplete,
    onPipelineFailed,
    sendMessage,
    reset,
  };
}
