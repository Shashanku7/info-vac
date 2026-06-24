Autonomous Competitive Intelligence Agent
Build an autonomous Al agent that researches any loyalty program from the live web
- producing a structured, source-attributed brief. Every factual claim traces to a
verifiable URL. Two-program comparison supported.

TRACK D
Competitive Intelligence
Research Agent

The Challenge: Understanding a competitor's loyalty program today requires hours of
manual research across scattered web sources. Build an Al agent that does it
autonomously.

Key Words
GenAI Track, Agentic AI, Web Research, Information Extraction

What are we looking for
We're looking for builders who think in systems, not prompts.

Aiming for
Build something that makes competitive intelligence effortless.

Business Context
Kobie serves enterprise loyalty clients across QSR, retail,
hospitality, and financial services. Competitive intelligence is a
core strategic capability. A working version of this system would
directly accelerate how we advise clients on program design
and positioning.

Discover: Find relevant web sources - not just the homepage. FAQS, T&Cs, app reviews, press releases, news.
2. Extract: Parse content into a structured 35+ field schema: earn mechanics, burn rules, tiers,partnerships, sentiment.
3. Verify: Cross-check claims against sources. Flag contradictions. Every fact must link to a real, verifiable URL.
4. Narrate: Produce a 500-1000 words competitive brief an analyst could use in a client-facing strategy deck.
5. Compare: Given two programs, identify strategic advantages, gaps, and differentiation - not just side-by-side data.
6. Converse: The system should support follow-up questions about extracted data ("What are the key differences in their tier systems?", "What changed in the last 6 months?").


Expected Architecture
6-Component System
Clearly separated components - not a single LLM prompt wrapped in a script.
Orchestrator - Decomposes task, manages pipeline, retries 
Retriever - Web search, page fetch, rate limiting
Extractor - Structured info from raw web content
Verifier - Cross-check facts, flag contradictions
5. Narrator - Structured JSON analyst-grade prose 
6. Comparator -Two-program strategic analysis

What to Avoid
Asking an LLM to 'research [program]'
Scraping the homepage and summarizing
Hard-coding knowledge for test programs
Relying on LLM training data

8 Schema Categories - Map each program to a complete, structured profile.
Program Basics - Name, brand, industry, type, geography, membership count
Partnerships - Partner names, partnership typе (earn/burn/both), details
Earn Mechanics - Base earn rate, bonus categories, non transactional earn
Digital Experience -Mobile app, app ratings, personalization,gamification
Burn Mechanics - Redemption options, thresholds, point value, expiry policy
Member Sentiment - Ratings, common praise, common complaints, sources checked
Tier System - Tier names, qualification criteria, benefits, qualification period
Competitive Position - Key differentiators, weaknesses, closest competitors

35+ fields across 8 top-level categories.
Every value traceable to a source URL.
THE NON-NEGOTIABLE : Every factual claim must include source_url and
access_date.
Unattributed claims = hallucinations.


Proposal & Evaluation
How You'll Be Evaluated
Scoring rubric and asymmetric reward structure.
Factual Accuracy : 35
Schema Completeness : 15
Source Attribution  : 15
Narrative Quality : 10
Comparison Quality : 10
System Robustness : 10
Code & Architecture : 10

Key Insight 
Scoring is asymmetric 
Correct match +1
Honest null +0.5
Miss 0
Hallucination -3

Precision over recall. Honest
uncertainty beats confident
fabrication.

Hallucinated claims are penalised at 3x the rate of
honest 'unknown' responses.


YOUR PROPOSAL SHOULD ADDRESS
Your strategy for grounding every claim in real web sources, not LLM parametric knowledge. How do you ensure the system retrieves, not invents?
Multi-component architecture design: source discovery extraction verification narrative. How do components interact?
3. Handling adversarial cases - programs with limited web resence, recently rebranded programs, non-English markets. What does graceful degradation look like?
4. How the system signals uncertainty rather than fabricating answers. What's your confidence scoring and null-handling strategy?