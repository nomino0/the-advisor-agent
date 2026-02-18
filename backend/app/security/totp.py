"""TOTP (Time-based One-Time Password) utilities for 2FA."""
import pyotp
import qrcode
import io
import base64


def generate_totp_secret() -> str:
    """Generate a new TOTP secret."""
    return pyotp.random_base32()


def get_totp_uri(secret: str, email: str) -> str:
    """Get the TOTP provisioning URI for QR code generation."""
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name="CloudWise AI")


def generate_qr_code_base64(uri: str) -> str:
    """Generate a QR code as a base64-encoded PNG."""
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def verify_totp(secret: str, token: str) -> bool:
    """Verify a TOTP token."""
    totp = pyotp.TOTP(secret)
    return totp.verify(token, valid_window=1)
