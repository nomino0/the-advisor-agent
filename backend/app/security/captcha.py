"""CAPTCHA / bot protection utilities.

Supports Google reCAPTCHA (v2/v3) and Cloudflare Turnstile.
"""
from typing import Optional
import httpx
import logging

from app.config import settings

logger = logging.getLogger(__name__)


async def verify_captcha(token: str, remote_ip: Optional[str] = None) -> bool:
    """Verify a client-supplied captcha/turnstile token.

    Returns True when verification succeeds. In `debug` mode, if no provider
    is configured this will return True to ease local development.
    """
    if not token:
        return False

    provider = (settings.captcha_provider or "").lower() if settings.captcha_provider else None
    if not provider:
        if settings.debug:
            logger.debug("Skipping captcha verification in debug mode (no provider configured)")
            return True
        logger.warning("Captcha provider not configured in production")
        return False

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            if provider == "recaptcha":
                # Google reCAPTCHA verification
                url = "https://www.google.com/recaptcha/api/siteverify"
                data = {"secret": settings.recaptcha_secret_key or "", "response": token}
                if remote_ip:
                    data["remoteip"] = remote_ip
                r = await client.post(url, data=data)
                r.raise_for_status()
                body = r.json()
                return bool(body.get("success"))

            if provider == "turnstile":
                # Cloudflare Turnstile verification
                url = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
                data = {"secret": settings.turnstile_secret_key or "", "response": token}
                if remote_ip:
                    data["remoteip"] = remote_ip
                r = await client.post(url, data=data)
                r.raise_for_status()
                body = r.json()
                return bool(body.get("success"))

            logger.warning("Unsupported captcha provider configured: %s", provider)
            return False
    except Exception:
        logger.exception("Error verifying captcha token")
        return False
