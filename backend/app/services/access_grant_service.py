"""Access Grant Service — Temporary token system for read-only project access.

Generates time-limited access tokens that allow CloudWise to read a user's
project directory.  The token self-destructs after expiry or after analysis
completes.  No files are uploaded or persisted — access is ephemeral and
read-only.
"""

import os
import secrets
import platform
import threading
import logging
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass, field
from typing import Dict, Optional, List

logger = logging.getLogger("cloudwise.access_grant")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DEFAULT_TTL_MINUTES = 30
CLEANUP_INTERVAL_SECONDS = 60
MAX_ACTIVE_GRANTS_PER_USER = 5


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class AccessGrant:
    """A temporary, single-use access grant."""
    token: str
    user_id: str
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime = field(default=None)
    ttl_minutes: int = DEFAULT_TTL_MINUTES
    status: str = "pending"          # pending | active | expired | consumed | revoked
    project_path: Optional[str] = None
    project_name: Optional[str] = None
    os_info: Optional[str] = None
    client_ip: Optional[str] = None
    activated_at: Optional[datetime] = None
    scan_result: Optional[dict] = None  # Stored after ZIP upload during activation

    def __post_init__(self):
        if self.expires_at is None:
            self.expires_at = self.created_at + timedelta(minutes=self.ttl_minutes)

    @property
    def is_expired(self) -> bool:
        return datetime.now(timezone.utc) >= self.expires_at

    @property
    def is_active(self) -> bool:
        return self.status == "active" and not self.is_expired

    @property
    def remaining_seconds(self) -> int:
        delta = self.expires_at - datetime.now(timezone.utc)
        return max(0, int(delta.total_seconds()))

    def to_dict(self) -> dict:
        return {
            "token": self.token,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat(),
            "remaining_seconds": self.remaining_seconds,
            "project_path": self.project_path,
            "project_name": self.project_name,
            "os_info": self.os_info,
            "is_expired": self.is_expired,
        }


# ---------------------------------------------------------------------------
# Grant Store (in-memory, production should use Redis)
# ---------------------------------------------------------------------------

class AccessGrantStore:
    """Thread-safe in-memory store for access grants with auto-cleanup."""

    def __init__(self):
        self._grants: Dict[str, AccessGrant] = {}
        self._lock = threading.Lock()
        self._cleanup_thread: Optional[threading.Thread] = None
        self._running = False

    def start_cleanup_loop(self):
        """Start background thread that purges expired tokens."""
        if self._running:
            return
        self._running = True
        self._cleanup_thread = threading.Thread(
            target=self._cleanup_loop, daemon=True, name="grant-cleanup"
        )
        self._cleanup_thread.start()
        logger.info("Access grant cleanup thread started")

    def _cleanup_loop(self):
        import time
        while self._running:
            time.sleep(CLEANUP_INTERVAL_SECONDS)
            self._purge_expired()

    def _purge_expired(self):
        with self._lock:
            expired_tokens = [
                t for t, g in self._grants.items()
                if g.is_expired and g.status not in ("consumed", "revoked")
            ]
            for t in expired_tokens:
                self._grants[t].status = "expired"
                logger.info(f"Grant token expired and purged: {t[:8]}...")

    def create(self, user_id: str, ttl_minutes: int = DEFAULT_TTL_MINUTES) -> AccessGrant:
        """Generate a new access grant token."""
        token = secrets.token_urlsafe(32)  # 256-bit secure token
        grant = AccessGrant(
            token=token,
            user_id=user_id,
            ttl_minutes=ttl_minutes,
        )
        with self._lock:
            # Enforce per-user limit
            user_grants = [
                g for g in self._grants.values()
                if g.user_id == user_id and g.status in ("pending", "active")
            ]
            if len(user_grants) >= MAX_ACTIVE_GRANTS_PER_USER:
                # Revoke oldest
                oldest = min(user_grants, key=lambda g: g.created_at)
                oldest.status = "revoked"

            self._grants[token] = grant
        logger.info(f"Created access grant {token[:8]}... for user {user_id} (TTL: {ttl_minutes}m)")
        return grant

    def get(self, token: str) -> Optional[AccessGrant]:
        """Retrieve a grant by token."""
        with self._lock:
            grant = self._grants.get(token)
            if grant and grant.is_expired and grant.status == "pending":
                grant.status = "expired"
            return grant

    def activate(
        self,
        token: str,
        project_name: str,
        scan_result: dict,
        os_info: Optional[str] = None,
        client_ip: Optional[str] = None,
    ) -> Optional[AccessGrant]:
        """Activate a pending grant by storing the pre-scanned result."""
        with self._lock:
            grant = self._grants.get(token)
            if not grant:
                return None
            if grant.status != "pending":
                return None
            if grant.is_expired:
                grant.status = "expired"
                return None

            grant.project_path = project_name  # store name as reference
            grant.project_name = project_name
            grant.scan_result = scan_result
            grant.os_info = os_info or platform.system()
            grant.client_ip = client_ip
            grant.status = "active"
            grant.activated_at = datetime.now(timezone.utc)

            logger.info(
                f"Grant {token[:8]}... activated: project='{project_name}' "
                f"(OS: {grant.os_info}, IP: {grant.client_ip})"
            )
            return grant

    def consume(self, token: str) -> Optional[AccessGrant]:
        """Mark grant as consumed after analysis completes."""
        with self._lock:
            grant = self._grants.get(token)
            if grant:
                grant.status = "consumed"
                logger.info(f"Grant {token[:8]}... consumed (analysis complete)")
            return grant

    def revoke(self, token: str) -> bool:
        """Revoke a grant immediately."""
        with self._lock:
            grant = self._grants.get(token)
            if grant and grant.status in ("pending", "active"):
                grant.status = "revoked"
                logger.info(f"Grant {token[:8]}... revoked")
                return True
            return False

    def list_user_grants(self, user_id: str) -> List[AccessGrant]:
        """List all grants for a user."""
        with self._lock:
            return [
                g for g in self._grants.values()
                if g.user_id == user_id
            ]


# ---------------------------------------------------------------------------
# CLI Command Generator
# ---------------------------------------------------------------------------

def generate_cli_command(
    token: str,
    backend_url: str,
    target_os: str = "windows",
) -> dict:
    """Generate OS-specific CLI command that ZIPs the project and POSTs it.

    The command prompts for the project folder, compresses it to a temporary
    ZIP, uploads it to /grant/activate as multipart form-data, then deletes
    the temp ZIP.  No path string is stored on the server — the actual files
    are transmitted and scanned immediately (zero-persistence).
    """
    endpoint = f"{backend_url}/api/v1/analysis/grant/activate"
    target_os = target_os.lower().strip()

    if target_os == "windows":
        command = (
            '$path = Read-Host "Enter your project folder path"; '
            '$zip = [System.IO.Path]::GetTempFileName() + ".zip"; '
            'Compress-Archive -Path "$path\\*" -DestinationPath $zip -Force; '
            '$name = Split-Path $path -Leaf; '
            f'curl.exe -s -X POST "{endpoint}" '
            f'-F "token={token}" '
            '-F "project_name=$name" '
            '-F "os_info=windows" '
            '-F "file=@$zip;type=application/zip"; '
            'Remove-Item $zip -Force'
        )
        short_command = command
        instructions = (
            "Open PowerShell, paste the command, and enter your project folder path when prompted. "
            "The folder will be zipped and sent securely to CloudWise."
        )

    elif target_os == "macos":
        command = (
            'read -rp "Enter your project folder path: " PROJECT_PATH && '
            'ZIP=$(mktemp /tmp/cw_XXXXXX.zip) && '
            '(cd "$PROJECT_PATH" && zip -r "$ZIP" . '
            '-x "*.git*" -x "node_modules/*" -x "__pycache__/*" -x ".venv/*" > /dev/null) && '
            'NAME=$(basename "$PROJECT_PATH") && '
            f'curl -s -X POST "{endpoint}" '
            f'-F "token={token}" '
            '-F "project_name=$NAME" '
            '-F "os_info=macos" '
            '-F "file=@$ZIP;type=application/zip" && '
            'rm -f "$ZIP"'
        )
        short_command = command
        instructions = (
            "Open Terminal, paste the command, and enter your project folder path when prompted."
        )

    else:  # linux
        command = (
            'read -rp "Enter your project folder path: " PROJECT_PATH && '
            'ZIP=$(mktemp /tmp/cw_XXXXXX.zip) && '
            '(cd "$PROJECT_PATH" && zip -r "$ZIP" . '
            '-x "*.git*" -x "node_modules/*" -x "__pycache__/*" -x ".venv/*" > /dev/null) && '
            'NAME=$(basename "$PROJECT_PATH") && '
            f'curl -s -X POST "{endpoint}" '
            f'-F "token={token}" '
            '-F "project_name=$NAME" '
            '-F "os_info=linux" '
            '-F "file=@$ZIP;type=application/zip" && '
            'rm -f "$ZIP"'
        )
        short_command = command
        instructions = (
            "Open a terminal, paste the command, and enter your project folder path when prompted."
        )

    return {
        "os": target_os,
        "command": command,
        "short_command": short_command,
        "instructions": instructions,
    }


# ---------------------------------------------------------------------------
# Singleton store instance
# ---------------------------------------------------------------------------

grant_store = AccessGrantStore()
grant_store.start_cleanup_loop()
