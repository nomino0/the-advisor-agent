# CloudWise AI — Agent Architecture Documentation

> Last updated: 2026-02-19  
> Author: auto-generated from source audit

---

## 1. What Kind of Agent System Is This?

CloudWise implements a **single-orchestrator, sequential LLM pipeline** — sometimes called a *chain-of-thought agent chain*. It is **not**:

- A multi-agent system with autonomous agents communicating peer-to-peer (no A2A).
- A tool-using agent (no function calls, no tool registry, no ReAct loop).
- A parallel agent system (all steps run sequentially, one LLM call at a time).
- An agent framework (no LangChain, AutoGen, CrewAI, or similar).

The six "agents" in the codebase are **named prompt roles** sent to the same underlying LLM (Groq / Kimi K2). Each role gets its own focused prompt and returns structured JSON. The orchestrator then threads the outputs together manually in Python.

---

## 2. Entry Points

```
POST /api/v1/analysis/connect   →  API layer (analysis.py)
POST /api/v1/analysis/upload    →  API layer (analysis.py)
```

Both endpoints:
1. Clone / extract the repository or ZIP into a temporary directory.
2. Call `scan_directory()` (static scanner).
3. Call `extract_context_for_llm()` (smart file sampler).
4. Create an `Analysis` DB row with status `PENDING`.
5. Fire-and-forget `run_analysis_pipeline()` as a background task.
6. Return `201 Created` immediately to the client.

---

## 3. Orchestration Layer

**File:** `backend/app/services/analysis_service.py`  
**Function:** `run_analysis_pipeline(analysis_id, scan_result, plan_tasks)`

This is the **only orchestrator**. It does not delegate to agents — it calls the LLM pipeline function directly.

```
run_analysis_pipeline()
    │
    ├── Mark Analysis row → PROCESSING
    ├── (P2P mode) _build_scan_from_plan_tasks()   ← reads local files via PlannerService
    │
    └── _generate_llm_enhanced_report(scan, project_name, analysis_id, db)
            │
            └── Sequential agent chain (see section 4)
```

There is no message bus, no task queue, no agent registry, and no routing logic. The orchestrator is a single `async def` function that calls one other `async def` function.

---

## 4. The Agent Chain

**File:** `backend/app/services/analysis_service_extension.py`  
**Function:** `_generate_llm_enhanced_report()`

All six agents share:
- The same LLM instance (`llm_service` — Groq client, model: `moonshotai/kimi-k2-instruct-0905`).
- The same code context string (a subset of the scanned files, capped at 8,000 chars).
- The same database session (for writing `AnalysisLog` rows).

Each "agent" is implemented as:
1. A `log_event()` call → writes an `AnalysisLog` row (for UI trace display).
2. A `call_llm_with_retry()` call → sends a prompt to the LLM and receives JSON.
3. Python code that reads fields out of the returned JSON.

### 4.1 Step 1 — Planner

**Prompt role:** Senior Cloud Architect  
**Input:** project stats, code context (8K chars)  
**Output JSON keys:** `detected_stack`, `primary_entry_points`, `architecture_type`, `key_observations`  
**Side effects:** writes 3–4 `AnalysisLog` rows  

The Planner's output (`detected_stack`, `arch_type`, `key_observations`) is passed as **plain string interpolation** into subsequent agent prompts. There is no structured message passing — the orchestrator reads Python dict keys and formats them into f-strings.

### 4.2 Step 2 — Security Agent

**Prompt role:** Security Analyst  
**Input:** project name, detected stack (from Planner), static scanner findings, code context  
**Output JSON keys:** `security_score`, `security_grade`, `security_findings_count`, `security_critical_count`, `security_findings[]`  
**Side effects:** 2 `AnalysisLog` rows  

The static scanner findings (`scan["findings"]`) are injected into this prompt via `_format_static_findings()` so the LLM is anchored to real detected patterns rather than hallucinating.

### 4.3 Step 3 — Cloud Architect

**Prompt role:** Cloud Infrastructure Architect  
**Input:** project name, detected stack, architecture type, project stats, code context  
**Output JSON keys:** `recommended_provider`, `rationale`, `cloud_recommendations[]`, `deployment_guide`  
**Side effects:** 2 `AnalysisLog` rows  

This agent runs independently of the Security Agent — it does not read security findings. It receives Planner outputs only.

### 4.4 Step 4 — Quality Auditor

**Prompt role:** Senior Code Quality Auditor  
**Input:** project name, detected stack, Planner observations, static findings summary, code context  
**Output JSON keys:** `pillar_scores[]`, `quality_findings[]`  
**Side effects:** 2 `AnalysisLog` rows  

The `pillar_scores` array covers 7 named pillars: Security, Maintainability, Scalability, Observability, Testability, Modularity, Efficiency.

### 4.5 Step 5 — Critic

**Implementation:** Pure Python (no LLM call)  
**Input:** `security_data`, `quality_data`, `cloud_data`, `scan["findings"]`  
**Task:**
- Merges `security_findings` + `quality_findings` + static findings.
- Deduplicates by title (case-insensitive).
- Overrides the Security pillar score in `pillar_scores` with the Security Agent's score.
- Sanitises/validates all pillar scores via `_validate_pillar_scores()`.
- Calculates `overall_score` as the arithmetic mean of pillar scores.
**Side effects:** 2 `AnalysisLog` rows  

> The Critic is the only agent that does not make an LLM call. It is a deterministic merge/validation function.

### 4.6 Step 6 — Reporter

**Implementation:** Pure Python (no LLM call)  
**Input:** merged findings, pillar scores, cloud recommendations, deployment guide  
**Task:**
- Assembles the final `report` dict.
- Validates that all required keys are present.
- Falls back to `_complete_pillar_scores()` if fewer than 7 pillars were returned.
**Output:** `{ overall_score, pillar_scores, findings, cloud_recommendations, deployment_guide }`  
**Side effects:** 1 `AnalysisLog` row  

---

## 5. Context Management

**File:** `backend/app/services/code_scanner_llm_extension.py`  
**Function:** `extract_context_for_llm(directory, scan_result)`

This function runs **before** the agent chain and produces the `llm_context` string injected into every agent prompt.

Strategy:
1. Builds a file tree summary (directory structure as text).
2. Identifies priority files: `README`, `Dockerfile`, `requirements.txt`, `package.json`, config files, files with static scan findings.
3. Reads priority files first, then fills remaining budget with representative source files.
4. Caps each file at 3,000 chars and the total context at 20,000 chars (~5,000 tokens).
5. Returns a single formatted string.

All six agents receive the **same context string**, truncated to `AGENT_CONTEXT_CHARS = 8,000` per call inside `call_llm_with_retry()`.

---

## 6. Error Handling and Retries

**Function:** `call_llm_with_retry(prompt, system, context_key, context_val)`

- Maximum retries: `MAX_RETRIES = 2` (3 attempts total).
- On a 413 / `rate_limit_exceeded` / token-overflow error: context is halved and the call is retried after a 1-second sleep.
- On any other exception: re-raised immediately.
- If all retries fail: the entire `_generate_llm_enhanced_report()` raises; `run_analysis_pipeline()` catches it and marks the `Analysis` row as `FAILED`.

---

## 7. P2P Local-Path Mode

**Function:** `_build_scan_from_plan_tasks(plan_tasks, analysis, db)`

When the analysis is triggered by a P2P connection (the user grants access to local files rather than a remote repository), `PlannerService` runs **synchronously** in the API layer before the background task starts.

`PlannerService` (file-system only, no LLM):
1. Walks the project directory (`os.walk`), respecting `SKIP_DIRS`.
2. Detects the tech stack by checking for marker files (`package.json`, `requirements.txt`, `manage.py`).
3. Produces three `ExecutionTask` objects: `SecurityAgent`, `CloudAgent`, `BestPractices`.
4. Returns an `AnalyzeResult` with `stack`, `tasks`, `security_score`, `risk_level`.

These tasks are passed to `_build_scan_from_plan_tasks()` which reads the designated files (capped at 4,000 chars each) and assembles a `scan_result` dict that mirrors the output of `scan_directory()`. From this point the pipeline is identical to the GitHub/upload path.

---

## 8. What Is NOT Agent-to-Agent (A2A) Communication

A true A2A system would require agents to:
- Invoke each other directly (e.g., Security Agent calling Cloud Agent with a query).
- Negotiate, delegate sub-tasks, or share a message queue between peers.
- Maintain individual state or memory across invocations.

In this codebase:
- Agents do not call each other. The orchestrator calls them in order.
- Information flows only downward through the chain (Planner → Security/Cloud/Quality → Critic → Reporter) via Python variables, not agent-to-agent messages.
- No agent has persistent memory. Each LLM call starts from scratch with its injected prompt.
- The `SecurityManager` / `AgentIdentity` classes provide **access control and risk scoring**, not message routing. They are a security gate, not an orchestration bus.

---

## 9. LLM Service

**File:** `backend/app/services/llm_service.py`  
**Class:** `LLMService`  

- Provider: Groq (synchronous REST SDK `groq.Groq`).
- Model: `moonshotai/kimi-k2-instruct-0905`.
- The `generate_completion()` method is `async` but internally wraps the blocking SDK call in `asyncio.to_thread()` to avoid blocking the ASGI event loop.
- Temperature: 0.6, max tokens: 4,096.
- All six agent prompts use the same LLM instance (singleton `llm_service`).

---

## 10. Data Written to the Database

| Table           | When written                 | Content                                      |
|-----------------|------------------------------|----------------------------------------------|
| `Analysis`      | On creation (API layer)      | status=PENDING, project_name, user_id        |
| `Analysis`      | On processing start          | status=PROCESSING, total_files, total_lines  |
| `Analysis`      | On completion                | status=COMPLETED, all scores, report_data    |
| `AnalysisLog`   | Each `log_event()` call      | agent_name, action, details, timestamp       |
| `AgentExecution`| After pipeline completes     | agent_name, status, fake token/time metrics  |

> Note: `AgentExecution` rows are written with randomised `tokens_used` and `execution_time_ms` values. These are not real measured metrics — they are placeholders.

---

## 11. Diagram

```
API Request (POST /connect or /upload)
        │
        ▼
  [scan_directory()]          ← static scanner, runs synchronously
  [extract_context_for_llm()] ← smart file sampler, runs synchronously
        │
        ▼
  Background Task: run_analysis_pipeline()
        │
        ▼
  _generate_llm_enhanced_report()
        │
        ├─── [LLM call 1] Planner prompt
        │         └── returns: stack, arch_type, entry_points, observations
        │
        ├─── [LLM call 2] Security prompt  (uses Planner output)
        │         └── returns: security_score, security_findings[]
        │
        ├─── [LLM call 3] Cloud prompt  (uses Planner output)
        │         └── returns: cloud_recommendations[], deployment_guide
        │
        ├─── [LLM call 4] Quality prompt  (uses Planner output)
        │         └── returns: pillar_scores[], quality_findings[]
        │
        ├─── [Python] Critic merge  (no LLM call)
        │         └── deduplicates findings, calculates overall_score
        │
        └─── [Python] Reporter assemble  (no LLM call)
                  └── returns final report dict → persisted to DB
```

All LLM calls go to the same model through the same `LLMService` instance.  
All calls are sequential — there is no parallelism in the current implementation.
