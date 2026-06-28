"use client";

import { useState, useCallback, useEffect } from "react";
import { AlertCircle, Loader2, ChevronDown, ChevronUp, CheckCircle2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ProgramInput } from "@/components/analyst/ProgramInput";
import { PipelineTracker } from "@/components/analyst/PipelineTracker";
import { BriefView } from "@/components/analyst/BriefView";
import { FieldsGrid } from "@/components/analyst/FieldsGrid";
import { ChatWidget } from "@/components/analyst/ChatWidget";
import { ExportBar } from "@/components/analyst/ExportBar";
import { useSSE } from "@/hooks/useSSE";
import { useProgram } from "@/hooks/useProgram";

export default function AnalystWorkspace() {
  const [programId, setProgramId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [trackerExpanded, setTrackerExpanded] = useState(false);

  // Load program ID on mount (client-only)
  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem("infovac_program_id");
    if (saved) {
      setProgramId(saved);
    }
  }, []);

  // Save program ID to localStorage on change (after mounting)
  useEffect(() => {
    if (!isMounted) return;
    if (programId) {
      localStorage.setItem("infovac_program_id", programId);
    } else {
      localStorage.removeItem("infovac_program_id");
    }
  }, [programId, isMounted]);

  const {
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
  } = useProgram(programId);

  const handleComplete = useCallback(async () => {
    if (programId) await onPipelineComplete(programId);
    setTrackerExpanded(false); // auto-collapse on completion
  }, [programId, onPipelineComplete]);

  const handleFailed = useCallback(
    (detail: string) => onPipelineFailed(detail),
    [onPipelineFailed]
  );

  const { events, isDegraded } = useSSE(
    phase === "running" ? programId : null,
    { onComplete: handleComplete, onFailed: handleFailed }
  );

  async function handleSubmit(name: string) {
    reset();
    setProgramId(null);
    setTrackerExpanded(true); // auto-expand while running
    localStorage.removeItem("infovac_program_id");
    const id = await startPipeline(name);
    if (id) {
      setProgramId(id);
      localStorage.setItem("infovac_program_id", id);
    }
  }

  async function handleForceReanalyse() {
    reset();
    setProgramId(null);
    setTrackerExpanded(true);
    localStorage.removeItem("infovac_program_id");
    const id = await forceReanalyse();
    if (id) {
      setProgramId(id);
      localStorage.setItem("infovac_program_id", id);
    }
  }

  const isRunning = phase === "running";
  const isComplete = phase === "complete";
  const isFailed = phase === "failed";

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      {/* Nav */}
      <header className="border-b border-border bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-stone-900 tracking-tight">InfoVac</span>
            <span className="text-xs text-muted-foreground">Competitive Intelligence</span>
          </div>
          <Link
            href="/admin"
            className="text-xs text-muted-foreground hover:text-stone-800 transition-colors"
          >
            Admin Dashboard →
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-6">
        {/* Hero input */}
        <div className="text-center space-y-6">
          {phase === "idle" && (
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-stone-900 tracking-tight">
                Loyalty Program Intelligence
              </h1>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Enter any loyalty program. InfoVac discovers sources, extracts 44 fields,
                verifies every claim, and writes an analyst brief.
              </p>
            </div>
          )}
          <ProgramInput
            onSubmit={handleSubmit}
            isLoading={isRunning}
          />
        </div>

        {/* Error banner */}
        {(isFailed || error) && (
          <Alert className="border-red-200 bg-red-50 max-w-2xl mx-auto">
            <AlertCircle size={14} strokeWidth={1.5} className="text-red-500" />
            <AlertDescription className="text-xs text-red-700">
              {error ?? "Pipeline failed. Check the server logs."}
            </AlertDescription>
          </Alert>
        )}

        {/* Pipeline tracker */}
        {(isRunning || isComplete) && (
          <div className="border border-border rounded-lg bg-white overflow-hidden">
            {/* Tracker header — always visible */}
            <button
              onClick={() => setTrackerExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-stone-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isComplete ? (
                  <CheckCircle2 size={14} strokeWidth={1.5} className="text-[#0F766E]" />
                ) : (
                  <Loader2 size={14} strokeWidth={1.5} className="animate-spin text-[#0F766E]" />
                )}
                <span className="text-xs font-medium text-stone-700">
                  {isComplete
                    ? `Pipeline complete · ${events.length} stage${events.length !== 1 ? "s" : ""}`
                    : "Pipeline running…"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {trackerExpanded ? "Hide details" : "Show details"}
                </span>
                {trackerExpanded ? (
                  <ChevronUp size={13} strokeWidth={1.5} className="text-muted-foreground" />
                ) : (
                  <ChevronDown size={13} strokeWidth={1.5} className="text-muted-foreground" />
                )}
              </div>
            </button>

            {/* Collapsible tracker body */}
            {trackerExpanded && (
              <div className="border-t border-border">
                <PipelineTracker
                  events={events}
                  isDegraded={isDegraded}
                  isConnected={events.length > 0}
                />
              </div>
            )}
          </div>
        )}

        {/* Results section — shown immediately when complete */}
        {isComplete && (
          <div className="space-y-4">
            {/* Program name + export row */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-stone-900">
                  {program?.name}
                </h2>
                <p className="text-xs text-muted-foreground">Analysis complete</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleForceReanalyse}
                  title="Force a fresh re-analysis, bypassing the cache"
                  className="flex items-center gap-1.5 h-8 px-3 text-xs text-muted-foreground border border-border rounded-md hover:text-stone-800 hover:bg-stone-50 transition-colors"
                >
                  <RefreshCw size={12} strokeWidth={1.5} />
                  Re-analyse
                </button>
                <ExportBar
                  narrative={narrative}
                  fields={fields}
                  programName={program?.name ?? "program"}
                />
              </div>
            </div>

            {/* Tabs: Brief | Fields */}
            <Tabs defaultValue="brief">
              <TabsList className="h-8 bg-stone-100 p-0.5">
                <TabsTrigger
                  value="brief"
                  className="text-xs h-7 px-4 data-[state=active]:bg-white data-[state=active]:shadow-none"
                >
                  Analyst Brief
                </TabsTrigger>
                <TabsTrigger
                  value="fields"
                  className="text-xs h-7 px-4 data-[state=active]:bg-white data-[state=active]:shadow-none"
                >
                  Data Grid {fields.length > 0 && `(${fields.length})`}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="brief" className="mt-4">
                <div className="bg-white border border-border rounded-lg p-6">
                  {narrative ? (
                    <BriefView narrative={narrative} fields={fields} />
                  ) : (
                    <div className="text-center py-12 space-y-3">
                      <Loader2 className="animate-spin mx-auto text-[#0F766E]" size={20} />
                      <p className="text-xs text-muted-foreground">Analyst brief is generating...</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="fields" className="mt-4">
                <div className="bg-white border border-border rounded-lg p-4">
                  {fields.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      No field data extracted yet.
                    </p>
                  ) : (
                    <FieldsGrid fields={fields} />
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {/* Chat widget */}
            {programId && (
              <ChatWidget
                programId={programId}
                messages={chatMessages}
                isLoading={isChatLoading}
                onSend={(msg) => sendMessage(programId, msg)}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}


