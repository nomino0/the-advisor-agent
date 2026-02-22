"""Password hashing utilities."""
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    return pwd_context.verify(plain_password, hashed_password)


def validate_password_strength(password: str) -> tuple[bool, str]:
    """Validate basic password strength rules.

    Returns (is_valid, message). Rules:
    - minimum 8 characters (enforced by schema)
    - at least one lowercase, one uppercase, one digit, one special char
    """
    import re

    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    if not re.search(r"[a-z]", password):
        return False, "Password must include a lowercase letter"
    if not re.search(r"[A-Z]", password):
        return False, "Password must include an uppercase letter"
    if not re.search(r"[0-9]", password):
        return False, "Password must include a digit"
    if not re.search(r"[^A-Za-z0-9]", password):
        return False, "Password must include a special character"
    return True, ""
