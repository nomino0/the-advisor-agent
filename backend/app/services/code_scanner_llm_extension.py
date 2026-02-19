"""Smart LLM context extractor — VS Code Agent-style selective file reading.

Instead of dumping ALL file contents into a single blob (which overflows the
token budget), this module:

1. Builds a high-signal project summary (file tree + stats + key config files).
2. Selectively reads the MOST IMPORTANT source files ranked by:
   - Priority names (README, package.json, requirements.txt, Dockerfile, etc.)
   - Root-level source files (entry points, main modules)
   - Files flagged by the static scanner as having findings
3. Enforces a per-file character cap and a global budget cap.

The result is a context that fits comfortably within the LLM token limit while
maximising the signal-to-noise ratio — mirroring how VS Code Copilot agent
reads code: selectively, not exhaustively.
"""
import os
from typing import Dict, Any, List

from app.services.code_scanner import SKIP_DIRS, EXT_LANG_MAP

# ── Tuning knobs ─────────────────────────────────────────────────────────────

# Maximum characters for the entire LLM context (~7 000 tokens at 4 chars/token)
# Groq kimi-k2 limit: 10 000 TPM.  We reserve ~3 000 for the prompt template
# and output, so we budget 7 000 tokens ≈ 28 000 chars for code context.
MAX_CONTEXT_CHARS = 20_000       # Conservative: ~5 000 tokens
MAX_CHARS_PER_FILE = 3_000       # Hard cap per individual file (~750 tokens)
MAX_PRIORITY_FILES = 6           # How many "priority" files to always include
MAX_FINDING_FILES = 4            # How many files with findings to include
MAX_SOURCE_FILES = 4             # How many ordinary source files to include

# Files that are always the highest priority for the LLM to understand context
PRIORITY_NAMES = {
    "README.md", "README.txt", "readme.md",
    "package.json", "requirements.txt", "Pipfile", "pyproject.toml",
    "go.mod", "pom.xml", "build.gradle", "composer.json", "Gemfile",
    "Cargo.toml", "Dockerfile", "docker-compose.yml", "docker-compose.yaml",
    "azure.yaml", "serverless.yml", ".env.example",
    "next.config.js", "vite.config.ts", "tsconfig.json",
    "main.py", "app.py", "server.py", "index.ts", "index.js",
    "App.js", "App.tsx", "manage.py",
}

# ── Public API ────────────────────────────────────────────────────────────────

def extract_context_for_llm(directory: str, scan_result: Dict[str, Any] = None) -> str:
    """Build a compact, high-signal context string for the LLM.

    Args:
        directory: Root directory of the extracted/cloned repo.
        scan_result: Output of scan_directory() — used to identify files with
                     findings so they get priority inclusion.

    Returns:
        A UTF-8 string containing: project summary + selected file contents.
        Always stays within MAX_CONTEXT_CHARS.
    """
    findings = scan_result.get("findings", []) if scan_result else []
    file_details = scan_result.get("file_details", []) if scan_result else []
    languages = scan_result.get("languages", {}) if scan_result else {}
    total_files = scan_result.get("total_files", 0) if scan_result else 0
    total_lines = scan_result.get("total_lines", 0) if scan_result else 0

    # Build a concise project summary header  
    lang_str = ", ".join(f"{lang}({count})" for lang, count in sorted(languages.items(), key=lambda x: -x[1])[:5])
    findings_summary = _build_findings_summary(findings)
    
    summary_header = (
        f"=== PROJECT SUMMARY ===\n"
        f"Total Files: {total_files} | Total Lines: {total_lines}\n"
        f"Languages: {lang_str}\n"
        f"Static Scanner Findings: {len(findings)} total\n"
        f"{findings_summary}\n"
        f"=== FILE TREE (top-level) ===\n"
        f"{_build_compact_tree(directory)}\n"
    )

    # Collect candidates in priority order
    priority_files: List[str] = []     # Always-include files
    finding_files: List[str] = []      # Files with static scanner findings
    source_files: List[str] = []       # Other source files

    # Map file paths from findings → set of paths
    finding_paths = {f.get("file_path", "") for f in findings if f.get("file_path")}

    # Walk directory and categorise
    for root, dirs, files in os.walk(directory):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]

        for fname in sorted(files):
            fpath = os.path.join(root, fname)
            rel_path = os.path.relpath(fpath, directory).replace("\\", "/")
            ext = os.path.splitext(fname)[1].lower()

            is_priority = fname in PRIORITY_NAMES
            is_source = ext in EXT_LANG_MAP
            has_finding = rel_path in finding_paths or any(
                fp.replace("\\", "/") == rel_path for fp in finding_paths
            )

            if is_priority and len(priority_files) < MAX_PRIORITY_FILES:
                priority_files.append(fpath)
            elif has_finding and len(finding_files) < MAX_FINDING_FILES:
                finding_files.append(fpath)
            elif is_source and len(source_files) < MAX_SOURCE_FILES:
                source_files.append(fpath)

    # Also include the largest files from file_details (most logic lives there)
    if file_details and len(source_files) < MAX_SOURCE_FILES:
        for fd in file_details[:10]:  # file_details is sorted largest first
            fpath = os.path.join(directory, fd["path"])
            if (os.path.exists(fpath) and fpath not in priority_files
                    and fpath not in finding_files and fpath not in source_files
                    and len(source_files) < MAX_SOURCE_FILES):
                source_files.append(fpath)

    # Build the final context within budget
    parts = [summary_header]
    total_chars = len(summary_header)
    budget = MAX_CONTEXT_CHARS - total_chars

    def _add_files(file_list: List[str], section_label: str) -> None:
        nonlocal total_chars, budget
        if not file_list:
            return
        section_header = f"\n=== {section_label} ===\n"
        parts.append(section_header)
        total_chars += len(section_header)
        budget -= len(section_header)

        for fpath in file_list:
            if budget <= 0:
                break
            rel = os.path.relpath(fpath, directory).replace("\\", "/")
            content = _read_file_capped(fpath, min(MAX_CHARS_PER_FILE, budget - 100))
            if not content:
                continue
            chunk = f"\n--- FILE: {rel} ---\n{content}\n"
            clen = len(chunk)
            if total_chars + clen > MAX_CONTEXT_CHARS:
                # Include a truncated version
                remaining = MAX_CONTEXT_CHARS - total_chars - len(f"\n--- FILE: {rel} ---\n[truncated]\n")
                if remaining > 200:
                    chunk = f"\n--- FILE: {rel} ---\n{content[:remaining]}...[truncated]\n"
                    parts.append(chunk)
                    total_chars += len(chunk)
                budget = 0
                break
            parts.append(chunk)
            total_chars += clen
            budget -= clen

    _add_files(priority_files, "KEY CONFIGURATION & ENTRY POINT FILES")
    _add_files(finding_files, "FILES WITH SECURITY/QUALITY FINDINGS")
    _add_files(source_files, "REPRESENTATIVE SOURCE FILES")

    return "".join(parts)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _read_file_capped(path: str, max_chars: int) -> str:
    """Read a file, capping at max_chars characters."""
    if max_chars <= 0:
        return ""
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read(max_chars)
    except (IOError, OSError):
        return ""


def _build_compact_tree(directory: str, max_depth: int = 3) -> str:
    """Build a compact ASCII file tree (depth-limited, skips noise dirs)."""
    lines = []

    def _walk(path: str, prefix: str, depth: int) -> None:
        if depth > max_depth:
            return
        try:
            entries = sorted(os.listdir(path))
        except PermissionError:
            return

        # Filter noise
        entries = [
            e for e in entries
            if e not in SKIP_DIRS and not e.startswith(".")
        ]
        for i, entry in enumerate(entries[:30]):  # cap at 30 entries per level
            full = os.path.join(path, entry)
            connector = "└── " if i == len(entries) - 1 else "├── "
            is_dir = os.path.isdir(full)
            lines.append(f"{prefix}{connector}{entry}{'/' if is_dir else ''}")
            if is_dir:
                extension = "    " if i == len(entries) - 1 else "│   "
                _walk(full, prefix + extension, depth + 1)
        if len(entries) > 30:
            lines.append(f"{prefix}... ({len(entries) - 30} more)")

    _walk(directory, "", 0)
    return "\n".join(lines) if lines else "(empty)"


def _build_findings_summary(findings: list) -> str:
    """Build a compact bullet-point summary of static scanner findings."""
    if not findings:
        return "No static findings detected."

    by_severity = {}
    for f in findings:
        sev = f.get("severity", "unknown")
        by_severity.setdefault(sev, []).append(f.get("title", "Unknown"))

    lines = []
    for sev in ("critical", "high", "medium", "low"):
        items = by_severity.get(sev, [])
        if items:
            sample = ", ".join(items[:3])
            if len(items) > 3:
                sample += f" (+{len(items)-3} more)"
            lines.append(f"  [{sev.upper()}] {len(items)}x: {sample}")
    return "\n".join(lines) if lines else "No significant findings."
