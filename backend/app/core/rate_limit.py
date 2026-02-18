import logging
import redis
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.config import settings

logger = logging.getLogger("cloudwise")

def get_limiter_storage_uri() -> str:
    """
    Determine the storage URI for the rate limiter.
    Tries to connect to Redis; falls back to memory if the connection fails.
    """
    if not settings.redis_url or not settings.redis_url.startswith("redis"):
        logger.info("No Redis URL found. Using in-memory rate limiting.")
        return "memory://"

    try:
        # Simple health check with a short timeout
        r = redis.from_url(settings.redis_url, socket_connect_timeout=1, socket_timeout=1)
        r.ping()
        logger.info(f"Rate limiter connected to Redis at {settings.redis_url}")
        return settings.redis_url
    except (redis.exceptions.ConnectionError, redis.exceptions.TimeoutError) as e:
        logger.warning(f"Redis connection failed: {e}. Falling back to in-memory rate limiting.")
        return "memory://"
    except Exception as e:
        logger.warning(f"Unexpected error checking Redis: {e}. Falling back to in-memory rate limiting.")
        return "memory://"

# Initialize limiter with dynamic storage backend
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200/minute"],
    storage_uri=get_limiter_storage_uri()
)
