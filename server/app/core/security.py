import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from pathlib import Path
from typing import Optional

from Crypto.Cipher import AES
from fastapi import Header, HTTPException, Query

from app.core.config import config_manager


def _load_or_create_key(key_path: Path) -> bytes:
    key_path.parent.mkdir(parents=True, exist_ok=True)
    if key_path.exists():
        raw = key_path.read_bytes()
        if len(raw) == 32:
            return raw
    key = os.urandom(32)
    key_path.write_bytes(key)
    return key


def encrypt_secret(plaintext: str, key_path: Optional[Path] = None) -> str:
    """使用 AES-256-GCM 加密本地持久化敏感凭据。"""
    key = _load_or_create_key(key_path or config_manager.key_path)
    cipher = AES.new(key, AES.MODE_GCM)
    ciphertext, tag = cipher.encrypt_and_digest(plaintext.encode("utf-8"))
    payload = cipher.nonce + tag + ciphertext
    return base64.b64encode(payload).decode("ascii")


def decrypt_secret(encoded: str, key_path: Optional[Path] = None) -> str:
    key = _load_or_create_key(key_path or config_manager.key_path)
    raw = base64.b64decode(encoded)
    nonce, tag, ciphertext = raw[:16], raw[16:32], raw[32:]
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    return cipher.decrypt_and_verify(ciphertext, tag).decode("utf-8")


def hash_pin(pin: str) -> str:
    salt = secrets.token_hex(8)
    digest = hashlib.pbkdf2_hmac("sha256", pin.encode("utf-8"), salt.encode("utf-8"), 120_000).hex()
    return f"{salt}${digest}"


def verify_pin(pin: str, stored_hash: str) -> bool:
    if not stored_hash or "$" not in stored_hash:
        return False
    salt, expected = stored_hash.split("$", 1)
    digest = hashlib.pbkdf2_hmac("sha256", pin.encode("utf-8"), salt.encode("utf-8"), 120_000).hex()
    return hmac.compare_digest(digest, expected)


def issue_panel_token(ttl_seconds: int = 30 * 86400) -> str:
    key = _load_or_create_key(config_manager.key_path)
    payload = json.dumps({"exp": int(time.time()) + ttl_seconds}).encode("utf-8")
    b64 = base64.urlsafe_b64encode(payload).decode("ascii").rstrip("=")
    sig = hmac.new(key, b64.encode("ascii"), hashlib.sha256).hexdigest()
    return f"{b64}.{sig}"


def verify_panel_token(token: str) -> bool:
    if not token or "." not in token:
        return False
    b64, sig = token.split(".", 1)
    key = _load_or_create_key(config_manager.key_path)
    expected = hmac.new(key, b64.encode("ascii"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected):
        return False
    padded = b64 + "=" * (-len(b64) % 4)
    try:
        payload = json.loads(base64.urlsafe_b64decode(padded).decode("utf-8"))
        return int(payload.get("exp", 0)) > int(time.time())
    except Exception:
        return False


async def require_panel_access(
    x_panel_token: Optional[str] = Header(default=None, alias="X-Panel-Token"),
    authorization: Optional[str] = Header(default=None),
    token: Optional[str] = Query(default=None),
) -> None:
    """当用户在设置中启用局域网 PIN 锁时校验访问令牌；默认关闭，零门槛本地使用。"""
    settings = config_manager.get_settings()
    if not settings.pin_enabled or not settings.pin_hash:
        return

    candidate = x_panel_token or token
    if not candidate and authorization and authorization.lower().startswith("bearer "):
        candidate = authorization[7:].strip()

    if not candidate or not verify_panel_token(candidate):
        raise HTTPException(status_code=401, detail="需要局域网访问解锁（PIN Token 无效或已过期）")
