
from typing import Dict, Any, List, Optional
import logging
import json
import re

logger = logging.getLogger(__name__)

async def _generate_llm_enhanced_report(scan: Dict[str, Any], project_name: str) -> Optional[Dict[str, Any]]:
    """Generate analysis report using LLM based on extracted context."""
    from app.services.llm_service import llm_service
    
    # Check if context exists
    context = scan.get("llm_context")
    if not context:
        return None

    # Limit context size to prevent token overflow (approx 50k chars is safe for most large context models)
    context = context[:50000]

    stats = f"Files: {scan.get('total_files')}, Lines: {scan.get('total_lines')}, Languages: {scan.get('languages')}"
    
    system_prompt = "You are a Senior Cloud Architect & Security Auditor. You analyze code for cloud readiness, security, and best practices."
    user_prompt = f"""
    Analyze the following project for Cloud Deployment optimization.
    
    PROJECT METADATA:
    Name: {project_name}
    Stats: {stats}
    
    CODE EXCERPTS:
    {context}
    
    YOUR TASK:
    Perform a deep audit across 7 pillars: Security, Maintainability, Scalability, Observability, Testability, Modularity, Efficiency.
    Provide scores (0-100) and specific, actionable findings based on the code provided.
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
        response_text = await llm_service.generate_completion(user_prompt, system_prompt)
        
        if not response_text:
             logger.warning("LLM returned empty response")
             return None

        # Clean markdown code blocks if present
        json_str = re.sub(r'^```json\s*|\s*```$', '', response_text.strip(), flags=re.MULTILINE)
        
        data = json.loads(json_str)
        
        # Validate critical keys
        required_keys = ["overall_score", "pillar_scores", "findings", "cloud_recommendations", "deployment_guide"]
        if not all(k in data for k in required_keys):
            logger.warning("LLM response missing keys.")
            return None
            
        return data

    except Exception as e:
        logger.error(f"Error parsing LLM response: {e}")
        return None
