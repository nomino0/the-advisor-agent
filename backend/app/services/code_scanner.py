"""Code scanner service — analyses a local directory of source code.

This replaces the mock analysis data with *real* metadata extraction:
  - Total files & lines of code
  - Language detection (by extension)
  - Basic security pattern scanning (hard-coded secrets, SQL injection, etc.)
  - Structural metrics (average file size, largest files, directory depth)

The scanner works on an ephemeral directory that was cloned/uploaded and is
deleted immediately after scanning.  No code is persisted.
"""

import os
import re
import logging
from typing import Dict, List, Any

logger = logging.getLogger("cloudwise.code_scanner")

# ── Language mapping ─────────────────────────────────────────────────────────

EXT_LANG_MAP = {
    ".py": "Python",
    ".js": "JavaScript",
    ".ts": "TypeScript",
    ".jsx": "React JSX",
    ".tsx": "React TSX",
    ".java": "Java",
    ".go": "Go",
    ".rs": "Rust",
    ".rb": "Ruby",
    ".php": "PHP",
    ".cs": "C#",
    ".cpp": "C++",
    ".c": "C",
    ".h": "C/C++ Header",
    ".hpp": "C++ Header",
    ".swift": "Swift",
    ".kt": "Kotlin",
    ".scala": "Scala",
    ".r": "R",
    ".R": "R",
    ".dart": "Dart",
    ".lua": "Lua",
    ".html": "HTML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".less": "LESS",
    ".sql": "SQL",
    ".yaml": "YAML",
    ".yml": "YAML",
    ".json": "JSON",
    ".xml": "XML",
    ".toml": "TOML",
    ".ini": "INI",
    ".cfg": "Config",
    ".md": "Markdown",
    ".rst": "reStructuredText",
    ".sh": "Shell",
    ".bash": "Shell",
    ".zsh": "Shell",
    ".ps1": "PowerShell",
    ".bat": "Batch",
    ".dockerfile": "Dockerfile",
    ".tf": "Terraform",
    ".hcl": "HCL",
    ".proto": "Protocol Buffers",
    ".graphql": "GraphQL",
    ".gql": "GraphQL",
    ".vue": "Vue",
    ".svelte": "Svelte",
}

# Directories to always skip
SKIP_DIRS = {
    "node_modules", "__pycache__", ".git", ".hg", ".svn",
    "venv", ".venv", "env", ".env", ".tox", ".mypy_cache",
    ".pytest_cache", "dist", "build", ".next", ".nuxt",
    "target", "bin", "obj", ".idea", ".vscode",
    "vendor", "Pods", ".gradle", ".dart_tool",
}

# Files to always skip
SKIP_FILES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    "Gemfile.lock", "poetry.lock", "Pipfile.lock",
    "composer.lock", "Cargo.lock",
}

# ── Security patterns ────────────────────────────────────────────────────────

SECRET_PATTERNS = [
    (re.compile(r'(?:api[_-]?key|apikey)\s*[:=]\s*["\'][A-Za-z0-9_\-]{16,}["\']', re.I), "Hard-coded API key"),
    (re.compile(r'(?:password|passwd|pwd)\s*[:=]\s*["\'][^"\']{4,}["\']', re.I), "Hard-coded password"),
    (re.compile(r'(?:secret|token)\s*[:=]\s*["\'][A-Za-z0-9_\-]{8,}["\']', re.I), "Hard-coded secret/token"),
    (re.compile(r'(?:AKIA|ASIA)[A-Z0-9]{16}', re.I), "AWS Access Key"),
    (re.compile(r'ghp_[A-Za-z0-9]{36}'), "GitHub Personal Access Token"),
    (re.compile(r'sk-[A-Za-z0-9]{20,}'), "Potential OpenAI API key"),
    (re.compile(r'-----BEGIN (?:RSA |EC )?PRIVATE KEY-----'), "Private key in source"),
]

SQL_INJECTION_PATTERNS = [
    (re.compile(r'(?:execute|cursor\.execute|query)\s*\(\s*["\'].*%s', re.I), "SQL string formatting (potential injection)"),
    (re.compile(r'(?:execute|query)\s*\(\s*f["\']', re.I), "SQL f-string (potential injection)"),
    (re.compile(r'\.raw\s*\(\s*["\'].*\+', re.I), "Raw SQL with concatenation"),
]

CODE_SMELL_PATTERNS = [
    (re.compile(r'(?:TODO|FIXME|HACK|XXX|TEMP)\b', re.I), "TODO/FIXME comment"),
    (re.compile(r'except\s*:\s*$', re.M), "Bare except clause"),
    (re.compile(r'eval\s*\(', re.I), "Use of eval()"),
    (re.compile(r'exec\s*\(', re.I), "Use of exec()"),
    (re.compile(r'import\s+\*'), "Wildcard import"),
    (re.compile(r'console\.log\s*\('), "console.log left in code"),
    (re.compile(r'debugger\b'), "debugger statement"),
    (re.compile(r'print\s*\('), "print() statement (potential debug leftover)"),
]


# ── Main scanner ─────────────────────────────────────────────────────────────

def scan_directory(directory: str) -> Dict[str, Any]:
    """Scan a source directory and return comprehensive metadata.

    Returns a dict with:
      - total_files, total_lines
      - languages: {lang: file_count}
      - language_lines: {lang: line_count}
      - findings: list of security/quality findings
      - file_details: list of {path, language, lines}
      - largest_files: top 10 largest files
      - avg_file_size: average lines per file
    """
    total_files = 0
    total_lines = 0
    languages: Dict[str, int] = {}
    language_lines: Dict[str, int] = {}
    findings: List[Dict[str, Any]] = []
    file_details: List[Dict[str, Any]] = []
    finding_id = 0

    for root, dirs, files in os.walk(directory):
        # Prune ignored directories
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]

        for fname in files:
            if fname in SKIP_FILES:
                continue

            fpath = os.path.join(root, fname)
            rel_path = os.path.relpath(fpath, directory)
            ext = os.path.splitext(fname)[1].lower()

            # Handle Dockerfile with no extension
            if fname.lower() in ("dockerfile", "dockerfile.dev", "dockerfile.prod"):
                ext = ".dockerfile"

            lang = EXT_LANG_MAP.get(ext)
            if not lang:
                continue

            total_files += 1
            languages[lang] = languages.get(lang, 0) + 1

            try:
                with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                    line_count = content.count("\n") + (1 if content and not content.endswith("\n") else 0)
                    total_lines += line_count
                    language_lines[lang] = language_lines.get(lang, 0) + line_count

                    file_details.append({
                        "path": rel_path,
                        "language": lang,
                        "lines": line_count,
                    })

                    # Security scanning — only scan code files (not JSON, YAML, MD, etc.)
                    code_langs = {
                        "Python", "JavaScript", "TypeScript", "Java", "Go",
                        "Rust", "Ruby", "PHP", "C#", "C++", "C", "React JSX",
                        "React TSX", "Swift", "Kotlin", "Scala", "Dart",
                        "Shell", "Vue", "Svelte",
                    }
                    if lang in code_langs:
                        # Check for secrets
                        for pattern, desc in SECRET_PATTERNS:
                            for match in pattern.finditer(content):
                                line_num = content[:match.start()].count("\n") + 1
                                finding_id += 1
                                findings.append({
                                    "id": f"SEC-{finding_id:03d}",
                                    "pillar": "Security",
                                    "severity": "critical",
                                    "title": desc,
                                    "description": f"Found {desc} in {rel_path} at line {line_num}.",
                                    "file_path": rel_path,
                                    "line_number": line_num,
                                    "recommendation": "Remove the secret and use environment variables or a secret manager.",
                                })

                        # Check for SQL injection
                        for pattern, desc in SQL_INJECTION_PATTERNS:
                            for match in pattern.finditer(content):
                                line_num = content[:match.start()].count("\n") + 1
                                finding_id += 1
                                findings.append({
                                    "id": f"SEC-{finding_id:03d}",
                                    "pillar": "Security",
                                    "severity": "high",
                                    "title": "Potential SQL Injection",
                                    "description": f"{desc} in {rel_path} at line {line_num}.",
                                    "file_path": rel_path,
                                    "line_number": line_num,
                                    "recommendation": "Use parameterized queries or an ORM to prevent SQL injection.",
                                })

                        # Check for code smells
                        for pattern, desc in CODE_SMELL_PATTERNS:
                            matches = list(pattern.finditer(content))
                            if matches:
                                # Group: report at most 3 per pattern per file
                                for match in matches[:3]:
                                    line_num = content[:match.start()].count("\n") + 1
                                    finding_id += 1
                                    severity = "low"
                                    if desc in ("Use of eval()", "Use of exec()"):
                                        severity = "high"
                                    elif desc == "Bare except clause":
                                        severity = "medium"
                                    findings.append({
                                        "id": f"QA-{finding_id:03d}",
                                        "pillar": "Maintainability",
                                        "severity": severity,
                                        "title": desc,
                                        "description": f"Found '{desc}' in {rel_path} at line {line_num}.",
                                        "file_path": rel_path,
                                        "line_number": line_num,
                                        "recommendation": _recommendation_for(desc),
                                    })

            except (IOError, OSError) as e:
                logger.warning("Cannot read file %s: %s", fpath, e)
                continue

    # Sort file_details by size descending
    file_details.sort(key=lambda f: f["lines"], reverse=True)
    largest_files = file_details[:10]

    avg_file_size = round(total_lines / total_files, 1) if total_files > 0 else 0

    # Deduplicate findings (same file + same title → keep one)
    seen = set()
    unique_findings = []
    for f in findings:
        key = (f["file_path"], f["title"])
        if key not in seen:
            seen.add(key)
            unique_findings.append(f)

    logger.info(
        "Scan complete: %d files, %d lines, %d languages, %d findings",
        total_files, total_lines, len(languages), len(unique_findings),
    )

    return {
        "total_files": total_files,
        "total_lines": total_lines,
        "languages": languages,
        "language_lines": language_lines,
        "findings": unique_findings,
        "file_details": file_details,
        "largest_files": largest_files,
        "avg_file_size": avg_file_size,
    }


# ── Check test coverage indicators ──────────────────────────────────────────

def detect_test_framework(directory: str) -> Dict[str, Any]:
    """Detect if the project has tests and which framework."""
    indicators = {
        "has_tests": False,
        "test_files": 0,
        "frameworks": [],
    }

    test_file_patterns = [
        re.compile(r'^test_.*\.py$'),
        re.compile(r'.*_test\.py$'),
        re.compile(r'.*\.test\.(js|ts|jsx|tsx)$'),
        re.compile(r'.*\.spec\.(js|ts|jsx|tsx)$'),
        re.compile(r'^Test.*\.java$'),
        re.compile(r'.*Test\.java$'),
        re.compile(r'.*_test\.go$'),
    ]

    framework_files = {
        "pytest.ini": "pytest",
        "setup.cfg": "pytest",
        "jest.config.js": "jest",
        "jest.config.ts": "jest",
        "vitest.config.ts": "vitest",
        "karma.conf.js": "karma",
        ".mocharc.yml": "mocha",
        "phpunit.xml": "phpunit",
    }

    for root, dirs, files in os.walk(directory):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for fname in files:
            # Check for test files
            for pat in test_file_patterns:
                if pat.match(fname):
                    indicators["test_files"] += 1
                    indicators["has_tests"] = True
                    break

            # Check for framework config
            if fname in framework_files:
                fw = framework_files[fname]
                if fw not in indicators["frameworks"]:
                    indicators["frameworks"].append(fw)
                indicators["has_tests"] = True

    return indicators


# ── Helper ──────────────────────────────────────────────────────────────────

def _recommendation_for(desc: str) -> str:
    recs = {
        "TODO/FIXME comment": "Address TODO/FIXME items before production. Track them as issues.",
        "Bare except clause": "Catch specific exceptions instead of using bare except.",
        "Use of eval()": "Avoid eval() — it executes arbitrary code. Use ast.literal_eval() or a safe parser.",
        "Use of exec()": "Avoid exec() — it executes arbitrary code. Find a safer alternative.",
        "Wildcard import": "Import specific names instead of using wildcard imports.",
        "console.log left in code": "Remove console.log statements. Use a proper logging library.",
        "debugger statement": "Remove debugger statements before production.",
        "print() statement (potential debug leftover)": "Replace print() with structured logging (e.g., logging module, structlog).",
    }
    return recs.get(desc, "Review and fix this issue.")
