"use client";

import { memo, useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { API_BASE } from "@/lib/api";
import { PipelineTracker } from "@/components/analyst/PipelineTracker";
import type { PipelineEvent } from "@/types/api";

export const RunnerStagePanel = memo(function RunnerStagePanel({
  runnerId,
  runnerName,
  status,
  onClose,
}: {
  runnerId: string;
  runnerName: string;
  status: string;
  onClose: () => void;
}) {
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await fetch(`${API_BASE}/api/programs/${runnerId}/events`);
        if (res.ok) {
          const data = await res.json();
          setEvents(data);
        }
      } catch (err) {
        console.error("Failed to fetch runner events:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();

    // If runner is active, set up polling to keep events updated live
    const isCompleted = status === "complete" || status === "failed";
    if (!isCompleted) {
      const interval = setInterval(fetchEvents, 2000);
      return () => clearInterval(interval);
    }
  }, [runnerId, status]);

  return (
    <div className="border border-border rounded-lg bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-stone-50/50 border-b border-border">
        <span className="text-xs font-semibold text-stone-700">
          Pipeline Stages — {runnerName}
        </span>
        <button
          onClick={onClose}
          className="text-stone-400 hover:text-stone-600 text-xs font-medium transition-colors"
        >
          Close Details
        </button>
      </div>

      {/* Tracker Body */}
      <div className="p-4 bg-stone-50/20">
        {loading && events.length === 0 ? (
          <div className="flex items-center justify-center py-12 gap-2 text-stone-400 text-sm">
            <Loader2 size={16} className="animate-spin" />
            Loading stages…
          </div>
        ) : (
          <PipelineTracker
            events={events}
            isDegraded={false}
            isConnected={events.length > 0}
          />
        )}
      </div>
    </div>
  );
});
