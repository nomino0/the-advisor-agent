"""Analysis endpoints — connect repo (P2P), upload code, run analysis, get reports.

Per Section 17 of the documentation, CloudWise AI uses a P2P data architecture:
  - Code is NEVER persisted on the server.
  - Three primary code-access methods:
      1. GitHub / GitLab — clone into ephemeral tmpdir -> scan -> analyse -> destroy
      2. Google Drive — OAuth2 -> download into ephemeral container -> same flow
      3. Direct Upload — streamed to RAM / encrypted tmpfs -> same flow
  - Only analysis results (scores, findings, recommendations) are retained.
"""
import uuid
import zipfile
import tempfile
import os
import shutil
import logging
from io import BytesIO
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.rate_limit import limiter
from app.db.session import get_db
from app.api.dependencies import get_current_user
from app.models.user import User
from app.models.analysis import Analysis, AnalysisStatus, SourceType
from app.models.analysis_log import AnalysisLog
from app.models.user_connection import UserConnection
from app.schemas.analysis import (
    LocalAnalysisRequest,
    AnalysisConnectRequest,
    AnalysisSummary,
    AnalysisReport,
    AnalysisLogResponse,
    AnalysisListResponse,
    PillarScore,
    Finding,
    ProviderComparison,
    GrantGenerateRequest,
    GrantGenerateResponse,
    GrantActivateRequest,
    GrantActivateResponse,
    GrantStatusResponse,
    RepoPreviewRequest,
    RepoPreviewResponse,
    FileNode,
)
from app.services.analysis_service import run_analysis_pipeline
from app.services.repo_service import (
    clone_public_repo,
    clone_private_repo,
    cleanup_repo_dir,
    download_github_tarball,
    _normalise_github_url,
)
from app.services.code_scanner import scan_directory, detect_test_framework
from app.services.code_scanner_llm_extension import extract_context_for_llm
from app.services.audit_service import record_audit
from app.services.access_grant_service import grant_store, generate_cli_command

router = APIRouter()
logger = logging.getLogger("cloudwise.analysis")


def _score_to_grade(score: float) -> str:
    if score >= 90:
        return "A"
    elif score >= 80:
        return "B"
    elif score >= 70:
        return "C"
    elif score >= 60:
        return "D"
    return "F"


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"



from app.services.planner_service import PlannerService

@router.get("/{analysis_id}/logs", response_model=List[AnalysisLogResponse])
async def get_analysis_logs(
    analysis_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the execution logs (agent thoughts/actions) for an analysis."""
    # check access
    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
        
    if analysis.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    logs_result = await db.execute(
        select(AnalysisLog)
        .where(AnalysisLog.analysis_id == analysis_id)
        .order_by(AnalysisLog.timestamp.asc())
    )
    logs = logs_result.scalars().all()
    
    return [
        AnalysisLogResponse(
            id=str(log.id),
            agent_name=log.agent_name,
            action=log.action,
            details=log.details,
            timestamp=log.timestamp.isoformat()
        ) for log in logs
    ]

def _build_file_tree(root_path: str, rel_path: str = "") -> Optional[FileNode]:
    """Recursively build a file tree structure."""
    try:
        name = os.path.basename(root_path) or "root"
        is_dir = os.path.isdir(root_path)
        
        # Skip .git, .env, .pyc
        if name in [".git", "__pycache__", ".env", ".venv", "node_modules"]:
            return None
            
        node = FileNode(
            name=name,
            path=rel_path,
            type="folder" if is_dir else "file",
            size=os.path.getsize(root_path) if not is_dir else 0,
            children=[] if is_dir else None
        )

        if is_dir:
            try:
                items = sorted(os.listdir(root_path))
                for item in items:
                    full_path = os.path.join(root_path, item)
                    child_rel_path = os.path.join(rel_path, item).replace("\\", "/")
                    if rel_path == "":
                        child_rel_path = item
                        
                    child = _build_file_tree(full_path, child_rel_path)
                    if child:
                        node.children.append(child)
                        # Accumulate size for folders
                        node.size = (node.size or 0) + (child.size or 0)
            except PermissionError:
                pass
        
        # If folder is empty after filtering (e.g. only contained .git), prune it? 
        # Optional, but keep it for now.
        return node
    except Exception as e:
        logger.error(f"Error building file tree for {root_path}: {e}")
        return None


@router.post("/preview", response_model=RepoPreviewResponse)
async def preview_repo_content(
    request: RepoPreviewRequest,
    current_user: User = Depends(get_current_user),
):
    """Clone a repo temporarily and return its file structure for confirmation."""
    logger.info(f"Previewing repo: {request.repo_url} (branch={request.branch})")
    clone_dir = None
    try:
        # P2P Architecture: Ephemeral clone
        clone_dir, owner, repo = await clone_public_repo(
            repo_url=request.repo_url,
            branch=request.branch or "main",
            provider="github"
        )
        
        logger.info(f"Repo cloned to {clone_dir}, building tree...")

        # Build tree structure
        tree = _build_file_tree(clone_dir)
        
        # Get top-level files/folders from tree
        files = tree.children if tree and tree.children else []
        
        # Calculate stats
        total_files = 0
        def count_files(node):
            nonlocal total_files
            if not node: return
            if node.type == "file":
                total_files += 1
            if node.children:
                for child in node.children:
                    count_files(child)
        
        if tree:
            count_files(tree)
            
        total_size_kb = (tree.size if tree else 0) // 1024
        
        return RepoPreviewResponse(
            files=files,
            total_files=total_files,
            total_size_kb=total_size_kb,
            root_path=clone_dir
        )

    except Exception as e:
        import traceback
        logger.error(f"Failed to preview repo: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=400, detail=f"Failed to preview repository: {str(e)}")

    finally:
        # P2P Architecture: Cleanup ephemeral code immediately
        if clone_dir:
             try:
                # clone_public_repo returns the repo folder inside temp dir
                # We need to remove the temp dir which is parent of clone_dir
                parent_dir = os.path.dirname(clone_dir)
                if parent_dir and os.path.exists(parent_dir):
                    logger.info(f"Cleaning up preview repo at {parent_dir}")
                    shutil.rmtree(parent_dir, ignore_errors=True)
             except Exception as cleanup_err:
                 logger.warning(f"Failed to cleanup preview repo: {cleanup_err}")

@router.post("/local", response_model=AnalysisSummary, status_code=status.HTTP_201_CREATED)
async def analyze_local_project(
    body: LocalAnalysisRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Analyze a local project path directly (Zero-Trust P2P Mode).
    
    1. Verify path exists and is accessible.
    2. Run Planner Agent to analyze structure & stack.
    3. Run Security & Cloud Agents based on Plan.
    """
    if not os.path.exists(body.local_path):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Path not found: {body.local_path}"
        )

    # 1. Run Planner Agent
    try:
        planner = PlannerService(body.local_path)
        plan = planner.create_execution_plan()
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Planner failed: {e}")
        raise HTTPException(status_code=500, detail=f"Planner Error: {str(e)}")

    # 2. Create Analysis Record
    analysis = Analysis(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        project_name=body.project_name or os.path.basename(body.local_path),
        source_type=SourceType.UPLOAD,  # Reusing UPLOAD type for now, or add LOCAL
        repo_url=f"file://{body.local_path}",
        status=AnalysisStatus.PENDING,
        commit_hash="local-dev",
        language=plan.stack.split(" ")[0].lower(),
        framework=plan.stack,
        score=float(plan.security_score) 
    )
    
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)

    # 3. Launch Pipeline (Background)
    # Tasks dictate what files to read.
    # We pass None for scan_result because the Planner already scanned.
    # We pass the plan tasks directly.
    background_tasks.add_task(
        run_analysis_pipeline,
        analysis.id,
        None,  # scan_result
        plan.tasks  # plan_tasks
    )

    return AnalysisSummary(
        id=analysis.id,
        project_name=analysis.project_name,
        status="pending",
        source_type="local",
        score=analysis.score,
        grade=_score_to_grade(analysis.score),
        created_at=analysis.created_at,
        findings_count=0, 
        language=analysis.language
    )


# ---------- Access Grant endpoints (temporary token system) ----------

@router.post("/grant/generate", response_model=GrantGenerateResponse)
async def generate_grant_token(
    body: GrantGenerateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Generate a temporary access token and OS-specific CLI command.

    The token allows the holder to grant read-only access to a project
    directory.  It self-destructs after the TTL expires.
    """
    grant = grant_store.create(
        user_id=str(current_user.id),
        ttl_minutes=body.ttl_minutes,
    )

    # Determine backend URL from the incoming request
    scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host", request.headers.get("host", "localhost:8000"))
    backend_url = f"{scheme}://{host}"

    cli = generate_cli_command(
        token=grant.token,
        backend_url=backend_url,
        target_os=body.target_os,
    )

    return GrantGenerateResponse(
        token=grant.token,
        expires_at=grant.expires_at.isoformat(),
        ttl_minutes=grant.ttl_minutes,
        remaining_seconds=grant.remaining_seconds,
        command=cli["command"],
        short_command=cli["short_command"],
        os=cli["os"],
        instructions=cli["instructions"],
        status=grant.status,
    )


@router.post("/grant/activate", response_model=GrantActivateResponse)
async def activate_grant(
    request: Request,
    token: str = Form(...),
    project_name: str = Form(...),
    os_info: Optional[str] = Form(default=None),
    file: UploadFile = File(...),
):
    """Activate an access grant by uploading a ZIP of the project.

    Called by the CLI command the user runs on their machine.  The project
    is zipped locally, uploaded here, scanned immediately, and the scan
    result is stored on the grant.  No files are persisted — everything is
    processed in-memory / ephemeral tmpdir.

    No auth token required — the grant token is the credential.
    """
    grant = grant_store.get(token)
    if not grant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired access token.",
        )

    if grant.is_expired:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Access token has expired. Generate a new one.",
        )

    if grant.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Grant is already {grant.status}.",
        )

    client_ip = _get_client_ip(request)

    # Read uploaded ZIP into memory and scan it
    try:
        zip_bytes = await file.read()
        zip_buffer = BytesIO(zip_bytes)

        if not zipfile.is_zipfile(zip_buffer):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is not a valid ZIP archive.",
            )
        zip_buffer.seek(0)

        with tempfile.TemporaryDirectory() as tmpdir:
            with zipfile.ZipFile(zip_buffer, "r") as zf:
                zf.extractall(tmpdir)

            scan_data = scan_directory(tmpdir)
            llm_ctx = extract_context_for_llm(tmpdir, scan_data)
            test_fw = detect_test_framework(tmpdir)

            scan_result = {
                "total_files": scan_data.get("total_files", 0),
                "total_lines": scan_data.get("total_lines", 0),
                "languages": scan_data.get("languages", {}),
                "findings": scan_data.get("findings", []),
                "llm_context": llm_ctx,
                "test_framework": test_fw,
                "project_name": project_name,
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to scan uploaded project for grant {token[:8]}: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to process uploaded project: {str(e)}",
        )

    activated = grant_store.activate(
        token=token,
        project_name=project_name,
        scan_result=scan_result,
        os_info=os_info,
        client_ip=client_ip,
    )

    if not activated:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to activate grant.",
        )

    return GrantActivateResponse(
        status="active",
        message=f"Access granted. CloudWise has scanned '{activated.project_name}' in read-only mode.",
        project_name=activated.project_name,
        project_path=activated.project_name,
        remaining_seconds=activated.remaining_seconds,
    )


@router.get("/grant/status/{token}", response_model=GrantStatusResponse)
async def check_grant_status(
    token: str,
    current_user: User = Depends(get_current_user),
):
    """Poll for grant activation status.  Frontend calls this after showing
    the CLI command to the user.
    """
    grant = grant_store.get(token)
    if not grant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grant not found.",
        )

    # Only the owning user can check status
    if grant.user_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized.",
        )

    return GrantStatusResponse(
        token=grant.token,
        status=grant.status,
        project_path=grant.project_path,
        project_name=grant.project_name,
        remaining_seconds=grant.remaining_seconds,
        is_expired=grant.is_expired,
        created_at=grant.created_at.isoformat() if grant.created_at else None,
        activated_at=grant.activated_at.isoformat() if grant.activated_at else None,
    )


@router.post("/grant/scan/{token}", response_model=AnalysisSummary, status_code=status.HTTP_201_CREATED)
async def scan_granted_project(
    token: str,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start analysis on a project that has been granted via the token system.

    The project was already scanned during activation (ZIP upload).  This
    endpoint simply creates the Analysis record and launches the pipeline
    using the pre-stored scan_result — no local filesystem access needed.
    """
    grant = grant_store.get(token)
    if not grant:
        raise HTTPException(status_code=404, detail="Grant not found.")

    if grant.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized.")

    if grant.status != "active":
        raise HTTPException(
            status_code=400,
            detail=f"Grant is not active (current status: {grant.status}).",
        )

    if grant.is_expired:
        raise HTTPException(status_code=410, detail="Grant has expired.")

    scan_result = grant.scan_result
    if not scan_result:
        raise HTTPException(
            status_code=400,
            detail="No scan data found for this grant. Please re-run the CLI command.",
        )

    project_name = grant.project_name or scan_result.get("project_name", "unknown-project")
    languages: dict = scan_result.get("languages", {})
    primary_language = max(languages, key=languages.get) if languages else "unknown"

    # Create Analysis record
    analysis = Analysis(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        project_name=project_name,
        source_type=SourceType.UPLOAD,
        repo_url=f"grant://{token[:8]}",
        status=AnalysisStatus.PENDING,
        commit_hash="granted-access",
        language=primary_language.lower(),
        framework=primary_language,
        score=0.0,
    )

    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)

    # Consume grant (single-use)
    grant_store.consume(token)

    # Launch analysis pipeline with stored scan data
    background_tasks.add_task(
        run_analysis_pipeline,
        analysis.id,
        scan_result,
    )

    return AnalysisSummary(
        id=analysis.id,
        project_name=analysis.project_name,
        status="pending",
        source_type="local",
        score=analysis.score,
        grade=_score_to_grade(analysis.score),
        created_at=analysis.created_at,
        findings_count=len(scan_result.get("findings", [])),
        language=analysis.language,
    )


@router.delete("/grant/revoke/{token}")
async def revoke_grant(
    token: str,
    current_user: User = Depends(get_current_user),
):
    """Revoke an access grant immediately."""
    grant = grant_store.get(token)
    if not grant:
        raise HTTPException(status_code=404, detail="Grant not found.")
    if grant.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized.")

    grant_store.revoke(token)
    return {"status": "revoked", "message": "Access grant has been revoked."}

@router.post("/connect", response_model=AnalysisSummary, status_code=status.HTTP_201_CREATED)
async def connect_and_analyze(
    body: AnalysisConnectRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Connect a GitHub / GitLab repo and start P2P analysis.

    Flow:
      1. Validate repo URL & accessibility
      2. Check for saved OAuth token (private repos)
      3. Clone repo into ephemeral tmp directory
      4. Scan code: count files, lines, languages, detect security issues
      5. Clean up cloned code (zero persistence)
      6. Create analysis record with real metadata
      7. Launch background analysis pipeline with scan results
    """
    if body.provider not in ("github", "gitlab"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provider must be 'github' or 'gitlab'. Use /upload for direct uploads.",
        )

    # ── Resolve repo URL ─────────────────────────────────────────────────
    repo_url = body.repo_url
    if not repo_url and body.repo_owner and body.repo_name:
        if body.provider == "github":
            repo_url = f"https://github.com/{body.repo_owner}/{body.repo_name}"
        else:
            repo_url = f"https://gitlab.com/{body.repo_owner}/{body.repo_name}"

    if not repo_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide either repo_url or both repo_owner + repo_name",
        )

    branch = body.branch or "main"

    # Auto-derive project name from URL if not provided
    project_name = body.project_name
    if not project_name and repo_url:
        # Extract "owner/repo" from URL as project name
        parts = repo_url.rstrip("/").split("/")
        if len(parts) >= 2:
            project_name = parts[-1]  # e.g. "my-repo"
    if not project_name:
        project_name = f"{body.provider}-project"

    # ── Check for OAuth / PAT token (for private repos) ──────────────────
    access_token = None
    result = await db.execute(
        select(UserConnection).where(
            UserConnection.user_id == current_user.id,
            UserConnection.provider == body.provider,
        )
    )
    connection = result.scalar_one_or_none()
    _PLACEHOLDER_TOKENS = {"mock_token", "mock", "", None}
    if connection and connection.access_token_enc not in _PLACEHOLDER_TOKENS:
        access_token = connection.access_token_enc  # decrypt in production

    # ── Fetch the repository (P2P ephemeral method) ──────────────────────
    code_path = None
    parent_tmpdir = None        # tmpdir for extraction
    owner = body.repo_owner or ""
    repo_name_resolved = body.repo_name or ""
    scan_result = None

    try:
        if body.provider == "github":
            # --- STRICT GITHUB API ---
            # No git clone fallback for GitHub repos.
            parsed_owner, parsed_repo, _ = _normalise_github_url(repo_url)
            owner = owner or parsed_owner
            repo_name_resolved = repo_name_resolved or parsed_repo
            
            logger.info(
                "Fetching %s/%s via GitHub API tarball (branch=%s)",
                parsed_owner, parsed_repo, branch,
            )
            code_path, parent_tmpdir = await download_github_tarball(
                owner=parsed_owner,
                repo=parsed_repo,
                branch=branch,
                access_token=access_token,
            )
            logger.info("GitHub API tarball extracted to %s", code_path)

        else:
            # --- OTHER PROVIDERS (GitLab, etc.) ---
            # Use git clone for non-GitHub providers
            if access_token:
                logger.info("Cloning private repo %s with token", repo_url)
                code_path, owner, repo_name_resolved = await clone_private_repo(
                    repo_url=repo_url,
                    access_token=access_token,
                    branch=branch,
                    provider=body.provider,
                )
            else:
                logger.info("Cloning public repo %s", repo_url)
                code_path, owner, repo_name_resolved = await clone_public_repo(
                    repo_url=repo_url,
                    branch=branch,
                    provider=body.provider,
                )

        # ── Scan the fetched code ────────────────────────────────────────
        logger.info("Scanning code at %s", code_path)
        scan_result = scan_directory(code_path)
        
        # Extract context for LLM (before cleanup)
        scan_result["llm_context"] = extract_context_for_llm(code_path)

        test_info = detect_test_framework(code_path)
        scan_result["test_info"] = test_info

        logger.info(
            "Scan complete: %d files, %d lines, %d findings",
            scan_result["total_files"],
            scan_result["total_lines"],
            len(scan_result.get("findings", [])),
        )

    except RuntimeError as e:
        error_msg = str(e)
        if "not found" in error_msg.lower() or "not accessible" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Repository not found or not accessible. {error_msg}. "
                       "If this is a private repo, connect your GitHub account first (Settings → Connections).",
            ) from e
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch repository: {error_msg}",
        ) from e
    finally:
        # ── ALWAYS clean up fetched code (zero-persistence guarantee) ────
        import shutil
        if parent_tmpdir and os.path.exists(parent_tmpdir):
            shutil.rmtree(parent_tmpdir, ignore_errors=True)
            logger.info("Ephemeral tarball dir cleaned up")
        elif code_path:
            cleanup_repo_dir(code_path)
        logger.info("Ephemeral code cleaned up — zero persistence")

    # ── Create analysis record with real metadata ────────────────────────
    source_ref = repo_url or f"{owner}/{repo_name_resolved}@{branch}"
    source_type_map = {
        "github": SourceType.GITHUB,
        "gitlab": SourceType.GITLAB,
        "google_drive": SourceType.GOOGLE_DRIVE,
    }

    analysis = Analysis(
        user_id=current_user.id,
        project_name=project_name,
        status=AnalysisStatus.PENDING,
        source_type=source_type_map[body.provider],
        source_ref=source_ref,
        total_files=scan_result["total_files"] if scan_result else 0,
        total_lines=scan_result["total_lines"] if scan_result else 0,
        languages=scan_result["languages"] if scan_result else {},
    )
    db.add(analysis)
    await db.flush()
    await db.refresh(analysis)

    await record_audit(
        db, action="analysis.connect", user_id=current_user.id,
        resource=f"analysis:{analysis.id}",
        details=f"Connected {body.provider} repo: {source_ref} "
                f"({scan_result['total_files'] if scan_result else 0} files, "
                f"{scan_result['total_lines'] if scan_result else 0} lines)",
        ip_address=_get_client_ip(request),
    )

    # ── Launch analysis pipeline with real scan data ─────────────────────
    background_tasks.add_task(run_analysis_pipeline, str(analysis.id), scan_result)
    return _to_summary(analysis)


# ---------- POST /analysis/upload — Direct upload (streamed to ephemeral tmpfs) ----------

@router.post("/upload", response_model=AnalysisSummary, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def upload_and_analyze(
    request: Request,
    background_tasks: BackgroundTasks,
    project_name: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a ZIP file and start analysis.

    The file is streamed directly to an ephemeral temporary directory (never
    touches persistent storage) and destroyed after scanning.
    """
    if not file.filename.endswith((".zip", ".tar.gz", ".tgz")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .zip, .tar.gz, .tgz files are accepted",
        )

    content = await file.read()
    if len(content) > 500 * 1024 * 1024:  # 500 MB per spec
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large. Maximum 500 MB.",
        )

    scan_result = None
    try:
        with tempfile.TemporaryDirectory(prefix="cw_upload_") as tmpdir:
            zip_path = os.path.join(tmpdir, "upload.zip")
            with open(zip_path, "wb") as f:
                f.write(content)

            extract_dir = os.path.join(tmpdir, "src")
            os.makedirs(extract_dir, exist_ok=True)

            if file.filename.endswith(".zip"):
                with zipfile.ZipFile(zip_path, "r") as zf:
                    zf.extractall(extract_dir)

            # Use the real code scanner
            scan_result = scan_directory(extract_dir)
            test_info = detect_test_framework(extract_dir)
            scan_result["test_info"] = test_info

            logger.info(
                "Upload scan complete: %d files, %d lines, %d findings",
                scan_result["total_files"],
                scan_result["total_lines"],
                len(scan_result.get("findings", [])),
            )
            # tmpdir auto-deleted here — zero persistence guarantee
    except zipfile.BadZipFile as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ZIP file") from exc

    analysis = Analysis(
        user_id=current_user.id,
        project_name=project_name,
        status=AnalysisStatus.PENDING,
        source_type=SourceType.UPLOAD,
        total_files=scan_result["total_files"] if scan_result else 0,
        total_lines=scan_result["total_lines"] if scan_result else 0,
        languages=scan_result["languages"] if scan_result else {},
    )
    db.add(analysis)
    await db.flush()
    await db.refresh(analysis)

    await record_audit(
        db, action="analysis.upload", user_id=current_user.id,
        resource=f"analysis:{analysis.id}",
        details=f"Uploaded project '{project_name}' "
                f"({scan_result['total_files'] if scan_result else 0} files, "
                f"{scan_result['total_lines'] if scan_result else 0} lines)",
        ip_address=_get_client_ip(request),
    )

    background_tasks.add_task(run_analysis_pipeline, str(analysis.id), scan_result)
    return _to_summary(analysis)


# ---------- GET /analysis/history ----------

@router.get("/history", response_model=AnalysisListResponse)
async def list_analyses(
    page: int = 1,
    per_page: int = 10,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List the current user's analyses."""
    offset = (page - 1) * per_page
    count_q = select(func.count(Analysis.id)).where(Analysis.user_id == current_user.id)
    total = (await db.execute(count_q)).scalar() or 0

    q = (
        select(Analysis)
        .where(Analysis.user_id == current_user.id)
        .order_by(Analysis.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    result = await db.execute(q)
    analyses = result.scalars().all()

    return AnalysisListResponse(
        analyses=[_to_summary(a) for a in analyses],
        total=total,
        page=page,
        per_page=per_page,
    )


# ---------- GET /analysis/{id} ----------

@router.get("/{analysis_id}", response_model=AnalysisReport)
async def get_analysis(
    analysis_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get analysis report (free preview or full if unlocked)."""
    analysis = await _get_user_analysis(analysis_id, current_user, db)
    return _to_report(analysis)


# ---------- GET /analysis/{id}/report ----------

@router.get("/{analysis_id}/report", response_model=AnalysisReport)
async def get_full_report(
    analysis_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the full analysis report."""
    analysis = await _get_user_analysis(analysis_id, current_user, db)
    return _to_report(analysis)


# ---------- GET /analysis/{id}/pdf ----------

@router.get("/{analysis_id}/pdf")
async def download_pdf_report(
    analysis_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Download the analysis report as PDF."""
    analysis = await _get_user_analysis(analysis_id, current_user, db)

    if analysis.status != AnalysisStatus.COMPLETED and analysis.status != "completed":
        raise HTTPException(status_code=400, detail="Analysis not yet completed")

    pdf_bytes = _generate_simple_pdf(analysis)

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="cloudwise-report-{analysis_id}.pdf"'
        },
    )


# ---------- POST /analysis/{id}/rerun ----------

@router.post("/{analysis_id}/rerun", response_model=AnalysisSummary)
async def rerun_analysis(
    analysis_id: uuid.UUID,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Re-run an existing analysis."""
    analysis = await _get_user_analysis(analysis_id, current_user, db)

    analysis.status = AnalysisStatus.PENDING
    analysis.overall_score = None
    analysis.security_score = None
    analysis.maintainability_score = None
    analysis.scalability_score = None
    analysis.observability_score = None
    analysis.testability_score = None
    analysis.modularity_score = None
    analysis.efficiency_score = None
    analysis.report_data = None
    analysis.completed_at = None
    await db.flush()

    await record_audit(
        db, action="analysis.rerun", user_id=current_user.id,
        resource=f"analysis:{analysis.id}",
        details=f"Re-running analysis for '{analysis.project_name}'",
        ip_address=_get_client_ip(request),
    )

    background_tasks.add_task(run_analysis_pipeline, str(analysis.id))
    return _to_summary(analysis)


# ---------- POST /analysis/{id}/unlock ----------

@router.post("/{analysis_id}/unlock")
async def unlock_analysis(
    analysis_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unlock full analysis report (mock payment for MVP — Stripe in prod)."""
    analysis = await _get_user_analysis(analysis_id, current_user, db)
    analysis.is_unlocked = True
    await db.flush()

    await record_audit(
        db, action="analysis.unlock", user_id=current_user.id,
        resource=f"analysis:{analysis.id}",
        details=f"Unlocked report for '{analysis.project_name}'",
        ip_address=_get_client_ip(request),
    )

    return {"message": "Report unlocked successfully", "analysis_id": str(analysis_id)}


# --------------- Helpers ---------------

async def _get_user_analysis(
    analysis_id: uuid.UUID, current_user: User, db: AsyncSession
) -> Analysis:
    result = await db.execute(
        select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.user_id == current_user.id,
        )
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis not found")
    return analysis


def _to_summary(a: Analysis) -> AnalysisSummary:
    return AnalysisSummary(
        id=str(a.id),
        project_name=a.project_name,
        status=a.status.value if isinstance(a.status, AnalysisStatus) else str(a.status),
        source_type=a.source_type.value if isinstance(a.source_type, SourceType) else str(a.source_type),
        total_files=a.total_files,
        total_lines=a.total_lines,
        languages=a.languages or {},
        overall_score=a.overall_score,
        is_unlocked=a.is_unlocked,
        created_at=a.created_at,
        completed_at=a.completed_at,
    )


def _to_report(analysis: Analysis) -> AnalysisReport:
    report_data = analysis.report_data or {}

    pillar_scores = None
    if report_data.get("pillar_scores"):
        pillar_scores = [PillarScore(**p) for p in report_data["pillar_scores"]]

    top_findings = None
    best_provider = None
    if report_data.get("findings"):
        top_findings = [Finding(**f) for f in report_data["findings"][:3]]
    if report_data.get("cloud_recommendations"):
        recs = report_data["cloud_recommendations"]
        if recs:
            best_provider = recs[0].get("provider", "N/A")

    findings = None
    cloud_recommendations = None
    deployment_guide = None
    if analysis.is_unlocked:
        if report_data.get("findings"):
            findings = [Finding(**f) for f in report_data["findings"]]
        if report_data.get("cloud_recommendations"):
            cloud_recommendations = [
                ProviderComparison(**cr) for cr in report_data["cloud_recommendations"]
            ]
        deployment_guide = report_data.get("deployment_guide")

    return AnalysisReport(
        id=analysis.id,
        project_name=analysis.project_name,
        status=analysis.status.value if isinstance(analysis.status, AnalysisStatus) else analysis.status,
        overall_score=analysis.overall_score,
        overall_grade=_score_to_grade(analysis.overall_score) if analysis.overall_score else None,
        pillar_scores=pillar_scores,
        findings=findings,
        cloud_recommendations=cloud_recommendations,
        deployment_guide=deployment_guide,
        total_files=analysis.total_files,
        total_lines=analysis.total_lines,
        languages=analysis.languages,
        is_unlocked=analysis.is_unlocked,
        top_findings=top_findings,
        best_provider=best_provider,
    )


def _generate_simple_pdf(analysis: Analysis) -> bytes:
    """Generate a minimal PDF report (MVP — no external dependencies)."""
    lines = []
    lines.append(f"CloudWise AI - Analysis Report")
    lines.append(f"Project: {analysis.project_name or 'Unnamed'}")
    score_val = analysis.overall_score
    grade = _score_to_grade(score_val) if score_val else "N/A"
    lines.append(f"Score: {score_val}/100 ({grade})")
    lines.append(f"Files: {analysis.total_files}  Lines: {analysis.total_lines}")
    src = analysis.source_type.value if hasattr(analysis.source_type, "value") else analysis.source_type
    lines.append(f"Source: {src}")
    lines.append(f"Date: {analysis.completed_at or analysis.created_at}")
    lines.append("")
    for attr, name in [
        ("security_score", "Security"),
        ("maintainability_score", "Maintainability"),
        ("scalability_score", "Scalability"),
        ("observability_score", "Observability"),
        ("testability_score", "Testability"),
        ("modularity_score", "Modularity"),
        ("efficiency_score", "Efficiency"),
    ]:
        val = getattr(analysis, attr, None)
        lines.append(f"  {name}: {val}/100" if val else f"  {name}: N/A")

    text_body = "\\n".join(lines)

    # Build a minimal valid PDF
    content_stream = f"BT /F1 11 Tf 50 750 Td 14 TL ({_pdf_esc(text_body)}) Tj ET"
    sb = content_stream.encode("latin-1", errors="replace")

    pdf = bytearray(b"%PDF-1.4\\n")
    offsets = []

    offsets.append(len(pdf))
    pdf.extend(b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\\n")
    offsets.append(len(pdf))
    pdf.extend(b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\\n")
    offsets.append(len(pdf))
    pdf.extend(b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\\n")
    offsets.append(len(pdf))
    pdf.extend(f"4 0 obj<</Length {len(sb)}>>stream\\n".encode())
    pdf.extend(sb)
    pdf.extend(b"\\nendstream endobj\\n")
    offsets.append(len(pdf))
    pdf.extend(b"5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\\n")

    xref_off = len(pdf)
    pdf.extend(b"xref\\n")
    pdf.extend(f"0 {len(offsets)+1}\\n".encode())
    pdf.extend(b"0000000000 65535 f \\n")
    for o in offsets:
        pdf.extend(f"{o:010d} 00000 n \\n".encode())
    pdf.extend(f"trailer<</Size {len(offsets)+1}/Root 1 0 R>>\\nstartxref\\n{xref_off}\\n%%EOF\\n".encode())

    return bytes(pdf)


def _pdf_esc(t: str) -> str:
    return t.replace("\\\\", "\\\\\\\\").replace("(", "\\\\(").replace(")", "\\\\)")
