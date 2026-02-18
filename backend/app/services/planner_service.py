import os
import json
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path
from dataclasses import dataclass, field

from app.core.security.security_manager import SecurityManager, AgentIdentity

logger = logging.getLogger("cloudwise.planner")

@dataclass
class ExecutionTask:
    agent: str
    target_files: List[str]
    context: str
    priority: int

@dataclass
class AnalyzeResult:
    stack: str
    tasks: List[ExecutionTask]
    security_score: int
    risk_level: str

class PlannerService:
    """
    Planner Agent: Analyzes the folder structure, detects the stack,
    and creates an Execution Plan for subsequent agents.
    Respects local file access (P2P).
    """

    SKIP_DIRS = {
        "node_modules", "venv", ".venv", "__pycache__", ".git", ".idea", ".vscode", 
        "dist", "build", "coverage", ".next", ".nuxt"
    }

    SKIP_FILES = {
        "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock", 
        ".DS_Store", "Thumbs.db"
    }

    def __init__(self, project_path: str):
        self.project_path = Path(project_path)
        self.security_manager = SecurityManager()
        self.identity = AgentIdentity("planner-001", "supervisor")
        self.context = {}

    def analyze_structure(self) -> Dict[str, Any]:
        """Scans the directory structure to build a file map."""
        structure = {"files": [], "dirs": [], "tree": {}}
        
        for root, dirs, files in os.walk(self.project_path):
            # Modify dirs in-place to skip ignored folders
            dirs[:] = [d for d in dirs if d not in self.SKIP_DIRS]
            
            rel_root = Path(root).relative_to(self.project_path)
            
            for file in files:
                if file in self.SKIP_FILES:
                    continue
                file_path = Path(root) / file
                structure["files"].append(str(file_path))
                
        return structure

    def detect_stack(self, file_list: List[str]) -> Dict[str, str]:
        """Detects the tech stack based on key files."""
        stack = {"language": "Unknown", "framework": "Unknown", "build_tool": "Unknown"}
        
        # Check for Node
        if any(f.endswith("package.json") for f in file_list):
            stack["language"] = "TypeScript/JavaScript"
            # Read package.json for framework
            pkg_path = self.project_path / "package.json"
            if pkg_path.exists():
                try:
                    with open(pkg_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        deps = data.get("dependencies", {})
                        if "next" in deps: stack["framework"] = "Next.js"
                        elif "react" in deps: stack["framework"] = "React"
                        elif "express" in deps: stack["framework"] = "Express"
                        elif "nest" in deps: stack["framework"] = "NestJS"
                except Exception as e:
                    logger.warning(f"Failed to read package.json: {e}")

        # Check for Python
        if any(f.endswith("requirements.txt") or f.endswith("pyproject.toml") for f in file_list):
            stack["language"] = "Python"
            if any(f.endswith("manage.py") for f in file_list): stack["framework"] = "Django"
            if any("flask" in str(f) for f in file_list): stack["framework"] = "Flask" # naive check
            # Check for fastapi
            req_path = self.project_path / "requirements.txt"
            if req_path.exists():
                try:
                    content = req_path.read_text(encoding="utf-8").lower()
                    if "fastapi" in content: stack["framework"] = "FastAPI"
                    if "django" in content: stack["framework"] = "Django"
                    if "flask" in content: stack["framework"] = "Flask"
                except: pass

        return stack

    def _read_readme(self) -> str:
        """Reads the README file for context."""
        readme_path = self.project_path / "README.md"
        if readme_path.exists():
            return readme_path.read_text(encoding="utf-8")[:2000]
        return ""

    def create_execution_plan(self) -> AnalyzeResult:
        """Orchestrates the planning phase."""
        
        # 1. Security Check (Input Validation) - Layer 3 Prompt Firewall
        if not self.security_manager.validate_request(self.identity, str(self.project_path), "High"):
            raise PermissionError("Project path blocked by Security Policy Layer 3")

        # 2. Structure Analysis
        structure = self.analyze_structure()
        file_list = structure["files"]
        
        # 3. Stack Detection
        stack_info = self.detect_stack(file_list)
        
        # 4. Context Gathering
        readme_content = self._read_readme()
        
        # 5. Task Generation
        tasks = []
        
        # Security Agent Tasks
        # Look for auth files, env files, API routes
        sec_files = [f for f in file_list if "auth" in f.lower() or "security" in f.lower() or "api" in f.lower() or ".env" in f.lower()]
        if sec_files:
            tasks.append(ExecutionTask(
                agent="SecurityAgent",
                target_files=sec_files,
                context=f"Analyze authentication and API security. Stack: {stack_info}",
                priority=1
            ))
            
        # Cloud/DevOps Agent Tasks
        # Look for Docker, k8s, terraform, pipelines
        cloud_files = [f for f in file_list if "docker" in f.lower() or ".yml" in f.lower() or ".yaml" in f.lower() or "terraform" in f.lower()]
        tasks.append(ExecutionTask(
            agent="CloudAgent",
            target_files=cloud_files,
            context=f"Analyze deployment configuration. Suggest cloud providers for {stack_info['language']}.",
            priority=2
        ))

        # Best Practices Agent
        # Random sample of main source files
        source_files = [f for f in file_list if f.endswith(".py") or f.endswith(".ts") or f.endswith(".js") or f.endswith(".java") or f.endswith(".go")]
        # Limit to 10 for initial scan
        tasks.append(ExecutionTask(
            agent="BestPractices",
            target_files=source_files[:10],
            context=f"Check code quality and patterns for {stack_info['framework']}",
            priority=3
        ))

        # 6. Risk Scoring (Layer 5)
        risk_score = self.security_manager.risk_engine.calculate_risk_score(
            prompt_risk="Low", 
            tool_sensitivity="Medium",
            user_history_score=0
        )

        return AnalyzeResult(
            stack=f"{stack_info['language']} ({stack_info['framework']})",
            tasks=tasks,
            security_score=100 - risk_score,
            risk_level=self.security_manager.risk_engine.enforce_policy(risk_score)
        )
