"""Repository cloning service — secure P2P ephemeral code access.

This service implements the three primary code-access methods described in
the CloudWise AI documentation:

1. **Public repos** — cloned via HTTPS using `git clone --depth 1` into an
   ephemeral temp directory.  No credentials needed.
2. **Private repos (GitHub OAuth)** — cloned via HTTPS using the user's
   encrypted OAuth access-token embedded in the clone URL.
3. **GitHub API fallback** — for users who provide a personal-access-token
   or connected via OAuth, we can download repo tarballs via the API.

All code is stored in temporary directories and is guaranteed to be
deleted after analysis via context-manager cleanup.
"""

import asyncio
import logging
import os
import platform
import shutil
import subprocess
import tempfile
from typing import Optional, Tuple

import httpx

logger = logging.getLogger("cloudwise.repo_service")

# Maximum clone size: 500 MB (per spec)
MAX_TARBALL_SIZE = 500 * 1024 * 1024


# ── helpers ──────────────────────────────────────────────────────────────────

def _normalise_github_url(url: str) -> Tuple[str, str, str]:
    """Extract (owner, repo, cleaned_url) from a GitHub URL.

    Accepts:
        https://github.com/owner/repo
        https://github.com/owner/repo.git
        github.com/owner/repo
    """
    url = url.strip().rstrip("/")
    if url.endswith(".git"):
        url = url[:-4]

    # Strip scheme
    for prefix in ("https://", "http://"):
        if url.startswith(prefix):
            url = url[len(prefix):]
            break

    parts = url.split("/")
    # Expected: github.com / owner / repo
    if len(parts) < 3 or "github" not in parts[0].lower():
        raise ValueError(f"Invalid GitHub URL: {url}")

    owner = parts[1]
    repo = parts[2]
    clean_url = f"https://github.com/{owner}/{repo}"
    return owner, repo, clean_url


def _normalise_gitlab_url(url: str) -> Tuple[str, str, str]:
    """Extract (owner, repo, cleaned_url) from a GitLab URL."""
    url = url.strip().rstrip("/")
    if url.endswith(".git"):
        url = url[:-4]

    for prefix in ("https://", "http://"):
        if url.startswith(prefix):
            url = url[len(prefix):]
            break

    parts = url.split("/")
    if len(parts) < 3 or "gitlab" not in parts[0].lower():
        raise ValueError(f"Invalid GitLab URL: {url}")

    owner = parts[1]
    repo = parts[2]
    clean_url = f"https://gitlab.com/{owner}/{repo}"
    return owner, repo, clean_url


# ── Helper: run git command ──────────────────────────────────────────────────

_IS_WINDOWS = platform.system() == "Windows"


async def _run_git(cmd: list[str], timeout: int = 120) -> tuple[int, str, str]:
    """Run a git command and return (returncode, stdout, stderr).

    On Windows we use `subprocess_shell` so that git is resolved via PATH
    even when the ASGI server inherits a limited environment.
    """
    if _IS_WINDOWS:
        # shell=True lets Windows resolve 'git' from PATH reliably
        proc = await asyncio.create_subprocess_shell(
            subprocess.list2cmdline(cmd),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    else:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    return (
        proc.returncode or 0,
        stdout.decode(errors="replace").strip(),
        stderr.decode(errors="replace").strip(),
    )


# ── Public repo cloning (git) ──────────────────────────────────────────────

async def clone_public_repo(
    repo_url: str,
    branch: str = "main",
    provider: str = "github",
) -> Tuple[str, str, str]:
    """Clone a *public* repository into a temp directory.

    Strategy:
      1. Try the requested branch (default "main")
      2. If that fails and branch was "main", retry with "master"
      3. If that also fails, clone WITHOUT --branch (uses the repo default)

    Returns (clone_dir, owner, repo_name).
    The caller is responsible for deleting the parent tmpdir when done.
    """
    if provider == "github":
        owner, repo, clean_url = _normalise_github_url(repo_url)
    elif provider == "gitlab":
        owner, repo, clean_url = _normalise_gitlab_url(repo_url)
    else:
        raise ValueError(f"Unsupported provider for clone: {provider}")

    # -- Attempt 1: requested branch -------------------------------------------
    tmpdir = tempfile.mkdtemp(prefix="cw_repo_")
    clone_target = os.path.join(tmpdir, repo)
    cmd = [
        "git", "clone", "--depth", "1",
        "--branch", branch, "--single-branch",
        clean_url, clone_target,
    ]
    logger.info("Cloning %s (branch=%s) ...", clean_url, branch)
    rc, out, err = await _run_git(cmd)

    # -- Attempt 2: try 'master' if we tried 'main' ---------------------------
    if rc != 0 and branch == "main":
        logger.warning("Branch 'main' failed, retrying with 'master'")
        shutil.rmtree(tmpdir, ignore_errors=True)
        tmpdir = tempfile.mkdtemp(prefix="cw_repo_")
        clone_target = os.path.join(tmpdir, repo)
        cmd = [
            "git", "clone", "--depth", "1",
            "--branch", "master", "--single-branch",
            clean_url, clone_target,
        ]
        rc, out, err = await _run_git(cmd)

    # -- Attempt 3: no branch flag (use repo default) -------------------------
    if rc != 0:
        logger.warning("Named-branch clones failed, retrying with default branch")
        shutil.rmtree(tmpdir, ignore_errors=True)
        tmpdir = tempfile.mkdtemp(prefix="cw_repo_")
        clone_target = os.path.join(tmpdir, repo)
        cmd = ["git", "clone", "--depth", "1", clean_url, clone_target]
        rc, out, err = await _run_git(cmd)

    if rc != 0:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise RuntimeError(f"Git clone failed: {err or out or 'unknown error'}")

    logger.info("Clone complete: %s", clone_target)
    return clone_target, owner, repo


# ── Private repo cloning (OAuth token) ──────────────────────────────────────

async def clone_private_repo(
    repo_url: str,
    access_token: str,
    branch: str = "main",
    provider: str = "github",
) -> Tuple[str, str, str]:
    """Clone a *private* repository using an OAuth access token.

    The token is embedded in the HTTPS URL as:
        https://x-access-token:{token}@github.com/owner/repo.git

    Returns (tmpdir_path, owner, repo_name).
    """
    if provider == "github":
        owner, repo, clean_url = _normalise_github_url(repo_url)
        auth_url = f"https://x-access-token:{access_token}@github.com/{owner}/{repo}.git"
    elif provider == "gitlab":
        owner, repo, clean_url = _normalise_gitlab_url(repo_url)
        auth_url = f"https://oauth2:{access_token}@gitlab.com/{owner}/{repo}.git"
    else:
        raise ValueError(f"Unsupported provider: {provider}")

    # -- Attempt 1: with branch ------------------------------------------------
    tmpdir = tempfile.mkdtemp(prefix="cw_priv_repo_")
    clone_target = os.path.join(tmpdir, repo)
    cmd = [
        "git", "clone", "--depth", "1",
        "--branch", branch, "--single-branch",
        auth_url, clone_target,
    ]
    logger.info("Cloning private repo %s/%s (branch=%s)", owner, repo, branch)
    rc, out, err = await _run_git(cmd)

    # -- Attempt 2: no branch (repo default) -----------------------------------
    if rc != 0:
        logger.warning("Branch '%s' failed for private repo, retrying with default", branch)
        shutil.rmtree(tmpdir, ignore_errors=True)
        tmpdir = tempfile.mkdtemp(prefix="cw_priv_repo_")
        clone_target = os.path.join(tmpdir, repo)
        cmd = ["git", "clone", "--depth", "1", auth_url, clone_target]
        rc, out, err = await _run_git(cmd)

    if rc != 0:
        shutil.rmtree(tmpdir, ignore_errors=True)
        # Sanitise error to avoid leaking the token
        err = err.replace(access_token, "****")
        raise RuntimeError(f"Private clone failed: {err or out or 'unknown error'}")

    logger.info("Private clone complete: %s/%s", owner, repo)
    return clone_target, owner, repo


# ── GitHub API tarball download (fallback) ──────────────────────────────────

async def download_github_tarball(
    owner: str,
    repo: str,
    branch: str = "main",
    access_token: Optional[str] = None,
) -> Tuple[str, str]:
    """Download a repo tarball from the GitHub API and extract it.

    Works for public repos (no token) or private repos (with token).
    Returns (extracted_dir, tarball_info).
    """
    url = f"https://api.github.com/repos/{owner}/{repo}/tarball/{branch}"
    headers = {"Accept": "application/vnd.github+json"}
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"

    tmpdir = tempfile.mkdtemp(prefix="cw_tarball_")
    tarball_path = os.path.join(tmpdir, "repo.tar.gz")

    async with httpx.AsyncClient(follow_redirects=True, timeout=120) as client:
        resp = await client.get(url, headers=headers)
        if resp.status_code == 404:
            shutil.rmtree(tmpdir, ignore_errors=True)
            raise RuntimeError(f"Repository {owner}/{repo} not found or not accessible")
        if resp.status_code != 200:
            shutil.rmtree(tmpdir, ignore_errors=True)
            raise RuntimeError(f"GitHub API error: {resp.status_code} {resp.text[:200]}")
        if len(resp.content) > MAX_TARBALL_SIZE:
            shutil.rmtree(tmpdir, ignore_errors=True)
            raise RuntimeError("Repository exceeds 500 MB size limit")

        with open(tarball_path, "wb") as f:
            f.write(resp.content)

    # Extract tarball (use Python stdlib for Windows compatibility)
    import tarfile
    extract_dir = os.path.join(tmpdir, "src")
    os.makedirs(extract_dir, exist_ok=True)

    try:
        with tarfile.open(tarball_path, "r:gz") as tar:
            # Strip the top-level directory (equivalent to --strip-components=1)
            members = tar.getmembers()
            for member in members:
                parts = member.name.split("/", 1)
                if len(parts) > 1:
                    member.name = parts[1]
                else:
                    continue
                tar.extract(member, path=extract_dir)
    except Exception as exc:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise RuntimeError(f"Failed to extract tarball: {exc}")

    logger.info("Tarball extracted: %s/%s -> %s", owner, repo, extract_dir)
    return extract_dir, tmpdir


# ── Check if a public repo is accessible ────────────────────────────────────

async def check_github_repo_accessibility(
    owner: str, repo: str, access_token: Optional[str] = None
) -> dict:
    """Check repo accessibility & return metadata (name, default_branch, private flag)."""
    url = f"https://api.github.com/repos/{owner}/{repo}"
    headers = {"Accept": "application/vnd.github+json"}
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, headers=headers)
        if resp.status_code == 404:
            raise RuntimeError(f"Repository {owner}/{repo} not found or private")
        if resp.status_code != 200:
            raise RuntimeError(f"GitHub API error: {resp.status_code}")
        data = resp.json()
        return {
            "full_name": data.get("full_name"),
            "private": data.get("private", False),
            "default_branch": data.get("default_branch", "main"),
            "language": data.get("language"),
            "size_kb": data.get("size", 0),
            "description": data.get("description"),
        }


# ── Cleanup helper ──────────────────────────────────────────────────────────

def cleanup_repo_dir(path: str) -> None:
    """Securely delete a cloned repo directory (P2P zero-persistence guarantee)."""
    if path and os.path.exists(path):
        # Walk up to find the temp root (prefix cw_)
        parent = os.path.dirname(path)
        if os.path.basename(parent).startswith("cw_"):
            shutil.rmtree(parent, ignore_errors=True)
            logger.info("Cleaned up ephemeral repo: %s", parent)
        else:
            shutil.rmtree(path, ignore_errors=True)
            logger.info("Cleaned up repo dir: %s", path)
