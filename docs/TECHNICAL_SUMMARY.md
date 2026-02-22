# CloudWise AI: Comprehensive Technical & Security Architecture

> **Date:** 2026-02-22  
> **Status:** Live Implementation Summary  

---

## 1. Project Overview & Platform Architecture

**CloudWise AI** is a production-grade Agentic AI platform engineered to automate cloud infrastructure optimization, code quality auditing, and security vulnerability detection. Targeting small to medium engineering teams, the platform acts as an automated, highly-affordable Cloud Architect and Security Engineer.

The overarching platform architecture revolves around a **Peer-to-Peer (P2P) Transient Data Model**. Code is never ingested into a persistent data lake or cloned into a permanent static volume. Instead, the API Gateway handles strict uploading, cloning, and scanning inside hardened, ephemeral sandboxes. Once the multi-agent pipeline extracts the necessary topological intelligence, the raw source files are instantly destroyed.

---

## 2. Multi-Agent System (MAS) Architecture

CloudWise AI moves beyond standard conversational LLM bots by organizing logic into a **Sequential "Chain of Thought" Agent Pipeline**. While early architectural drafts (as noted in `PROJECT_DOCUMENTATION.md`) idealized an unstructured "Agent Swarm" with complex LangGraph graphs and horizontal Agent-to-Agent (A2A) cross-talk, the implemented v1 architecture embraces a highly deterministic, specialized sequence. 

This ensures rate limit compliance, token budgeting, and zero hallucination propagation.

### 2.1 The Agent Roster & Execution Flow

The system orchestrates a unified context across multiple specialized agent personas:

1. **The Planner Agent (Supervisor):**
   - **Role:** Analyzes the raw directory tree structure and dependency management files (`package.json`, `requirements.txt`).
   - **Output:** Identifies the tech stack, outlines the core architecture type (e.g., "Monolith REST API"), and maps entry points. This data becomes the foundational truth passed to all subsequent agents.

2. **The Security Analyst Agent:**
   - **Role:** Correlates the Planner's stack topography with explicit static code analysis findings.
   - **Scope:** Flags Hardcoded Secrets, Insecure Overrides, Outdated Dependencies, and Infrastructure-as-Code (IaC) misconfigurations.
   - **Output:** Generates the Security Pillar score and a list of structured, actionable vulnerabilities.

3. **The Cloud Architect Agent:**
   - **Role:** Merges the Stack topography with the user's actual code execution patterns.
   - **Scope:** Evaluates whether the application belongs on AWS Lambda, GCP Cloud Run, or Azure App Service.
   - **Output:** Recommends precise deployment strategies, generates infrastructure templates, and estimates compute sizing.

4. **The Quality Auditor Agent:**
   - **Role:** Grades the codebase strictly across 6 remaining pillars: Maintainability, Scalability, Observability, Testability, Modularity, and Efficiency.
   - **Output:** Code review feedback and architectural refactoring recommendations.

5. **The Critic & Reporter (Deterministic Synthesizers):**
   - **Role:** Pure Python orchestrators that act as the final checkpoint. They deduplicate the LLMs' findings, compute final arithmetic averages for scoring, and aggregate the outputs into a strict, validated JSON analytical report ready for DB persistence.

### 2.2 Model Context Protocol (MCP) & Data Budgeting

To prevent LLM token overflow or context dilution (where an LLM "forgets" instructions due to massive files), the orchestrator (`code_scanner_llm_extension.py`) enforces strict MCP principles:
- **Intelligent Sampling:** Source files are truncated to a maximum of 3,000 characters each.
- **Strict Bounding:** The total compiled context injected into the agents is capped at 8,000 characters.
- **Self-Healing Retries:** If an LLM encounters a `413 Token Overflow` or rate limit, the orchestrator catches it, slices the context window in half, and automatically retries the prompt without crashing the pipeline.

---

## 3. Production Security & Anti-Spoofing Operations

When analyzing proprietary source code and managing developer resources, CloudWise AI enforces strict **Defense in Depth** security protocols across both backend logic and frontend edge execution.

### 3.1 Mitigation of Client-Side State Spoofing
Modern frontend Single Page Applications (SPAs) are susceptible to Client-Side Trust Violations (e.g., an attacker modifying `localStorage` or `sessionStorage` to simulate an `"admin"` role). As explicitly documented heavily in `#SECURITY_PATCH_CLIENT_STATE.md`, our architecture utilizes a 3-layer Zero Trust model on the frontend:

1. **Cryptographic Edge Routing (JWT):** The Next.js Edge Middleware flatly ignores manually editable JSON browser cookies. It extracts the strictly `HttpOnly` protected `access_token`, decodes the Base64Url payload, and extracts the signed identity. Spoofing a payload invalidates the cryptographic signature, locking attackers out of sensitive layouts like `/admin`.
2. **Server-Side State Synchronization:** React frontend components execute an immediate background poll to the backend (`/api/v1/auth/me`) upon page hydration. If an attacker injects `"totp_enabled": true` into their local session to bypass Two-Factor Authentication, the frontend aggressively overwrites their browser storage using the unforgeable backend database truth, instantly redirecting them to forced checkpoints.
3. **Graceful Security Ejection:** The global API client (`api.ts`) safely intercepts all `403 Forbidden` API responses. Attempts to brute-force or breach protected data APIs instantly trigger a programmatic eviction, scrubbing the session memory and routing the attacker back to the root unprivileged dashboard.

### 3.2 Authentication & Loop Breakers
The `auth.py` and `dependencies.py` services provide:
- **TOTP-based Two-Factor Authentication** enforcement.
- **Hardened Logout Sequences:** To prevent infinite redirect loops on the Next.js frontend, destroying a session sends an active command directly to the FastAPI backend, commanding the browser header to securely evict `HttpOnly` cookies before routing the user away.

### 3.3 Authorization & Rate Limiting
All APIs sit behind `slowapi` Rate Limiters, restricting brute-force behaviors on login and preventing abuse of the LLM analysis endpoints via IP-address thresholding.
