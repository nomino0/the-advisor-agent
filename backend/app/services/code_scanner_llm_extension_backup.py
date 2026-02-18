
def extract_context_for_llm(directory: str, max_chars: int = 50000) -> str:
    """Read key files to build LLM context."""
    context = []
    total_chars = 0
    
    PRIORITY_NAMES = {
        "README.md", "README.txt", "package.json", "requirements.txt", "Pipfile", "pyproject.toml",
        "go.mod", "pom.xml", "build.gradle", "composer.json", "Gemfile", "Cargo.toml",
        "Dockerfile", "docker-compose.yml", "azure.yaml", "serverless.yml",
        "next.config.js", "vite.config.ts", "tsconfig.json", "main.py", "index.ts", "App.js"
    }

    # Walk directory
    for root, dirs, files in os.walk(directory):
        # Prune skipped dirs in-place
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]

        for file in files:
            path = os.path.join(root, file)
            rel_path = os.path.relpath(path, directory)
            
            # Check if relevant
            is_priority = file in PRIORITY_NAMES
            ext = os.path.splitext(file)[1]
            is_source = ext in EXT_LANG_MAP

            if is_priority or (is_source and len(dirs) == 0): # Priority or root files
                try:
                    with open(path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read(8000) # Read first 8KB per file
                        chunk = f"\n\n--- FILE: {rel_path} ---\n{content}\n"
                        
                        if total_chars + len(chunk) > max_chars:
                            context.append(chunk[:max_chars - total_chars])
                            return "".join(context)
                        
                        context.append(chunk)
                        total_chars += len(chunk)
                except Exception:
                    pass
    
    return "".join(context)
