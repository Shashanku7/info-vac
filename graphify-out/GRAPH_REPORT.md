# Graph Report - .  (2026-06-29)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 767 nodes · 1630 edges · 54 communities (43 shown, 11 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 155 edges (avg confidence: 0.55)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `025d3d19`
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
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 52|Community 52]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 88 edges
2. `Program` - 26 edges
3. `ExtractedField` - 25 edges
4. `Narrative` - 20 edges
5. `ChatRequest` - 19 edges
6. `Comparison` - 18 edges
7. `discover_sources()` - 18 edges
8. `compute_confidence()` - 18 edges
9. `ExtractedValue` - 17 edges
10. `FallbackCompletions` - 17 edges

## Surprising Connections (you probably didn't know these)
- `DummyExtractedSchema` --uses--> `GateResult`  [INFERRED]
  tests/test_comprehensive_system.py → backend/gate.py
- `DummyProgramBasics` --uses--> `GateResult`  [INFERRED]
  tests/test_comprehensive_system.py → backend/gate.py
- `DummyExtractedSchema` --uses--> `PipelineState`  [INFERRED]
  tests/test_comprehensive_system.py → orchestrator/state.py
- `DummyProgramBasics` --uses--> `PipelineState`  [INFERRED]
  tests/test_comprehensive_system.py → orchestrator/state.py
- `embed_node()` --calls--> `chunk_text()`  [EXTRACTED]
  orchestrator/nodes.py → backend/embeddings.py

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

## Communities (54 total, 11 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (80): ChatRequest, ChatResponse, handle_chat_message(), AsyncSession, MarketMatrixOutput, MatrixItem, Comparator — Phase 6.  Generates a strategic competitive comparison between mult, Rankings and rationale for a single loyalty program category. (+72 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (59): BurnMechanics, CompetitivePosition, DigitalExperience, EarnMechanics, EvidenceState, EvidenceStateValue, ExtractedSchema, ExtractedValue (+51 more)

### Community 2 - "Community 2"
Cohesion: 0.04
Nodes (45): dependencies, ai, @base-ui/react, class-variance-authority, clsx, cmdk, lucide-react, next (+37 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (38): compute_confidence(), _corroboration_score(), _detect_contradiction(), Verifier — Phase 3.  Deterministic confidence formula and contradiction detectio, Full verifier output for one field., Fraction of distinct sources that support this value.      'Distinct' = unique s, Check if multiple gate-verified values disagree with each other.      Two values, Compute confidence for one field using the deterministic formula.      This is t (+30 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (27): AsyncClient, _Candidate, _check_robots(), _classify_source(), clean_utf8_mojibake(), discover_sources(), _firecrawl_fetch(), AsyncSession (+19 more)

### Community 5 - "Community 5"
Cohesion: 0.10
Nodes (29): _build_comparison_context_multi(), compare_programs(), _load_program_data(), Any, AsyncSession, ExtractedField, UUID, Build the GROUNDED DATA block with multiple programs side by side. (+21 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (29): _build_context(), _calculate_usage_cost(), _call_narrator(), _count_words(), generate_narrative(), Any, AsyncSession, ExtractedField (+21 more)

### Community 7 - "Community 7"
Cohesion: 0.14
Nodes (19): ConfidenceBarChart(), ConfidenceBarChartProps, CostCard(), CostCardProps, COLORS, GateDonutChart(), GateDonutChartProps, DEFAULT_COLORS (+11 more)

### Community 8 - "Community 8"
Cohesion: 0.17
Nodes (21): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage(), Progress(), ProgressIndicator() (+13 more)

### Community 9 - "Community 9"
Cohesion: 0.16
Nodes (19): make_background_session(), Database connection — async SQLAlchemy engine + session factory., NullPool session for background pipeline tasks.      Creates a brand-new engine, One-shot LLM retry for fields that failed gate verification.      Called by veri, retry_failed_fields(), emit_event(), Pipeline event emission and program status helpers.  Separated from nodes.py so, Insert a pipeline_events row.      The Postgres trigger `trg_pipeline_event` fir (+11 more)

### Community 10 - "Community 10"
Cohesion: 0.15
Nodes (21): find_best_source_for_quote(), gate_verify(), gate_verify_batch(), GateResult, Citation-Verification Gate — Phase 2.  Every non-null field extracted by the Ext, Verify multiple fields against one source in a single call.      Args:         f, Scan ALL fetched sources to find where evidence_quote best matches.      Called, Result of a single gate verification. (+13 more)

### Community 11 - "Community 11"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 12 - "Community 12"
Cohesion: 0.13
Nodes (18): Embed query, compute sparse TF-IDF, and execute Qdrant RRF hybrid search., _sync_search_qdrant(), embed_texts(), _get_gemini_keys(), Convert a list of text chunks into vector embeddings using Google's API with key, Returns a list of all configured Gemini keys, checking GEMINI_API_KEYS and singl, _call_llm_judge(), Verify if the quote is semantically present in context, allowing minor formattin (+10 more)

### Community 13 - "Community 13"
Cohesion: 0.18
Nodes (14): AdminDashboard(), deriveStats(), AnalystWorkspace(), FieldsGrid(), Toaster(), Tabs(), TabsContent(), TabsList() (+6 more)

### Community 14 - "Community 14"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 15 - "Community 15"
Cohesion: 0.14
Nodes (16): ProgramName, Instructor + Gemini smoke test — Phase 0.  Demonstrates that:   1. Instructor wr, Single-field model — simplest possible extraction target., run_smoke_test(), _get_asyncpg_conn(), Phase 0 Definition-of-Done tests.  All five tests must pass for Phase 0 to be, DoD: that UUID is a real row in programs., DoD: standalone script → one Instructor+Gemini call returns valid parsed Pydanti (+8 more)

### Community 16 - "Community 16"
Cohesion: 0.18
Nodes (12): BriefView(), BriefViewProps, parseBriefWithSuperscripts(), renderParagraphs(), EvidenceDrawer(), EvidenceDrawerProps, ExportBar(), ExportBarProps (+4 more)

### Community 17 - "Community 17"
Cohesion: 0.17
Nodes (9): ScrollArea(), ScrollBar(), Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay() (+1 more)

### Community 18 - "Community 18"
Cohesion: 0.12
Nodes (9): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+1 more)

### Community 19 - "Community 19"
Cohesion: 0.18
Nodes (13): extract_node(), iter_fields(), PipelineState, Pipeline state definition and field iteration helpers., Yield (category_key, field_name, ev_dict) for every field in the schema.      Ar, Shared state flowing through the LangGraph pipeline.      All values must be JSO, _make_state(), Phase 4 orchestrator — unit tests (no live marker).  Tests:   test_pipeline_e (+5 more)

### Community 20 - "Community 20"
Cohesion: 0.30
Nodes (13): WorkspacePhase, apiFetch(), comparePrograms(), createProgram(), getChatHistory(), getComparison(), getEvolution(), getExtractedFields() (+5 more)

### Community 21 - "Community 21"
Cohesion: 0.18
Nodes (12): ComparatorPicker(), ComparatorPickerProps, ChatWidgetProps, ChangelogItem, ChatHistory, ChatMessage, ChatResponse, Comparison (+4 more)

### Community 22 - "Community 22"
Cohesion: 0.25
Nodes (9): ChatWidget(), QUICK_PROMPTS, ProgramInput(), ProgramInputProps, Badge(), badgeVariants, Button(), buttonVariants (+1 more)

### Community 23 - "Community 23"
Cohesion: 0.26
Nodes (10): col, columns, Table(), TableBody(), TableCaption(), TableCell(), TableFooter(), TableHead() (+2 more)

### Community 24 - "Community 24"
Cohesion: 0.23
Nodes (9): ALL_FIELDS, CATEGORY_FIELDS, PipelineTracker(), PipelineTrackerProps, UseSSEOptions, UseSSEReturn, getSSEUrl(), PipelineEvent (+1 more)

### Community 25 - "Community 25"
Cohesion: 0.20
Nodes (6): DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogOverlay(), DialogTitle()

### Community 26 - "Community 26"
Cohesion: 0.31
Nodes (9): gate_verify_multi_source(), Verify each segment of evidence_quote against ALL available sources.          Re, get_public_trace_url(), Make the LangSmith run public and return the shareable link., Public entry point called by FastAPI background task.      Runs the full LangG, run_pipeline(), verify_node(), Comprehensive System Integration Test.          Covers:       1. Graph Node Exec (+1 more)

### Community 27 - "Community 27"
Cohesion: 0.53
Nodes (5): chunk_text(), Split raw text into semantic chunks for vector search., test_chunk_text_empty(), test_chunk_text_preserves_sentences(), test_chunk_text_splits_large_text()

### Community 28 - "Community 28"
Cohesion: 0.40
Nodes (5): Alert(), AlertAction(), AlertDescription(), AlertTitle(), alertVariants

### Community 29 - "Community 29"
Cohesion: 0.33
Nodes (5): Phase 4 orchestrator — live e2e test.  Requires:   - docker compose up -d  (P, Full pipeline run via real API.      DoD: programs.status = 'complete' within, Create a program, start pipeline, collect SSE events, assert order.      Uses, test_e2e_run_completes(), test_sse_events_in_correct_order()

### Community 30 - "Community 30"
Cohesion: 0.60
Nodes (4): ensure_collection(), get_qdrant_client(), Ensure the Qdrant collection exists for storing source chunks.      Upgraded for, QdrantClient

### Community 31 - "Community 31"
Cohesion: 0.40
Nodes (3): geistMono, geistSans, metadata

### Community 39 - "Community 39"
Cohesion: 0.67
Nodes (3): get_db(), AsyncSession, FastAPI dependency — yields an async DB session.

## Knowledge Gaps
- **107 isolated node(s):** `geistSans`, `geistMono`, `metadata`, `$schema`, `style` (+102 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Community 8` to `Community 32`, `Community 7`, `Community 13`, `Community 17`, `Community 18`, `Community 22`, `Community 23`, `Community 25`, `Community 28`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Community 2` to `Community 13`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `sonner` connect `Community 13` to `Community 2`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `Program` (e.g. with `MarketMatrixOutput` and `MatrixItem`) actually correct?**
  _`Program` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 14 inferred relationships involving `ExtractedField` (e.g. with `ChatRequest` and `ChatResponse`) actually correct?**
  _`ExtractedField` has 14 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Add raw_html TEXT column to sources table.      Stores up to 80K chars of raw HT`, `Add citation_start and citation_end columns to extracted_fields.      Used to st`, `Add total_cost column to programs table.      Tracks accumulated LLM API cost in` to the rest of the system?**
  _274 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06287985039738195 - nodes in this community are weakly interconnected._