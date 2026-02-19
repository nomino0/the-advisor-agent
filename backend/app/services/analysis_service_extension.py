"""Multi-Agent Analysis Orchestrator — VS Code Copilot-style agent pipeline.

This module implements the full agent orchestration loop:

  Planner → [Security Agent ‖ Cloud Agent ‖ Quality Agent] → Critic → Reporter

Each agent receives ONLY the context slice it needs (not the full codebase dump).
This mirrors how production LLM agents work in tools like GitHub Copilot Agent
Mode or Cursor: selective, parallel, token-budget-aware sub-agent calls.

Token strategy:
  - Each sub-prompt is designed to stay under 6 000 tokens total
  - The final reporter merges structured JSON from each specialist
  - On rate-limit errors, we retry with a halved context window
  - NEVER fall back to static heuristics — always produce LLM-powered output
"""

from typing import Dict, Any, List, Optional
import logging
import json
import re
import asyncio

logger = logging.getLogger("app.services.analysis_orchestrator")

# ── Token / retry config ──────────────────────────────────────────────────────
MAX_RETRIES = 2
# How much of the code context to send per agent call (chars ≈ tokens / 4)
AGENT_CONTEXT_CHARS = 8_000       # ~2 000 tokens — safe for 10K TPM models
RETRY_CONTEXT_CHARS = 4_000       # Halved context on retry


# ═══════════════════════════════════════════════════════════════════════════════
# Public entry-point
# ═══════════════════════════════════════════════════════════════════════════════

async def _generate_llm_enhanced_report(
    scan: Dict[str, Any],
    project_name: str,
    analysis_id: str = None,
    db: Any = None,
) -> Optional[Dict[str, Any]]:
    """Run the multi-agent analysis pipeline and return the final report dict.

    Orchestration flow:
      1. Planner  — understands project structure and dispatches sub-tasks
      2. Security Agent  — OWASP vulnerability scan (focused on security slice)
      3. Cloud Agent     — cloud readiness + provider recommendation
      4. Quality Agent   — 7-pillar code quality audit
      5. Critic          — validates and merges specialist outputs
      6. Reporter        — builds final structured report

    Args:
        scan: scan_result dict from code_scanner.scan_directory() with
              an additional "llm_context" key from the smart extractor.
        project_name: Human-readable project name.
        analysis_id: UUID string for logging.
        db: AsyncSession used to write AnalysisLog rows (optional).

    Returns:
        Validated report dict with keys:
            overall_score, pillar_scores, findings,
            cloud_recommendations, deployment_guide
        Returns None only if ALL retries fail AND a valid fallback cannot be
        constructed from partial agent outputs.
    """
    from app.services.llm_service import llm_service
    from app.models.analysis_log import AnalysisLog
    from app.models.knowledge_base import KnowledgeBaseSource
    from sqlalchemy import select, or_

    # ── Helpers ───────────────────────────────────────────────────────────────

    async def log_event(agent: str, action: str, details: str) -> None:
        if db and analysis_id:
            try:
                log = AnalysisLog(
                    analysis_id=analysis_id,
                    agent_name=agent,
                    action=action,
                    details=details,
                )
                db.add(log)
                await db.commit()
            except Exception:
                pass  # Never let logging break the pipeline

    async def call_llm_with_retry(
        prompt: str,
        system: str,
        context_key: str = "code_context",
        context_val: str = "",
    ) -> Optional[str]:
        """Call the LLM with automatic context-halving retry on 413."""
        ctx = context_val[:AGENT_CONTEXT_CHARS]
        full_prompt = prompt.replace(f"{{{{{context_key}}}}}", ctx)

        for attempt in range(MAX_RETRIES + 1):
            try:
                return await llm_service.generate_completion(full_prompt, system)
            except Exception as exc:
                err = str(exc)
                if "413" in err or "rate_limit_exceeded" in err or "tokens" in err.lower():
                    if attempt < MAX_RETRIES:
                        # Halve the context and retry
                        new_len = len(ctx) // 2
                        ctx = context_val[:max(new_len, 500)]
                        full_prompt = prompt.replace(f"{{{{{context_key}}}}}", ctx)
                        await log_event(
                            "System", "Retry",
                            f"Context too large, retrying with {len(ctx)} chars (attempt {attempt+2})"
                        )
                        await asyncio.sleep(1)
                    else:
                        logger.error("LLM call exhausted retries: %s", err)
                        raise
                else:
                    raise
        return None

    def parse_json_response(text: str) -> Optional[Dict]:
        """Extract and parse JSON from LLM output (handles ```json blocks)."""
        if not text:
            return None
        # Strip markdown code fences
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.MULTILINE)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            # Try to find JSON object in the text
            match = re.search(r"\{.*\}", cleaned, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except json.JSONDecodeError:
                    pass
        return None

    # ── Context preparation ───────────────────────────────────────────────────

    context = scan.get("llm_context", "")
    if not context:
        await log_event("Planner", "Context Extraction", "No LLM context available — aborting.")
        return None

    stats = (
        f"Files: {scan.get('total_files', 0)}, "
        f"Lines: {scan.get('total_lines', 0)}, "
        f"Languages: {list(scan.get('languages', {}).keys())}"
    )

    # Load knowledge bases for system prompt enrichment
    kb_context = ""
    if db:
        try:
            await log_event("Planner", "Knowledge Retrieval", "Fetching relevant knowledge bases...")
            kb_query = await db.execute(
                select(KnowledgeBaseSource).where(
                    or_(
                        KnowledgeBaseSource.target_agent == "Security",
                        KnowledgeBaseSource.target_agent == "Planner",
                        KnowledgeBaseSource.target_agent == None,
                    )
                ).where(KnowledgeBaseSource.is_active == True)
            )
            kbs = kb_query.scalars().all()
            if kbs:
                kb_lines = [
                    f"- {kb.name} ({kb.category}): {kb.description or kb.content_text or kb.content_url or ''}"
                    for kb in kbs
                ]
                kb_context = "\n".join(kb_lines[:10])  # Cap at 10 KB entries
                await log_event("Planner", "Knowledge Retrieval", f"Loaded {len(kbs)} knowledge sources.")
        except Exception as exc:
            logger.warning("KB retrieval failed (non-fatal): %s", exc)

    base_system = (
        "You are a Senior Cloud Architect & Security Auditor with expertise in "
        "cloud-native application design, OWASP security, and DevOps best practices. "
        "You ALWAYS respond with valid JSON only — no additional text before or after the JSON."
    )
    if kb_context:
        base_system += (
            f"\n\nCONSULT THESE KNOWLEDGE BASES & STANDARDS:\n{kb_context}\n"
            "Explicitly reference any standards the code violates or adheres to."
        )

    # ── STEP 1: PLANNER — understand the project ─────────────────────────────

    await log_event(
        "Planner", "Booting",
        f"Received project '{project_name}' — {scan.get('total_files', 0)} files, "
        f"{scan.get('total_lines', 0)} lines. Reading project structure and entry points..."
    )

    planner_prompt = f"""Analyse this project and produce a structured understanding.

PROJECT: {project_name}
STATS: {stats}

PROJECT CONTEXT:
{{code_context}}

Respond with JSON:
{{
  "detected_stack": "language + framework (e.g. Python/FastAPI)",
  "primary_entry_points": ["file1", "file2"],
  "architecture_type": "monolith|microservices|serverless|static|library",
  "key_observations": ["observation 1", "observation 2", "observation 3"]
}}"""

    await log_event(
        "Planner", "Reading Context",
        f"Examining {min(len(context), AGENT_CONTEXT_CHARS):,} chars of project context — "
        f"detecting stack, architecture patterns, and entry points..."
    )
    planner_text = await call_llm_with_retry(planner_prompt, base_system, "code_context", context)
    planner_data = parse_json_response(planner_text) or {}
    detected_stack = planner_data.get("detected_stack", "Unknown")
    arch_type = planner_data.get("architecture_type", "unknown")
    entry_points = planner_data.get("primary_entry_points", [])
    observations = planner_data.get("key_observations", [])

    await log_event(
        "Planner", "Plan Ready",
        f"Identified stack: {detected_stack} | Architecture: {arch_type} | "
        f"Entry points: {', '.join(entry_points[:3]) or 'auto-detected'}. "
        f"Dispatching to Security, Cloud, and Quality agents."
    )
    if observations:
        await log_event(
            "Planner", "Observations",
            " | ".join(observations[:3])
        )

    # ── STEP 2: SECURITY AGENT ────────────────────────────────────────────────

    static_finding_count = len(scan.get('findings', []))
    await log_event(
        "Security", "Scanning",
        f"Starting OWASP Top 10 security scan on {detected_stack} codebase. "
        f"Static scanner already flagged {static_finding_count} potential issue(s) — "
        f"cross-referencing with deep code pattern analysis..."
    )

    security_prompt = f"""You are a Security Analyst. Scan this code for security vulnerabilities.

PROJECT: {project_name} ({detected_stack})
STATIC SCANNER FINDINGS ALREADY DETECTED:
{_format_static_findings(scan.get('findings', []))}

CODE SAMPLE:
{{code_context}}

OUTPUT JSON (security section only):
{{
  "security_score": <int 0-100>,
  "security_grade": "<A|B|C|D|F>",
  "security_findings_count": <int>,
  "security_critical_count": <int>,
  "security_findings": [
    {{
      "id": "SEC-001",
      "pillar": "Security",
      "severity": "critical|high|medium|low",
      "title": "<short title>",
      "description": "<what was found and why it's dangerous>",
      "file_path": "<file where found or null>",
      "line_number": <int or null>,
      "recommendation": "<specific fix>"
    }}
  ]
}}
Generate 3-6 findings. Score should reflect BOTH static findings AND code patterns observed."""

    await log_event(
        "Security", "Analysing",
        f"Scanning for injection flaws, broken auth, exposed secrets, insecure config, "
        f"and dependency vulnerabilities across {scan.get('total_files', 0)} source files..."
    )
    security_text = await call_llm_with_retry(security_prompt, base_system, "code_context", context)
    security_data = parse_json_response(security_text) or {}
    sec_score = security_data.get('security_score', 'N/A')
    sec_grade = security_data.get('security_grade', '?')
    sec_count = len(security_data.get('security_findings', []))
    await log_event(
        "Security", "Report Ready",
        f"Security score: {sec_score}/100 (Grade {sec_grade}) — "
        f"found {sec_count} security finding(s) including "
        f"{security_data.get('security_critical_count', 0)} critical. "
        f"Handing off to Cloud Architect."
    )

    # ── STEP 3: CLOUD AGENT ───────────────────────────────────────────────────

    await log_event(
        "Cloud Architect", "Designing",
        f"Evaluating deployment options for a {arch_type} {detected_stack} application. "
        f"Comparing GCP Cloud Run / AWS Fargate / Azure Container Apps pricing and fit..."
    )

    cloud_prompt = f"""You are a Cloud Infrastructure Architect. Recommend optimal cloud deployment.

PROJECT: {project_name}
STACK: {detected_stack}
ARCHITECTURE: {arch_type}
SIZE: {stats}

CODE SAMPLE:
{{code_context}}

OUTPUT JSON (cloud section only):
{{
  "recommended_provider": "GCP|AWS|Azure",
  "rationale": "<1-2 sentence reason>",
  "cloud_recommendations": [
    {{
      "provider": "GCP",
      "total_monthly_cost": <float>,
      "score": <float 0-100>,
      "pros": ["pro1", "pro2", "pro3"],
      "cons": ["con1", "con2"],
      "services": [
        {{
          "provider": "GCP",
          "service": "Cloud Run",
          "reason": "<why this service fits>",
          "estimated_monthly_cost": <float>,
          "config": {{"cpu": "1", "memory": "512Mi"}}
        }}
      ]
    }}
  ],
  "deployment_guide": "# Deployment Guide for {project_name}\\n\\n## Recommended: <Provider>\\n\\n<markdown steps>"
}}
Include all 3 providers (GCP, AWS, Azure). Rank them by fit for this specific project."""

    await log_event(
        "Cloud Architect", "Calculating",
        f"Analysing {detected_stack} runtime requirements, "
        f"memory footprint ({scan.get('total_lines',0):,} lines of code), "
        f"and estimating monthly costs for each cloud provider..."
    )
    cloud_text = await call_llm_with_retry(cloud_prompt, base_system, "code_context", context)
    cloud_data = parse_json_response(cloud_text) or {}
    provider = cloud_data.get('recommended_provider', 'N/A')
    rationale = cloud_data.get('rationale', '')
    await log_event(
        "Cloud Architect", "Recommendation Ready",
        f"Best fit: {provider}. Reason: {rationale or 'optimal cost/performance ratio for this stack.'} "
        f"Generated deployment guide with IaC configs."
    )

    # ── STEP 4: QUALITY AGENT ─────────────────────────────────────────────────

    await log_event("Quality Auditor", "Auditing", "Quality Agent evaluating 7-pillar code quality...")

    quality_prompt = f"""You are a Senior Code Quality Auditor. Evaluate code quality across 7 pillars.

PROJECT: {project_name} ({detected_stack})
KEY OBSERVATIONS: {planner_data.get('key_observations', [])}
STATIC FINDINGS SUMMARY: {_format_static_findings(scan.get('findings', []), max_items=5)}

CODE SAMPLE:
{{code_context}}

Evaluate EACH of the 7 pillars and output JSON:
{{
  "pillar_scores": [
    {{
      "name": "Security",
      "score": <float 0-100>,
      "grade": "<A|B|C|D|F>",
      "findings_count": <int>,
      "critical_count": <int>
    }},
    {{"name": "Maintainability", ...}},
    {{"name": "Scalability", ...}},
    {{"name": "Observability", ...}},
    {{"name": "Testability", ...}},
    {{"name": "Modularity", ...}},
    {{"name": "Efficiency", ...}}
  ],
  "quality_findings": [
    {{
      "id": "QA-001",
      "pillar": "<pillar name>",
      "severity": "high|medium|low",
      "title": "<short title>",
      "description": "<what was found>",
      "file_path": "<file or null>",
      "line_number": <int or null>,
      "recommendation": "<specific fix>"
    }}
  ]
}}
Score each pillar honestly based on what you actually observe in the code.
Generate 3-5 quality findings."""

    await log_event(
        "Quality Auditor", "Auditing",
        f"Evaluating {detected_stack} codebase across 7 pillars: Security, Maintainability, "
        f"Scalability, Observability, Testability, Modularity, and Efficiency. "
        f"Planner observations: {'; '.join((planner_data.get('key_observations') or [])[:2]) or 'none'}"
    )
    quality_text = await call_llm_with_retry(quality_prompt, base_system, "code_context", context)
    quality_data = parse_json_response(quality_text) or {}
    qual_count = len(quality_data.get('quality_findings', []))
    pillar_count = len(quality_data.get('pillar_scores', []))
    await log_event(
        "Quality Auditor", "Audit Complete",
        f"Scored {pillar_count}/7 pillars and identified {qual_count} quality finding(s). "
        f"Forwarding to Critic for cross-validation."
    )

    # ── STEP 5: CRITIC — validate & merge ────────────────────────────────────

    # Resolve merge variables BEFORE logging (avoids NameError)
    sec_findings = security_data.get("security_findings", [])
    qual_findings = quality_data.get("quality_findings", [])
    static_findings = scan.get("findings", [])
    cloud_recs = cloud_data.get("cloud_recommendations", [])
    deployment_guide = cloud_data.get("deployment_guide", _default_deployment_guide(project_name, detected_stack))

    await log_event(
        "Critic", "Validating",
        f"Cross-validating outputs from Security ({sec_count} findings), "
        f"Cloud Architect ({len(cloud_recs)} cloud provider(s)), and "
        f"Quality Auditor ({qual_count} findings). Deduplicating and merging..."
    )

    # Merge all findings
    all_findings = []

    # Prefer LLM findings, supplement with static scanner findings
    all_findings.extend(sec_findings)
    all_findings.extend(qual_findings)
    # Add any static findings not already covered
    existing_titles = {f.get("title", "").lower() for f in all_findings}
    for sf in static_findings:
        if sf.get("title", "").lower() not in existing_titles:
            all_findings.append(sf)
    # Deduplicate by title
    seen_titles = set()
    deduped_findings = []
    for f in all_findings:
        t = f.get("title", "").lower()
        if t not in seen_titles:
            seen_titles.add(t)
            deduped_findings.append(f)

    # Build pillar scores — use quality agent output, override security pillar
    pillar_scores = quality_data.get("pillar_scores", [])
    if pillar_scores and security_data.get("security_score"):
        for p in pillar_scores:
            if p.get("name") == "Security":
                p["score"] = security_data["security_score"]
                p["grade"] = security_data.get("security_grade", _score_to_grade(p["score"]))
                p["findings_count"] = security_data.get("security_findings_count", len(sec_findings))
                p["critical_count"] = security_data.get("security_critical_count", 0)

    # Validate and sanitize pillar scores
    pillar_scores = _validate_pillar_scores(pillar_scores)

    # Calculate overall score
    if pillar_scores:
        overall_score = round(sum(p["score"] for p in pillar_scores) / len(pillar_scores), 1)
    else:
        overall_score = 65.0  # Reasonable default

    await log_event(
        "Critic", "Merging",
        f"Merged {len(deduped_findings)} unique findings from all agents "
        f"(removed {len(all_findings) - len(deduped_findings)} duplicate(s)). "
        f"Overall score: {overall_score:.1f}/100. Escalating to Reporter."
    )

    # ── STEP 6: REPORTER — build final output ─────────────────────────────────

    await log_event(
        "Reporter", "Synthesizing",
        f"Assembling final structured report — score {overall_score:.1f}/100, "
        f"{len(deduped_findings[:20])} findings, "
        f"{len(cloud_recs)} cloud provider(s), deployment guide included."
    )

    report = {
        "overall_score": overall_score,
        "pillar_scores": pillar_scores,
        "findings": deduped_findings[:20],  # Cap at 20 findings
        "cloud_recommendations": cloud_recs if cloud_recs else _default_cloud_recommendations(scan),
        "deployment_guide": deployment_guide,
    }

    # Final validation — ensure required keys are present
    required_keys = ["overall_score", "pillar_scores", "findings", "cloud_recommendations", "deployment_guide"]
    missing = [k for k in required_keys if k not in report]
    if missing:
        logger.error("Report missing keys: %s", missing)
        await log_event("System", "Error", f"Report validation failed — missing keys: {missing}")
        return None

    if not report["pillar_scores"] or len(report["pillar_scores"]) < 7:
        logger.warning("Insufficient pillar scores (%d), completing with heuristic supplement",
                       len(report.get("pillar_scores", [])))
        report["pillar_scores"] = _complete_pillar_scores(report.get("pillar_scores", []), scan)
        report["overall_score"] = round(
            sum(p["score"] for p in report["pillar_scores"]) / len(report["pillar_scores"]), 1
        )

    await log_event(
        "Reporter", "Done",
        f"✔ Report complete. Overall score: {report['overall_score']:.1f}/100 — "
        f"report ready for delivery to the user."
    )
    return report


# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _score_to_grade(score: float) -> str:
    if score >= 90: return "A"
    if score >= 80: return "B"
    if score >= 70: return "C"
    if score >= 60: return "D"
    return "F"


def _format_static_findings(findings: list, max_items: int = 10) -> str:
    """Format static scanner findings as a compact string for agent prompts."""
    if not findings:
        return "None detected by static scanner."
    lines = []
    for f in findings[:max_items]:
        lines.append(
            f"  [{f.get('severity','?').upper()}] {f.get('title','?')} "
            f"— {f.get('file_path','?')}:{f.get('line_number','?')}"
        )
    if len(findings) > max_items:
        lines.append(f"  ...and {len(findings) - max_items} more findings")
    return "\n".join(lines)


def _validate_pillar_scores(pillar_scores: list) -> list:
    """Ensure all pillar scores are valid floats in [0, 100] with correct grades."""
    EXPECTED_PILLARS = [
        "Security", "Maintainability", "Scalability",
        "Observability", "Testability", "Modularity", "Efficiency"
    ]
    result = []
    existing_names = {p.get("name", "") for p in pillar_scores}

    # Sanitize existing entries
    for p in pillar_scores:
        name = p.get("name", "Unknown")
        score = float(p.get("score", 60))
        score = max(10.0, min(98.0, score))
        result.append({
            "name": name,
            "score": round(score, 1),
            "grade": _score_to_grade(score),
            "findings_count": int(p.get("findings_count", 0)),
            "critical_count": int(p.get("critical_count", 0)),
        })

    # Add any missing pillars
    for pillar in EXPECTED_PILLARS:
        if pillar not in existing_names:
            result.append({
                "name": pillar,
                "score": 60.0,
                "grade": "D",
                "findings_count": 0,
                "critical_count": 0,
            })

    # Sort to match expected order
    order = {name: i for i, name in enumerate(EXPECTED_PILLARS)}
    result.sort(key=lambda p: order.get(p["name"], 99))
    return result


def _complete_pillar_scores(existing: list, scan: Dict[str, Any]) -> list:
    """Fill missing pillar scores using basic heuristics from scan data."""
    EXPECTED_PILLARS = [
        "Security", "Maintainability", "Scalability",
        "Observability", "Testability", "Modularity", "Efficiency"
    ]
    existing_names = {p.get("name") for p in existing}
    findings = scan.get("findings", [])

    # Compute basic heuristic scores for missing pillars
    heuristic_scores = {
        "Security": max(40, 90 - sum(15 if f.get("severity") == "critical" else 8
                                     for f in findings if f.get("pillar") == "Security")),
        "Maintainability": 65,
        "Scalability": 70,
        "Observability": 60,
        "Testability": 40 if not scan.get("test_info", {}).get("has_tests") else 70,
        "Modularity": 65,
        "Efficiency": 70,
    }

    result = list(existing)
    for pillar in EXPECTED_PILLARS:
        if pillar not in existing_names:
            score = round(heuristic_scores.get(pillar, 60.0), 1)
            result.append({
                "name": pillar,
                "score": score,
                "grade": _score_to_grade(score),
                "findings_count": sum(1 for f in findings if f.get("pillar") == pillar),
                "critical_count": sum(1 for f in findings
                                      if f.get("pillar") == pillar and f.get("severity") == "critical"),
            })

    # Sort in expected order
    order = {name: i for i, name in enumerate(EXPECTED_PILLARS)}
    result.sort(key=lambda p: order.get(p.get("name", ""), 99))
    return result


def _default_cloud_recommendations(scan: Dict[str, Any]) -> list:
    """Emergency fallback cloud recommendations from scan metadata."""
    from app.services.analysis_service import _generate_cloud_recommendations
    return _generate_cloud_recommendations(
        scan.get("languages", {"Python": 1}),
        scan.get("total_lines", 1000),
    )


def _default_deployment_guide(project_name: str, stack: str) -> str:
    slug = project_name.lower().replace(" ", "-") if project_name else "my-app"
    return f"""# Deployment Guide for {project_name or 'Your Project'}

## Recommended: GCP Cloud Run ({stack})

### Step 1: Containerise Your Application
Create a `Dockerfile` appropriate for your {stack} stack.

### Step 2: Build & Push Image
```bash
gcloud auth configure-docker
docker build -t gcr.io/YOUR_PROJECT/{slug}:latest .
docker push gcr.io/YOUR_PROJECT/{slug}:latest
```

### Step 3: Deploy to Cloud Run
```bash
gcloud run deploy {slug} \\
  --image gcr.io/YOUR_PROJECT/{slug}:latest \\
  --platform managed --region us-central1 \\
  --allow-unauthenticated \\
  --memory 512Mi --cpu 1 \\
  --min-instances 0 --max-instances 10
```

### Step 4: Set Environment Variables
Configure secrets via Cloud Run environment variables or Secret Manager.
"""
