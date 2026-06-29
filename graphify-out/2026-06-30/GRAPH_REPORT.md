# Graph Report - KOBIE_hackathon  (2026-06-30)

## Corpus Check
- 133 files · ~75,966 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1025 nodes · 1972 edges · 82 communities (70 shown, 12 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 123 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `722ffc33`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 88|Community 88]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 88 edges
2. `Program` - 28 edges
3. `ExtractedField` - 28 edges
4. `Source` - 24 edges
5. `Narrative` - 20 edges
6. `ChatRequest` - 18 edges
7. `discover_sources()` - 18 edges
8. `compute_confidence()` - 18 edges
9. `ExtractedField` - 18 edges
10. `Comparison` - 17 edges

## Surprising Connections (you probably didn't know these)
- `DummyExtractedSchema` --uses--> `GateResult`  [INFERRED]
  tests/test_comprehensive_system.py → backend/gate.py
- `DummyProgramBasics` --uses--> `GateResult`  [INFERRED]
  tests/test_comprehensive_system.py → backend/gate.py
- `_call_llm_judge()` --calls--> `_make_client()`  [INFERRED]
  orchestrator/nodes.py → backend/llm_client.py
- `_call_llm()` --calls--> `_make_client()`  [INFERRED]
  tests/eval_ragas.py → backend/llm_client.py
- `DummyExtractedSchema` --uses--> `PipelineState`  [INFERRED]
  tests/test_comprehensive_system.py → orchestrator/state.py

## Import Cycles
- 1-file cycle: `backend/qdrant_client.py -> backend/qdrant_client.py`
- 1-file cycle: `frontend/components/ui/button.tsx -> frontend/components/ui/button.tsx`
- 1-file cycle: `frontend/components/ui/sonner.tsx -> frontend/components/ui/sonner.tsx`
- 1-file cycle: `frontend/components/ui/tabs.tsx -> frontend/components/ui/tabs.tsx`
- 1-file cycle: `frontend/components/ui/scroll-area.tsx -> frontend/components/ui/scroll-area.tsx`
- 1-file cycle: `frontend/components/ui/input.tsx -> frontend/components/ui/input.tsx`
- 1-file cycle: `frontend/components/ui/progress.tsx -> frontend/components/ui/progress.tsx`
- 1-file cycle: `frontend/components/ui/avatar.tsx -> frontend/components/ui/avatar.tsx`
- 1-file cycle: `frontend/components/ui/dialog.tsx -> frontend/components/ui/dialog.tsx`
- 1-file cycle: `frontend/components/ui/select.tsx -> frontend/components/ui/select.tsx`
- 1-file cycle: `frontend/components/ui/separator.tsx -> frontend/components/ui/separator.tsx`

## Hyperedges (group relationships)
- **Multi-Agent LangGraph Pipeline** — backend_retriever, backend_extractor, backend_gate, backend_verifier, backend_narrator [EXTRACTED 1.00]
- **Data Persistence & Vector Search** — backend_models, postgres_db, backend_qdrant_client [INFERRED 0.90]

## Communities (82 total, 12 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.15
Nodes (28): MarketMatrixOutput, MatrixItem, Comparator — Phase 6.  Generates a strategic competitive comparison between mult, Rankings and rationale for a single loyalty program category., Structured competitive market matrix comparison., gate_verify_multi_source(), Verify each segment of evidence_quote against ALL available sources.          Re, ProgramCreate (+20 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (54): BurnMechanics, CompetitivePosition, DigitalExperience, EarnMechanics, EvidenceState, EvidenceStateValue, ExtractedSchema, ExtractedValue (+46 more)

### Community 2 - "Community 2"
Cohesion: 0.04
Nodes (47): Toaster(), dependencies, ai, @base-ui/react, class-variance-authority, clsx, cmdk, lucide-react (+39 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (38): compute_confidence(), _corroboration_score(), _detect_contradiction(), Verifier — Phase 3.  Deterministic confidence formula and contradiction detectio, Full verifier output for one field., Fraction of distinct sources that support this value.      'Distinct' = unique s, Check if multiple gate-verified values disagree with each other.      Two values, Compute confidence for one field using the deterministic formula.      This is t (+30 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (28): AsyncClient, classify_source(), Source Classifier.  Classifies fetched sources into specific category groups usi, Classify source_type using a four-level priority chain.      Priority (highest t, _async_firecrawl_fetch(), _Candidate, _check_robots(), clean_utf8_mojibake() (+20 more)

### Community 5 - "Community 5"
Cohesion: 0.10
Nodes (29): _build_comparison_context_multi(), compare_programs(), _load_program_data(), Any, AsyncSession, ExtractedField, UUID, Build the GROUNDED DATA block with multiple programs side by side. (+21 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (30): _build_context(), _calculate_usage_cost(), _call_narrator(), _count_words(), generate_narrative(), Any, AsyncSession, ExtractedField (+22 more)

### Community 7 - "Community 7"
Cohesion: 0.14
Nodes (19): ConfidenceBarChart(), ConfidenceBarChartProps, CostCard(), CostCardProps, COLORS, GateDonutChart(), GateDonutChartProps, DEFAULT_COLORS (+11 more)

### Community 8 - "Community 8"
Cohesion: 0.19
Nodes (18): AlertAction(), AlertTitle(), Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage() (+10 more)

### Community 9 - "Community 9"
Cohesion: 0.16
Nodes (14): ALL_FIELDS, CATEGORY_FIELDS, PipelineTracker(), PipelineTrackerProps, UseSSEOptions, UseSSEReturn, getSSEUrl(), ChangelogItem (+6 more)

### Community 10 - "Community 10"
Cohesion: 0.23
Nodes (9): EvolutionTab(), EvolutionTabProps, ProgressCardLoader(), ProgressCardLoaderProps, SingleProgramView(), Alert(), AlertDescription(), alertVariants (+1 more)

### Community 11 - "Community 11"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 12 - "Community 12"
Cohesion: 0.04
Nodes (46): Built and verified, Built and verified, Decisions, Decisions, Decisions closed this session, Decisions & Findings closed this session, Design Decisions, Design Decisions (+38 more)

### Community 13 - "Community 13"
Cohesion: 0.22
Nodes (12): AdminDashboard(), deriveStats(), AnalystWorkspace(), FieldsGrid(), Tabs(), TabsContent(), TabsList(), tabsListVariants (+4 more)

### Community 14 - "Community 14"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 15 - "Community 15"
Cohesion: 0.14
Nodes (16): ProgramName, Instructor + Gemini smoke test — Phase 0.  Demonstrates that:   1. Instructor wr, Single-field model — simplest possible extraction target., run_smoke_test(), _get_asyncpg_conn(), Phase 0 Definition-of-Done tests.  All five tests must pass for Phase 0 to be, DoD: that UUID is a real row in programs., DoD: standalone script → one Instructor+Gemini call returns valid parsed Pydanti (+8 more)

### Community 16 - "Community 16"
Cohesion: 0.15
Nodes (17): BriefView(), BriefViewProps, renderParagraphs(), EvidenceDrawer(), ExportBar(), ExportBarProps, exportPDF(), SingleProgramViewProps (+9 more)

### Community 17 - "Community 17"
Cohesion: 0.18
Nodes (8): EvidenceDrawerProps, Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetTitle()

### Community 18 - "Community 18"
Cohesion: 0.12
Nodes (9): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+1 more)

### Community 19 - "Community 19"
Cohesion: 0.08
Nodes (36): get_db(), AsyncSession, FastAPI dependency — yields an async DB session., create_comparison(), create_program(), get_chat_history(), get_comparison(), get_narrative() (+28 more)

### Community 20 - "Community 20"
Cohesion: 0.17
Nodes (19): SOURCE_TYPE_LABELS, SourcesTab(), SourcesTabProps, WorkspacePhase, apiFetch(), comparePrograms(), createProgram(), getChatHistory() (+11 more)

### Community 21 - "Community 21"
Cohesion: 0.22
Nodes (11): ComparatorPicker(), ChatWidget(), ChatWidgetProps, QUICK_PROMPTS, Badge(), badgeVariants, Button(), buttonVariants (+3 more)

### Community 22 - "Community 22"
Cohesion: 0.18
Nodes (7): ComparatorPickerProps, SimilarProgramsModal(), SimilarProgramsModalProps, InputRowProps, ProgramInput(), ProgramInputProps, Program

### Community 23 - "Community 23"
Cohesion: 0.21
Nodes (12): col, columns, FieldsGridProps, Input(), Table(), TableBody(), TableCaption(), TableCell() (+4 more)

### Community 24 - "Community 24"
Cohesion: 0.17
Nodes (16): _build_golden_qa(), _build_ragas_llm(), _call_llm(), _fetch_program_data(), Any, InfoVac — RAGAS Evaluation Suite  Evaluates the RAG chat pipeline quality using, Auto-generate up to max_pairs QA pairs from gate-passed fields., Qdrant dense search for the question — returns top 5 text chunks. (+8 more)

### Community 25 - "Community 25"
Cohesion: 0.20
Nodes (6): DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogOverlay(), DialogTitle()

### Community 26 - "Community 26"
Cohesion: 0.11
Nodes (17): 10-Day Task Breakdown, Adversarial Case Handling, API Design, Confidence Formula, Database Schema, Endpoints, InfoVac: Solution Document, MVP Architecture (+9 more)

### Community 27 - "Community 27"
Cohesion: 0.18
Nodes (5): db_session(), AsyncSession, Fresh NullPool engine + session per test — no cross-loop asyncpg issues., Insert a Program row; delete it (+ cascaded sources) after each test., temp_program()

### Community 28 - "Community 28"
Cohesion: 0.12
Nodes (15): 1. PRD, 2. MVP Scope, 3. Tech Stack — final, 4. Architecture Diagram, 5. Database Schema, 6. API Design, 7. Wireframes (text format), 8. Task Breakdown — 10 days, 2 engineers (+7 more)

### Community 29 - "Community 29"
Cohesion: 0.33
Nodes (5): Phase 4 orchestrator — live e2e test.  Requires:   - docker compose up -d  (P, Full pipeline run via real API.      DoD: programs.status = 'complete' within, Create a program, start pipeline, collect SSE events, assert order.      Uses, test_e2e_run_completes(), test_sse_events_in_correct_order()

### Community 30 - "Community 30"
Cohesion: 0.40
Nodes (5): Progress(), ProgressIndicator(), ProgressLabel(), ProgressTrack(), ProgressValue()

### Community 31 - "Community 31"
Cohesion: 0.40
Nodes (3): geistMono, inter, metadata

### Community 32 - "Community 32"
Cohesion: 0.18
Nodes (11): CitationBadge(), CitationBadgeProps, ComparisonExportButton(), ComparisonExportButtonProps, LocalSource, MultiFlowWorkspace(), MultiFlowWorkspaceProps, Runner (+3 more)

### Community 43 - "Community 43"
Cohesion: 0.25
Nodes (7): Built and verified this session, Decisions made and why, Deviated from SOLUTION.md / PHASES.md?, Do not reconsider, Exact next step, Handoff — [timestamp] — Phase N [in progress / complete], Open / blocked

### Community 52 - "Community 52"
Cohesion: 0.17
Nodes (11): 1. Environment Setup, 1. The Multi-Agent Pipeline (Backend), 2. High-Density UI Workspace (Frontend), 2. Installation (Automated Setup), 3. Running the Platform (Single-Click), InfoVac — Autonomous Competitive Intelligence Platform, Prerequisites, 🚀 Quick Start (+3 more)

### Community 60 - "Community 60"
Cohesion: 0.50
Nodes (3): #1 — Robots.txt: what to do when the check fails or is ambiguous, #2 — Test suite: live API calls vs mocked for routine runs, InfoVac — Open Decisions Log

### Community 61 - "Community 61"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 81 - "Community 81"
Cohesion: 0.15
Nodes (21): find_best_source_for_quote(), gate_verify(), gate_verify_batch(), GateResult, Citation-Verification Gate — Phase 2.  Every non-null field extracted by the Ext, Verify multiple fields against one source in a single call.      Args:         f, Scan ALL fetched sources to find where evidence_quote best matches.      Called, Result of a single gate verification. (+13 more)

### Community 82 - "Community 82"
Cohesion: 0.25
Nodes (19): ChatRequest, ChatResponse, handle_chat_message(), AsyncSession, chat_with_program(), CompareRequest, ExtractedFieldResponse, PipelineEventResponse (+11 more)

### Community 83 - "Community 83"
Cohesion: 0.14
Nodes (13): FallbackChat, FallbackClient, FallbackCompletions, _get_available_backends(), _make_client(), Any, LLM Fallback Client.  Robust LLM client that provides automatic routing and fail, Return a list of available LLM configurations based on environment keys. (+5 more)

### Community 88 - "Community 88"
Cohesion: 0.05
Nodes (66): Embed query, compute sparse TF-IDF, and execute Qdrant RRF hybrid search., _sync_search_qdrant(), make_background_session(), Database connection — async SQLAlchemy engine + session factory., NullPool session for background pipeline tasks.      Creates a brand-new engine, chunk_text(), embed_texts(), _get_gemini_keys() (+58 more)

## Knowledge Gaps
- **199 isolated node(s):** `inter`, `geistMono`, `metadata`, `$schema`, `style` (+194 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Community 8` to `Community 7`, `Community 10`, `Community 13`, `Community 17`, `Community 18`, `Community 21`, `Community 54`, `Community 23`, `Community 25`, `Community 30`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Are the 13 inferred relationships involving `Program` (e.g. with `MarketMatrixOutput` and `MatrixItem`) actually correct?**
  _`Program` has 13 INFERRED edges - model-reasoned connections that need verification._
- **Are the 15 inferred relationships involving `ExtractedField` (e.g. with `ChatRequest` and `ChatResponse`) actually correct?**
  _`ExtractedField` has 15 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Add raw_html TEXT column to sources table.      Stores up to 80K chars of raw HT`, `Add citation_start and citation_end columns to extracted_fields.      Used to st`, `Add total_cost column to programs table.      Tracks accumulated LLM API cost in` to the rest of the system?**
  _379 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06779661016949153 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.041666666666666664 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.09024390243902439 - nodes in this community are weakly interconnected._