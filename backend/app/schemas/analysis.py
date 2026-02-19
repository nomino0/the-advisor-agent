"""Analysis Pydantic schemas."""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, List, Any
from uuid import UUID
from datetime import datetime


class AnalysisCreateRequest(BaseModel):
    project_name: str = Field(..., min_length=1, max_length=255)
    source_type: str = Field(default="upload", pattern="^(upload|github|gitlab|google_drive)$")
    source_ref: Optional[str] = None



class LocalAnalysisRequest(BaseModel):
    """Request to initiate analysis on a local project path (P2P)."""
    local_path: str
    project_name: Optional[str] = None
    stack_hint: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class AnalysisConnectRequest(BaseModel):
    """Request to start analysis by connecting a repo (P2P — code is fetched
    ephemerally into RAM, analysed, then destroyed; never persisted)."""
    project_name: Optional[str] = Field(None, min_length=1, max_length=255)
    provider: str = Field(..., pattern="^(github|gitlab|google_drive)$")
    repo_url: Optional[str] = Field(None, max_length=1000, description="Full repo URL (github/gitlab)")
    repo_owner: Optional[str] = Field(None, max_length=255)
    repo_name: Optional[str] = Field(None, max_length=255)
    branch: str = Field(default="main", max_length=255)
    drive_folder_id: Optional[str] = Field(None, description="Google Drive folder ID")
    preferences: Optional[Dict[str, Any]] = Field(default=None, description="Analysis preferences")


class RepoPreviewRequest(BaseModel):
    """Request to fetch file tree for confirmation before analysis."""
    repo_url: str = Field(..., max_length=1000)
    branch: Optional[str] = Field("main", max_length=255)
    is_private: bool = False

class FileNode(BaseModel):
    name: str 
    path: str 
    type: str # file or folder
    size: Optional[int] = None
    children: Optional[List['FileNode']] = None

class RepoPreviewResponse(BaseModel):
    files: List[FileNode]  # Top-level files/folders
    total_files: int
    total_size_kb: int
    root_path: str


class AnalysisUploadPreferences(BaseModel):
    detail_level: str = Field(default="standard", pattern="^(standard|detailed|executive)$")
    focus_areas: Optional[List[str]] = None
    target_providers: Optional[List[str]] = None
    expected_scale: Optional[Dict[str, str]] = None


class AnalysisSummary(BaseModel):
    id: str
    project_name: Optional[str] = None
    status: str = "pending"
    source_type: Optional[str] = None
    total_files: int = 0
    total_lines: int = 0
    languages: Optional[Dict[str, int]] = None
    overall_score: Optional[float] = None
    score: Optional[float] = None
    grade: Optional[str] = None
    language: Optional[str] = None
    findings_count: int = 0
    is_unlocked: bool = False
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PillarScore(BaseModel):
    name: str
    score: float
    grade: str
    findings_count: int
    critical_count: int


class Finding(BaseModel):
    id: str
    pillar: str
    severity: str  # critical, high, medium, low, info
    title: str
    description: str
    file_path: Optional[str] = None
    line_number: Optional[int] = None
    recommendation: str


class CloudRecommendation(BaseModel):
    provider: str
    service: str
    reason: str
    estimated_monthly_cost: float
    config: Dict[str, Any]


class ProviderComparison(BaseModel):
    provider: str
    total_monthly_cost: float
    score: float
    pros: List[str]
    cons: List[str]
    services: List[CloudRecommendation]


class AnalysisReport(BaseModel):
    id: UUID
    project_name: Optional[str]
    status: str
    overall_score: Optional[float]
    overall_grade: Optional[str]

    # Pillar scores (preview always visible)
    pillar_scores: Optional[List[PillarScore]] = None

    # Detailed data (only when unlocked)
    findings: Optional[List[Finding]] = None
    cloud_recommendations: Optional[List[ProviderComparison]] = None
    deployment_guide: Optional[str] = None

    # Metadata
    total_files: int = 0
    total_lines: int = 0
    languages: Optional[Dict[str, int]] = None
    is_unlocked: bool = False

    # Top findings (free preview)
    top_findings: Optional[List[Finding]] = None
    best_provider: Optional[str] = None

    class Config:
        from_attributes = True


class AnalysisLogResponse(BaseModel):
    id: str
    agent_name: str
    action: str
    details: Optional[str]
    timestamp: str

class AnalysisListResponse(BaseModel):
    analyses: List[AnalysisSummary]
    total: int
    page: int
    per_page: int


# ---------------------------------------------------------------------------
# Access Grant schemas (temporary token system for P2P read-only access)
# ---------------------------------------------------------------------------

class GrantGenerateRequest(BaseModel):
    """Request to generate a temporary access token."""
    target_os: str = Field(default="windows", pattern="^(windows|macos|linux)$")
    ttl_minutes: int = Field(default=30, ge=5, le=120)

class GrantGenerateResponse(BaseModel):
    """Response containing the generated token and CLI command."""
    token: str
    expires_at: str
    ttl_minutes: int
    remaining_seconds: int
    command: str
    short_command: str
    os: str
    instructions: str
    status: str

class GrantActivateRequest(BaseModel):
    """Legacy JSON schema — kept for compat; real activation uses multipart."""
    token: str
    project_name: Optional[str] = None
    os_info: Optional[str] = None

class GrantActivateResponse(BaseModel):
    """Response after activating a grant."""
    status: str
    message: str
    project_name: Optional[str] = None
    project_path: Optional[str] = None
    remaining_seconds: int = 0

class GrantStatusResponse(BaseModel):
    """Response for grant status polling."""
    token: str
    status: str
    project_path: Optional[str] = None
    project_name: Optional[str] = None
    remaining_seconds: int = 0
    is_expired: bool = False
    created_at: Optional[str] = None
    activated_at: Optional[str] = None
