"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { ProgramInput } from "@/components/analyst/ProgramInput";
import { SimilarProgramsModal } from "@/components/analyst/CacheConflictModal";
import { MultiFlowWorkspace } from "@/components/analyst/MultiFlowWorkspace";
import { SingleProgramView } from "@/components/analyst/SingleProgramView";
import { useSSE } from "@/hooks/useSSE";
import { useProgram } from "@/hooks/useProgram";
import { searchPrograms, createProgram, runProgram, comparePrograms, getProgram } from "@/lib/api";
import type { Program, Comparison } from "@/types/api";

export default function AnalystWorkspace() {
  const [programId, setProgramId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [trackerExpanded, setTrackerExpanded] = useState(false);
  
  // Pending modal state (if fuzzy match overrides are needed)
  const [pendingSearch, setPendingSearch] = useState<{ query: string; matches: Program[] } | null>(null);

  // Multi-program comparison states
  const [isMultiFlow, setIsMultiFlow] = useState(false);
  const [multiRunners, setMultiRunners] = useState<{ id: string; name: string; status: string; progress: number; hasStarted?: boolean }[]>([]);
  const [comparisonResult, setComparisonResult] = useState<Comparison | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [multiError, setMultiError] = useState<string | null>(null);
  const [expandedRunnerId, setExpandedRunnerId] = useState<string | null>(null);
  const closeExpandedPanel = useCallback(() => setExpandedRunnerId(null), []);

  // Set to track jobs that have already sent a start request (prevents double-runs due to React async state queues)
  const startedJobsRef = useRef<Set<string>>(new Set());

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

  const [searchQuery, setSearchQuery] = useState("");

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

  // Sync searchQuery when the loaded program changes
  useEffect(() => {
    if (program?.name) {
      setSearchQuery(program.name);
    }
  }, [program?.name]);

  const handleComplete = useCallback(async () => {
    if (programId) await onPipelineComplete(programId);
    setTrackerExpanded(false); // auto-collapse on completion
  }, [programId, onPipelineComplete]);

  const handleFailed = useCallback(
    (detail: string) => onPipelineFailed(detail),
    [onPipelineFailed]
  );

  const { events, isDegraded } = useSSE(
    programId,
    { onComplete: handleComplete, onFailed: handleFailed }
  );

  // Polling hook for multi-program pipeline status (Sequential Execution)
  useEffect(() => {
    if (!isMultiFlow || multiRunners.length === 0) return;

    // Check if there is an active running job
    const anyRunning = multiRunners.some(
      (r) => r.hasStarted && r.status !== "complete" && r.status !== "failed"
    );

    if (!anyRunning) {
      // Find the first job that has not started yet and is not currently in-flight
      const nextToStart = multiRunners.find((r) => !r.hasStarted && !startedJobsRef.current.has(r.id));
      if (nextToStart) {
        startedJobsRef.current.add(nextToStart.id);
        // Start the next program in the queue
        runProgram(nextToStart.id).catch((err) => {
          console.error("Failed to run program:", err);
        });
        // Update its state to hasStarted = true
        setMultiRunners((prev) =>
          prev.map((r) =>
            r.id === nextToStart.id ? { ...r, hasStarted: true } : r
          )
        );
        return;
      }

      // If no running jobs AND none left to start: All runs finished!
      // Trigger the LLM comparison if 2+ are complete
      const completed = multiRunners.filter((r) => r.status === "complete");
      if (completed.length >= 2 && !comparisonResult && !isComparing && !multiError) {
        setIsComparing(true);
        comparePrograms(completed.map((r) => r.id))
          .then((res) => {
            setComparisonResult(res);
          })
          .catch((err) => {
            setMultiError(err instanceof Error ? err.message : "Comparison analysis generation failed.");
          })
          .finally(() => {
            setIsComparing(false);
          });
      }
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const updated = await Promise.all(
          multiRunners.map(async (r) => {
            // Only poll for status if the runner has actually started and is not completed/failed
            if (!r.hasStarted || r.status === "complete" || r.status === "failed") return r;
            try {
              const prog = await getProgram(r.id);
              const progressMap: Record<string, number> = {
                pending: 0.05,
                retrieving: 0.15,
                retrieved: 0.30,
                embedding: 0.40,
                extracting: 0.60,
                extracted: 0.70,
                verifying: 0.85,
                verified: 0.90,
                narrating: 0.95,
                complete: 1.0,
                failed: 0.0
              };
              return {
                ...r,
                status: prog.status,
                progress: progressMap[prog.status] ?? 0.1
              };
            } catch {
              return r;
            }
          })
        );
        setMultiRunners(updated);
      } catch {
        // tolerate fetch failures
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [isMultiFlow, multiRunners, comparisonResult, isComparing, multiError]);

  async function handleSubmit(input: string | string[]) {
    setMultiError(null);
    startedJobsRef.current.clear();

    // ── Comparative mode: array of names from the new multi-input UI ──
    if (Array.isArray(input)) {
      const names = input.map(n => n.trim()).filter(Boolean);
      setSearchQuery(names.join(", "));
      setIsMultiFlow(true);
      setComparisonResult(null);
      setMultiRunners([]);
      setProgramId(null);
      setExpandedRunnerId(null);
      localStorage.removeItem("infovac_program_id");
      reset();

      const runners = [];
      for (const programName of names) {
        try {
          // Always create a brand-new row and run fresh (no cache)
          const prog = await createProgram(programName, true);
          runners.push({ id: prog.id, name: prog.name, status: "pending", progress: 0.05, hasStarted: false });
        } catch (err) {
          setMultiError(`Failed to queue "${programName}": ${err instanceof Error ? err.message : String(err)}`);
          setIsMultiFlow(false);
          return;
        }
      }
      setMultiRunners(runners);
      return;
    }

    // ── Single program mode ──
    const name = (input as string).trim();
    if (!name) return;
    setSearchQuery(name);
    setIsMultiFlow(false);
    await launchFresh(name);
  }

  async function handleSelectExisting(prog: Program) {
    setSearchQuery(prog.name);
    setPendingSearch(null);
    setIsMultiFlow(false);
    await launchFresh(prog.name);
  }

  async function handleRunFresh() {
    if (!pendingSearch) return;
    const { query } = pendingSearch;
    setPendingSearch(null);
    setIsMultiFlow(false);
    await launchFresh(query);
  }

  async function launchFresh(name: string) {
    setSearchQuery(name);
    reset();
    setIsMultiFlow(false);
    setProgramId(null);
    setTrackerExpanded(true);
    localStorage.removeItem("infovac_program_id");
    const prog = await createProgram(name, true);
    setProgramId(prog.id);
    localStorage.setItem("infovac_program_id", prog.id);
    await runProgram(prog.id);
  }

  async function handleForceReanalyse() {
    const currentName = program?.name;
    if (!currentName) return;
    setSearchQuery(currentName);
    reset();
    setIsMultiFlow(false);
    setProgramId(null);
    setTrackerExpanded(true);
    localStorage.removeItem("infovac_program_id");
    const id = await startPipeline(currentName, true);
    if (id) {
      setProgramId(id);
      localStorage.setItem("infovac_program_id", id);
    }
  }

  const handleReset = useCallback(() => {
    reset();
    setProgramId(null);
    setIsMultiFlow(false);
    setMultiRunners([]);
    setComparisonResult(null);
    setMultiError(null);
    setExpandedRunnerId(null);
    localStorage.removeItem("infovac_program_id");
    startedJobsRef.current.clear();
  }, [reset]);

  const isRunning = phase === "running";

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      {/* Navigation */}
      <header className="border-b border-border bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-stone-900 tracking-tight">InfoVac</span>
            <span className="text-xs text-muted-foreground">Competitive Intelligence</span>
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={handleReset}
              className="text-xs text-[#0F766E] font-medium hover:underline transition-all cursor-pointer"
            >
              + New Analysis
            </button>
            <Link
              href="/admin"
              className="text-xs text-muted-foreground hover:text-stone-800 transition-colors"
            >
              Admin Dashboard →
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-6">
        {/* Input area */}
        <div className="text-center space-y-6">
          {!isMultiFlow && phase === "idle" && (
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-stone-900 tracking-tight">
                Loyalty Program Intelligence
              </h1>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Enter a loyalty program name, or compare multiple programs by separating them with commas (e.g. <code className="text-xs bg-stone-100 px-1 py-0.5 rounded font-mono text-[#0F766E]">Starbucks, Delta, Marriott</code>).
              </p>
            </div>
          )}
          {isMultiFlow && (
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-stone-900 tracking-tight">
                Comparison Workspace
              </h1>
            </div>
          )}
          <ProgramInput
            key={programId ?? "new"}
            initialValue={searchQuery}
            onSubmit={handleSubmit}
            onSelectExisting={handleSelectExisting}
            isLoading={isRunning}
            isMultiFlow={isMultiFlow}
            onModeChange={setIsMultiFlow}
          />
        </div>

        {/* Multi program flow view */}
        {isMultiFlow && (
          <MultiFlowWorkspace
            runners={multiRunners}
            expandedRunnerId={expandedRunnerId}
            onExpandRunner={setExpandedRunnerId}
            closeExpandedPanel={closeExpandedPanel}
            multiError={multiError}
            isComparing={isComparing}
            comparisonResult={comparisonResult}
            onClearWorkspace={handleReset}
          />
        )}

        {/* Single program view */}
        {!isMultiFlow && (
          <SingleProgramView
            programId={programId}
            program={program}
            phase={phase}
            error={error}
            events={events}
            isDegraded={isDegraded}
            trackerExpanded={trackerExpanded}
            setTrackerExpanded={setTrackerExpanded}
            narrative={narrative}
            fields={fields}
            chatMessages={chatMessages}
            isChatLoading={isChatLoading}
            sendMessage={sendMessage}
            handleForceReanalyse={handleForceReanalyse}
            onClearWorkspace={handleReset}
          />
        )}
      </main>

      {/* Suggestion Conflict Modal */}
      {pendingSearch && (
        <SimilarProgramsModal
          query={pendingSearch.query}
          matches={pendingSearch.matches}
          onSelect={handleSelectExisting}
          onRunFresh={handleRunFresh}
          onDismiss={() => setPendingSearch(null)}
        />
      )}
    </div>
  );
}
