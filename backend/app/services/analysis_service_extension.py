
from typing import Dict, Any, List, Optional
import logging
import json
import re

logger = logging.getLogger(__name__)

async def _generate_llm_enhanced_report(scan: Dict[str, Any], project_name: str, analysis_id: str = None, db: Any = None) -> Optional[Dict[str, Any]]:
    """Generate analysis report using LLM based on extracted context."""
    from app.services.llm_service import llm_service
    from app.models.analysis_log import AnalysisLog
    from app.models.knowledge_base import KnowledgeBaseSource
    from sqlalchemy import select, or_
    
    async def log_event(agent: str, action: str, details: str):
        if db:
            log = AnalysisLog(analysis_id=analysis_id, agent_name=agent, action=action, details=details)
            db.add(log)
            await db.commit()
    
    # Check if context exists
    context = scan.get("llm_context")
    if not context:
        await log_event("Planner", "Context Extraction", "Failed to extract context for LLM.")
        return None

    # Limit context size to prevent token overflow (approx 50k chars is safe for most large context models)
    chunk_size = 50000
    context = context[:chunk_size]

    stats = f"Files: {scan.get('total_files')}, Lines: {scan.get('total_lines')}, Languages: {scan.get('languages')}"
    
    # Fetch Knowledge Bases
    kb_context = ""
    if db:
        await log_event("Planner", "Knowledge Retrieval", "Fetching relevant knowledge bases and compliance standards...")
        kb_query = await db.execute(select(KnowledgeBaseSource).where(
            or_(
                KnowledgeBaseSource.target_agent == "Security",
                KnowledgeBaseSource.target_agent == "Planner",
                KnowledgeBaseSource.target_agent == None # General
            )
        ).where(KnowledgeBaseSource.is_active == True))
        kbs = kb_query.scalars().all()
        if kbs:
            kb_list = [f"- {kb.name} ({kb.category}): {kb.description or kb.content_text or kb.content_url}" for kb in kbs]
            kb_context = "\n".join(kb_list)
            await log_event("Planner", "Knowledge Retrieval", f"Loaded {len(kbs)} knowledge sources.")
    
    system_prompt = "You are a Senior Cloud Architect & Security Auditor. You analyze code for cloud readiness, security, and best practices."
    if kb_context:
        system_prompt += f"\n\nCONSULT THE FOLLOWING KNOWLEDGE BASES & STANDARDS:\n{kb_context}\n\nIf the user's code violates or adheres to any of these standards, EXPLICITLY mention it."
    
    # 1. Planner Step
    await log_event("Planner", "Reading Context", f"Analyzing code structure and stats: {stats}")
    
    # 2. Security Analysis (Agent-Security)
    await log_event("Security", "Scanning", "Scanning for vulnerabilities using OWASP patterns...")
    security_prompt = f"""
    Analyze the following code for security vulnerabilities (OWASP Top 10).
    CODE:
    {context[:30000]} 
    
    OUTPUT JSON FORMAT with keys: "score" (0-100), "findings" (list of objects with id, title, description, severity, file_path, line_number, recommendation).
    """
    # security_response = await llm_service.generate_completion(security_prompt, system_prompt, provider_name="Agent-Security") # Uncomment when using multi-pass
    
    # 3. Cloud Architecture (Agent-Cloud)
    await log_event("Cloud Architect", "Designing", "Designing optimal cloud infrastructure...")
    
    user_prompt = f"""
    Analyze the following project for Cloud Deployment optimization.
    Use Chain of Thought reasoning.
    
    PROJECT METADATA:
    Name: {project_name}
    Stats: {stats}
    
    CODE EXCERPTS:
    {context}
    
    YOUR TASK:
    Perform a deep audit across 7 pillars: Security, Maintainability, Scalability, Observability, Testability, Modularity, Efficiency.
    
    STEPS:
    1. Identify the technology stack and framework.
    2. Scan for security vulnerabilities (OWASP Top 10).
    3. Evaluate code quality and modularity.
    4. Determine optimal cloud infrastructure (AWS/GCP/Azure).
    5. Generate a deployment guide.

    provide scores (0-100) and specific, actionable findings based on the code provided.
    Recommend the best cloud provider (compare AWS, GCP, Azure) and a deployment strategy.
    
    OUTPUT FORMAT (JSON ONLY):
    {{
      "overall_score": <float>,
      "pillar_scores": [
        {{ "name": "Security", "score": <float>, "grade": "A/B/C/D/F", "findings_count": <int>, "critical_count": <int> }},
        ... (Repeat for: Maintainability, Scalability, Observability, Testability, Modularity, Efficiency)
      ],
      "findings": [
        {{ 
          "id": "SEC-001", 
          "pillar": "Security", 
          "severity": "critical|high|medium|low", 
          "title": "Short title", 
          "description": "Detailed description of the issue found in the code.", 
          "file_path": "path/to/file", 
          "line_number": <int>, 
          "recommendation": "Specific fix." 
        }},
        ... (Generate 5-10 key findings)
      ],
      "cloud_recommendations": [
        {{
          "provider": "AWS|GCP|Azure",
          "total_monthly_cost": <float>,
          "score": <float 0-100>,
          "pros": ["pro1", "pro2"],
          "cons": ["con1"],
          "services": [
             {{ "provider": "...", "service": "Service Name", "reason": "Why needed", "estimated_monthly_cost": <float>, "config": {{ "key": "value" }} }}
          ]
        }}
        ... (Rank top 3)
      ],
      "deployment_guide": "# Deployment Guide\n\nMARKDOWN CONTENT HERE..."
    }}
    """
    
    try:
        await log_event("Orchestrator", "Dispatching", "Sending code context to LLM for multi-agent analysis...")
        
        # specific hardcoded agent for the main task
        response_text = await llm_service.generate_completion(user_prompt, system_prompt, provider_name="Agent-Planner")
        
        if not response_text:
             await log_event("System", "Error", "LLM returned empty response.")
             return None

        await log_event("Reporter", "Synthesizing", "Processing LLM output and generating report structure...")

        # Clean markdown code blocks if present
        json_str = re.sub(r'^```json\s*|\s*```$', '', response_text.strip(), flags=re.MULTILINE)
        
        data = json.loads(json_str)
        
        # Validate critical keys
        required_keys = ["overall_score", "pillar_scores", "findings", "cloud_recommendations", "deployment_guide"]
        if not all(k in data for k in required_keys):
            logger.warning("LLM response missing keys.")
            await log_event("Validator", "Validation Failed", "LLM response missing required schema keys.")
            return None
            
        await log_event("System", "Complete", "Analysis successfully completed.")
        return data

    except Exception as e:
        logger.error(f"Error parsing LLM response: {e}")
        await log_event("System", "Error", f"Failed to parse LLM response: {str(e)}")
        return None
