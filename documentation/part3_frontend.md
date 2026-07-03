# Part 3: Next.js Frontend Exhaustive Architecture & File Catalog

This document details the frontend implementation of the InfoVac platform. It serves as a file-by-file catalog of the Next.js 15 (React 19) workspace, detailing the states, props, main operations, and design choices of each file.

---

## 📂 1. Frontend Directory Structure

```
frontend/
├── app/
│   ├── admin/
│   │   └── page.tsx              # Admin & Analytics Dashboard
│   ├── globals.css               # Kobie Brand Design System Styles
│   ├── layout.tsx                # App Layout & Google Font Configs
│   └── page.tsx                  # Analyst Workspace Landing
├── components/
│   ├── admin/                    # Telemetry Metrics Components
│   │   ├── ComparatorPicker.tsx
│   │   ├── ConfidenceBarChart.tsx
│   │   ├── CostCard.tsx
│   │   ├── GateDonutChart.tsx
│   │   └── SourceTracker.tsx
│   ├── analyst/                  # Main Workspace Component Suite
│   │   ├── BriefView.tsx
│   │   ├── CacheConflictModal.tsx
│   │   ├── ChatWidget.tsx
│   │   ├── CitationBadge.tsx
│   │   ├── ComparisonExportButton.tsx
│   │   ├── EvidenceDrawer.tsx
│   │   ├── EvolutionTab.tsx
│   │   ├── ExportBar.tsx
│   │   ├── FieldsGrid.tsx
│   │   ├── MultiFlowWorkspace.tsx
│   │   ├── PipelineTracker.tsx
│   │   ├── ProgramInput.tsx
│   │   ├── ProgressCardLoader.tsx
│   │   ├── RunnerStagePanel.tsx
│   │   ├── SingleProgramView.tsx
│   │   └── SourcesTab.tsx
│   └── ui/                       # Shadcn Primitives (alert, dialog, sheet, scroll-area, tabs, etc.)
├── hooks/
│   ├── useProgram.ts             # Workspace API Binder Hook
│   └── useSSE.ts                 # Dual-Mode SSE Event Receiver Hook
├── lib/
│   ├── api.ts                    # Backend Fetch Clients
│   ├── narrative.ts              # Citation Parsers & LCS Resolution
│   └── utils.ts                  # Class merger (cn)
└── types/
    └── api.ts                    # TypeScript Definitions mirroring backend schemas
```

---

## 📝 2. Detailed Page Catalog

### A. Analyst Workspace Landing (`frontend/app/page.tsx`)
* **File Reference**: [page.tsx](file:///d:/Coding/KOBIE_hackathon/frontend/app/page.tsx)
* **Role**: Primary layout orchestrator switching between Single-Program analysis views and Multi-Program comparison panels.
* **Key States**:
  * `programId`: Holds the active Postgres Program ID (synchronizes with `localStorage`).
  * `isMultiFlow`: Boolean toggling the view mode.
  * `multiRunners`: Array tracking concurrent extraction progress.
  * `comparisonResult`: Stores the active matrix payload.
* **Key Handlers**:
  * `handleSubmit(input)`: Handles single string inputs (routing to search cache check or pipeline boot) or arrays (triggering parallel runner queues).
* **UI/UX details**: Integrates Kobie emoji-selectors for brand tags and displays live telemetry averages (programs counted, confidence indices, and sources processed).

### B. Admin Dashboard (`frontend/app/admin/page.tsx`)
* **File Reference**: [page.tsx](file:///d:/Coding/KOBIE_hackathon/frontend/app/admin/page.tsx)
* **Role**: Displays backend health, API key costs, extraction success ratios, and hosts the comparator generator.
* **Key States**:
  * `stats`: Mapped fields tracking token counts and success rates.
  * `health`: System connectivity status (Postgres, vector DB, API ports).
  * `selectedPrograms`: Holds IDs for comparative evaluations.
* **UI/UX details**: Renders high-density grids featuring layout containers (`grid grid-cols-1 md:grid-cols-12 gap-5`).

---

## 🧩 3. Component Deep Dive (Analyst Suite)

### A. Autocomplete Program Input (`ProgramInput.tsx`)
* **File Reference**: [ProgramInput.tsx](file:///d:/Coding/KOBIE_hackathon/frontend/components/analyst/ProgramInput.tsx)
* **Props**:
  ```typescript
  interface ProgramInputProps {
    onSubmit: (input: string | string[]) => void;
    recentSearches: string[];
    onSelectRecent: (query: string) => void;
    allPrograms: Program[];
  }
  ```
* **Key States**:
  * `query`: Input string.
  * `isFocused`: Toggles search popup.
  * `inputRows`: List of strings for multi-program inputs.
* **Logic**: Employs a `200ms` debounce timer before querying matching lists, avoiding database overload while typing. Renders a "+" row button enabling analysts to evaluate up to 5 brands in parallel.

### B. Workspace Tab Panel Selector (`SingleProgramView.tsx`)
* **File Reference**: [SingleProgramView.tsx](file:///d:/Coding/KOBIE_hackathon/frontend/components/analyst/SingleProgramView.tsx)
* **Props**:
  ```typescript
  interface SingleProgramViewProps {
    program: Program;
    fields: ExtractedField[];
    narrative: Narrative | null;
    chatMessages: ChatMessage[];
    isChatLoading: boolean;
    onSendMessage: (text: string) => Promise<void>;
    onForceReanalyse: () => Promise<void>;
  }
  ```
* **Key States**:
  * `activeTab`: Toggles between `"brief"`, `"fields"`, `"sources"`, `"evolution"`, and `"chat"`.
  * `evidenceDrawer`: Struct tracking open evidence states (`isOpen`, `url`, `field`).
* **Logic**: Links individual tab choices with metadata loads via `Promise.allSettled`, preventing page crashes if one backend metric is missing.

### C. Live SSE Progress Tracker (`PipelineTracker.tsx`)
* **File Reference**: [PipelineTracker.tsx](file:///d:/Coding/KOBIE_hackathon/frontend/components/analyst/PipelineTracker.tsx)
* **Props**:
  ```typescript
  interface PipelineTrackerProps {
    events: PipelineEvent[];
    isDegraded: boolean;
    isConnected: boolean;
  }
  ```
* **Key States**:
  * `expanded`: Toggles collapsible stages.
  * `activeStage`: Tracks pipeline execution.
* **Logic**: Parses event payloads in real-time to extract lists of URLs. Renders domain favicons by fetching them dynamically (`https://www.google.com/s2/favicons?domain=...`).

### D. Multi-Program Comparison Grid (`MultiFlowWorkspace.tsx`)
* **File Reference**: [MultiFlowWorkspace.tsx](file:///d:/Coding/KOBIE_hackathon/frontend/components/analyst/MultiFlowWorkspace.tsx)
* **Props**:
  ```typescript
  interface MultiFlowWorkspaceProps {
    runners: { id: string; name: string; status: string; progress: number }[];
    comparison: Comparison | null;
    isComparing: boolean;
    error: string | null;
    onClose: () => void;
    onSelectRunner: (id: string) => void;
  }
  ```
* **Key States**:
  * `activeCategory`: Filters fields in the comparison grid.
  * `simulatedProgress`: Increments slowly to maintain engagement during backend matrix construction.
* **UX detail**: Employs sticky headers so table headers remain visible while scrolling comparison vectors.

### E. Sliding Evidence Drawer (`EvidenceDrawer.tsx`)
* **File Reference**: [EvidenceDrawer.tsx](file:///d:/Coding/KOBIE_hackathon/frontend/components/analyst/EvidenceDrawer.tsx)
* **Props**:
  ```typescript
  interface EvidenceDrawerProps {
    open: boolean;
    onClose: () => void;
    sourceUrl: string;
    field: ExtractedField | null;
  }
  ```
* **Logic**: If character offsets (`citation_start` and `citation_end`) are present in database records, splits source content and injects a styled `<mark>` tag.
  ```typescript
  const before = content.slice(0, start);
  const highlighted = content.slice(start, end);
  const after = content.slice(end);
  ```
  This highlights quotes in orange-tinted boxes inside a scrolling dark sheet.

### F. Executive Brief & PDF Exporter (`BriefView.tsx` & `ExportBar.tsx`)
* **Files**: [BriefView.tsx](file:///d:/Coding/KOBIE_hackathon/frontend/components/analyst/BriefView.tsx), [ExportBar.tsx](file:///d:/Coding/KOBIE_hackathon/frontend/components/analyst/ExportBar.tsx)
* **BriefView State**:
  * `isReady`: Deferment state variable. Set to `false` during component mount, updating to `true` after a `50ms` delay to prevent browser thread freezes.
* **PDF Exporter Styles**:
  * Uses `createSharedStyles(StyleSheet)` to share layouts between single-program and multi-program layouts.
  * Embeds the Kobie SVG logo with the `fixed` attribute to repeat it on page overflows.
  * Separates narrative content and references to avoid empty pages.
  * Employs `textDecoration: "none"` on bold coral links to display clean citations.

### G. Autocomplete Cache Conflicts (`CacheConflictModal.tsx`)
* **File Reference**: [CacheConflictModal.tsx](file:///d:/Coding/KOBIE_hackathon/frontend/components/analyst/CacheConflictModal.tsx)
* **Props**:
  ```typescript
  interface CacheConflictProps {
    open: boolean;
    query: string;
    matches: Program[];
    onLoadCache: (program: Program) => void;
    onForceCrawl: () => void;
    onCancel: () => void;
  }
  ```
* **UX detail**: Warns the user when a program name fuzzy-matches existing completed entries, preventing accidental API key usage.

### H. Chat widget (`ChatWidget.tsx`)
* **File Reference**: [ChatWidget.tsx](file:///d:/Coding/KOBIE_hackathon/frontend/components/analyst/ChatWidget.tsx)
* **Props**:
  ```typescript
  interface ChatWidgetProps {
    messages: ChatMessage[];
    onSendMessage: (text: string) => Promise<void>;
    isLoading: boolean;
    programName: string;
  }
  ```
* **UX detail**: Employs React refs (`messagesEndRef`) inside a `useEffect` hook to scroll new messages into view. Wipes conversation history on program switches to avoid context drift.

---

## ⚙️ 4. custom Hooks & Libraries Deep Dive

### A. API Connection State Hook (`useProgram.ts`)
* **File Reference**: [useProgram.ts](file:///d:/Coding/KOBIE_hackathon/frontend/hooks/useProgram.ts)
* **Role**: Encapsulates pipeline lifecycle states, mapping HTTP requests to UI updates.
* **States Managed**:
  * `phase`: `"idle" | "running" | "complete" | "failed"`.
  * `program`, `narrative`, `fields`, `chatMessages`.
* **Operations**:
  * `startPipeline(name)`: Dispatches program creation and kicks off the execution thread.
  * `sendMessage(text)`: Posts chat tokens to RAG channels.

### B. SSE Notification Receiver Hook (`useSSE.ts`)
* **File Reference**: [useSSE.ts](file:///d:/Coding/KOBIE_hackathon/frontend/hooks/useSSE.ts)
* **Role**: Establishes EventSource connections to FastAPI SSE routers.
* **Fallback Logic**: If connection drops or times out (10s limit), switches to an active HTTP polling loop. It maps status codes to a local translation map to reconstruct progress logs.

### C. Citation Parser & LCS Algorithm (`narrative.ts`)
* **File Reference**: [narrative.ts](file:///d:/Coding/KOBIE_hackathon/frontend/lib/narrative.ts)
* **LCS Optimization**: Replaced sliding-window searches with a **Dynamic Programming Longest Common Substring (LCS)** algorithm to resolve citations without freezing the browser's thread:
  ```typescript
  export function longestCommonSubstringLength(s1: string, s2: string): number {
    const len1 = s1.length;
    const len2 = s2.length;
    let prev = new Int32Array(len2 + 1);
    let curr = new Int32Array(len2 + 1);
    let max = 0;
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          curr[j] = prev[j - 1] + 1;
          if (curr[j] > max) max = curr[j];
        } else {
          curr[j] = 0;
        }
      }
      const temp = prev;
      prev = curr;
      curr = temp;
      curr.fill(0);
    }
    return max;
  }
  ```

---

## 📱 5. Responsive Design Safeguards

The workspace layout scales across viewports using Tailwind classes:
* **Sidebar Layouts**: Desktop sidebars display parallel layouts, adapting on tablet and mobile viewports (`flex flex-col lg:flex-row`).
* **Interactive Tables**: Horizontal scrolls (`overflow-x-auto`) prevent layout breaks in the parameters grids.
* **Component scaling**: Responsive grid classes (`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3`) adjust admin metrics tables.
* **Drawer resizing**: Adjusts sliding sheet components (`w-[480px] sm:w-[540px]`) to maintain readability on smaller viewports.

---

## 📸 6. Judges' Presentation Screenshot Checklist

To showcase the front-end layout effectively in presentations, capture these views:
1. **Workspace Landing**: Showing autocomplete entries, recent searches, and telemetry numbers.
2. **Live SSE Process Steps**: Capture during extraction to show logs streaming.
3. **Executive Brief**: Showing citation link styles and formatting.
4. **Evidence Drawer**: Showing highlighted quotes and metadata.
5. **Parameters Grid Table**: Showing category tabs and search filters.
6. **Multi-Program Workspace**: Renders comparison views.
7. **Admin Dashboard**: Renders health indicators, key costs, and charts.
