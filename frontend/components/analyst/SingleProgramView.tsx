"use client";

import { Loader2, AlertCircle, CheckCircle2, ChevronUp, ChevronDown, Activity, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PipelineTracker } from "@/components/analyst/PipelineTracker";
import { BriefView } from "@/components/analyst/BriefView";
import { ExportBar } from "@/components/analyst/ExportBar";
import { SourcesTab } from "@/components/analyst/SourcesTab";
import { FieldsGrid } from "@/components/analyst/FieldsGrid";
import { ChatWidget } from "@/components/analyst/ChatWidget";
import { EvolutionTab } from "@/components/analyst/EvolutionTab";
import { ProgressCardLoader } from "./ProgressCardLoader";
import type { Program, Narrative, ExtractedField, PipelineEvent } from "@/types/api";

function BriefGeneratingLoader() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev < 50) return prev + 6;
        if (prev < 85) return prev + 3;
        if (prev < 98) return prev + 0.8;
        return prev;
      });
    }, 150);
    return () => clearInterval(timer);
  }, []);

  return (
    <ProgressCardLoader
      title="Generating analyst brief..."
      subtitle="Synthesizing extracted facts, verification citations, and program highlights"
      stageName="Writing report"
      progressPercent={progress}
      className="py-12 max-w-md"
    />
  );
}

interface SingleProgramViewProps {
  programId: string | null;
  program: Program | null;
  phase: string;
  error: string | null;
  events: PipelineEvent[];
  isDegraded: boolean;
  trackerExpanded: boolean;
  setTrackerExpanded: (expanded: boolean | ((prev: boolean) => boolean)) => void;
  narrative: Narrative | null;
  fields: ExtractedField[];
  chatMessages: any[];
  isChatLoading: boolean;
  sendMessage: (programId: string, msg: string) => Promise<void>;
  handleForceReanalyse: () => void;
}

export function SingleProgramView({
  programId,
  program,
  phase,
  error,
  events,
  isDegraded,
  trackerExpanded,
  setTrackerExpanded,
  narrative,
  fields,
  chatMessages,
  isChatLoading,
  sendMessage,
  handleForceReanalyse,
}: SingleProgramViewProps) {
  const isRunning = phase === "running";
  const isComplete = phase === "complete";
  const isFailed = phase === "failed";

  const activeSubtitle = (() => {
    const raw = events[events.length - 1]?.detail;
    if (!raw) return "Running extraction & verification";
    try {
      const parsed = JSON.parse(raw);
      if (parsed.message) return parsed.message;
      if (parsed.item?.field_name) {
        return `Extracted ${parsed.item.field_name.replace(/_/g, " ")} (${parsed.count}/${parsed.total})`;
      }
      return raw;
    } catch {
      return raw;
    }
  })();

  return (
    <>
      {/* Error banner */}
      {(isFailed || error) && (
        <Alert className="border-red-200 bg-red-50 max-w-2xl mx-auto">
          <AlertCircle size={14} strokeWidth={1.5} className="text-red-500" />
          <AlertDescription className="text-xs text-red-700">
            {error ?? "Pipeline failed. Check the server logs."}
          </AlertDescription>
        </Alert>
      )}

      {/* Single program progress card while running */}
      {isRunning && (
        <ProgressCardLoader
          title="Analyzing loyalty program data..."
          subtitle={activeSubtitle}
          stageName={events[events.length - 1]?.stage?.replace(/_/g, " ") || "Crawling sources"}
          progressPercent={(events[events.length - 1]?.progress ?? 0.05) * 100}
          className="mb-6"
        />
      )}

      {/* Pipeline tracker (complete status logs) */}
      {isComplete && (
        <div className="border border-border rounded-lg bg-white overflow-hidden">
          {/* Tracker header — always visible */}
          <button
            onClick={() => setTrackerExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-stone-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} strokeWidth={1.5} className="text-[#0F766E]" />
              <span className="text-xs font-medium text-stone-700">
                Pipeline complete · {events.length} stage{events.length !== 1 ? "s" : ""}
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
              {program?.trace_url && (
                <a
                  href={program.trace_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 h-8 px-3 text-xs text-[#0F766E] border border-[#0F766E]/20 bg-[#0F766E]/5 rounded-md hover:bg-[#0F766E]/10 transition-colors"
                >
                  <Activity size={12} strokeWidth={1.5} />
                  View Trace
                </a>
              )}
              <button
                onClick={handleForceReanalyse}
                title="Force a fresh re-analysis, bypassing the cache"
                className="flex items-center gap-1.5 h-8 px-3 text-xs text-muted-foreground border border-border rounded-md hover:text-stone-800 hover:bg-stone-50 transition-colors cursor-pointer"
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

          {/* Tabs: Brief | Sources | Fields */}
          <Tabs defaultValue="brief">
            <TabsList className="h-8 bg-stone-100 p-0.5">
              <TabsTrigger
                value="brief"
                className="text-xs h-7 px-4 data-[state=active]:bg-white data-[state=active]:shadow-none"
              >
                Analyst Brief
              </TabsTrigger>
              <TabsTrigger
                value="sources"
                className="text-xs h-7 px-4 data-[state=active]:bg-white data-[state=active]:shadow-none"
              >
                All Sources
              </TabsTrigger>
              <TabsTrigger
                value="fields"
                className="text-xs h-7 px-4 data-[state=active]:bg-white data-[state=active]:shadow-none"
              >
                Data Grid {fields.length > 0 && `(${fields.length})`}
              </TabsTrigger>
              <TabsTrigger
                value="evolution"
                className="text-xs h-7 px-4 data-[state=active]:bg-white data-[state=active]:shadow-none"
              >
                Program Evolution
              </TabsTrigger>
            </TabsList>

            <TabsContent value="brief" className="mt-4">
              <div className="bg-white border border-border rounded-lg p-6">
                {narrative ? (
                  <BriefView narrative={narrative} fields={fields} />
                ) : (
                  <BriefGeneratingLoader />
                )}
              </div>
            </TabsContent>

            <TabsContent value="sources" className="mt-4">
              <div className="bg-white border border-border rounded-lg p-4">
                {programId ? (
                  <SourcesTab programId={programId} />
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-8">No program selected.</p>
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

            <TabsContent value="evolution" className="mt-4">
              <div className="bg-white border border-border rounded-lg p-5">
                {programId ? (
                  <EvolutionTab programId={programId} />
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-8">No program selected.</p>
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
    </>
  );
}
