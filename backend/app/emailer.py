"""Simple SendGrid-based email helper using the v3 Mail Send API.

This avoids adding the sendgrid package and uses `httpx` which is already
in requirements. It expects `SENDGRID_API_KEY` (mapped to
`settings.sendgrid_api_key`) and `settings.email_from` to be set.
"""
from typing import Optional
import logging
import httpx

from app.config import settings

logger = logging.getLogger(__name__)


async def send_verification_email(to_email: str, verification_url: str, subject: Optional[str] = None) -> bool:
    """Send a verification email via SendGrid.

    Returns True on success. Does not raise on failures (logs instead).
    """
    if not settings.sendgrid_api_key or not settings.email_from:
        logger.warning("SendGrid not configured; skipping sending email to %s", to_email)
        return False

    payload = {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": settings.email_from},
        "subject": subject or "Verify your email",
        "content": [
            {
                "type": "text/html",
                "value": (
                    f"<p>Please verify your email by clicking the link below:</p>"
                    f"<p><a href=\"{verification_url}\">Verify email</a></p>"
                    f"<p>If you didn't sign up, you can ignore this message.</p>"
                ),
            }
        ],
    }

    headers = {"Authorization": f"Bearer {settings.sendgrid_api_key}", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post("https://api.sendgrid.com/v3/mail/send", json=payload, headers=headers)
            r.raise_for_status()
            logger.info("Sent verification email to %s", to_email)
            return True
    except Exception:
        logger.exception("Failed to send verification email to %s", to_email)
        return False
