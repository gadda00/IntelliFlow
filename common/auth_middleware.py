"""
common/auth_middleware.py
IntelliFlow Authentication & Authorization
- JWT token generation and verification
- API key management
- Simple in-memory user store (swap for PostgreSQL/Supabase in production)
"""
import hashlib
import hmac
import json
import os
import secrets
import time
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger("intelliflow.auth")


class AuthMiddleware:
    """
    JWT-based authentication with API key support.
    User data stored in memory (production: swap for DB).
    """

    JWT_HEADER = '{"alg":"HS256","typ":"JWT"}'
    TOKEN_EXPIRY = 86400  # 24 hours

    def __init__(self, secret: str = ""):
        self.secret = secret or os.getenv("JWT_SECRET", "intelliflow-change-in-production")
        # In-memory stores — replace with Supabase/PostgreSQL in production
        self._users: Dict[str, Dict] = {}          # email → user record
        self._users_by_id: Dict[str, Dict] = {}    # id → user record
        self._api_keys: Dict[str, Dict] = {}       # key → {user_id, name, created}
        self._usage: Dict[str, int] = {}           # user_id → monthly usage count

        # Seed a demo account
        self._create_demo_user()

    # ─── User Management ──────────────────────────────────────────────────────

    def create_user(
        self, email: str, password: str, name: str, plan: str = "free"
    ) -> Optional[Dict]:
        if email in self._users:
            return None  # Already exists

        user_id = secrets.token_hex(12)
        user = {
            "id": user_id,
            "email": email,
            "name": name,
            "password_hash": self._hash_password(password),
            "plan": plan,
            "created_at": time.time(),
            "last_login": None
        }
        self._users[email] = user
        self._users_by_id[user_id] = user
        self._usage[user_id] = 0
        logger.info(f"New user created: {email} ({user_id})")
        return user

    def authenticate(self, email: str, password: str) -> Optional[Dict]:
        user = self._users.get(email)
        if not user:
            return None
        if not hmac.compare_digest(user["password_hash"], self._hash_password(password)):
            return None
        user["last_login"] = time.time()
        return user

    def upgrade_user_plan(self, user_id: str, plan: str) -> bool:
        user = self._users_by_id.get(user_id)
        if user:
            user["plan"] = plan
            logger.info(f"User {user_id} upgraded to plan: {plan}")
            return True
        return False

    def get_usage_count(self, user_id: str) -> int:
        return self._usage.get(user_id, 0)

    def increment_usage(self, user_id: str) -> int:
        self._usage[user_id] = self._usage.get(user_id, 0) + 1
        return self._usage[user_id]

    # ─── JWT Tokens ───────────────────────────────────────────────────────────

    def generate_token(self, user: Dict) -> str:
        payload = {
            "sub": user["id"],
            "email": user["email"],
            "name": user.get("name", ""),
            "plan": user.get("plan", "free"),
            "iat": int(time.time()),
            "exp": int(time.time()) + self.TOKEN_EXPIRY
        }
        return self._encode_jwt(payload)

    def verify_token(self, token: str) -> Optional[Dict]:
        if not token:
            return None
        try:
            payload = self._decode_jwt(token)
            if not payload:
                return None
            if payload.get("exp", 0) < time.time():
                return None  # Expired
            # Attach full user record
            user = self._users_by_id.get(payload.get("sub", ""))
            if user:
                return {k: v for k, v in user.items() if k != "password_hash"}
            # Fallback to payload data
            return payload
        except Exception:
            return None

    # ─── API Keys ─────────────────────────────────────────────────────────────

    def create_api_key(self, user_id: str, name: str = "Default Key") -> Optional[Dict]:
        user = self._users_by_id.get(user_id)
        if not user:
            return None
        key = f"if_{'live' if user.get('plan') != 'free' else 'test'}_{secrets.token_urlsafe(32)}"
        key_record = {
            "key": key,
            "key_preview": key[:20] + "...",
            "name": name,
            "user_id": user_id,
            "created_at": time.time(),
            "last_used": None,
            "usage_count": 0
        }
        self._api_keys[key] = key_record
        return key_record

    def verify_api_key(self, key: str) -> Optional[Dict]:
        if not key:
            return None
        record = self._api_keys.get(key)
        if not record:
            return None
        record["last_used"] = time.time()
        record["usage_count"] = record.get("usage_count", 0) + 1
        user = self._users_by_id.get(record["user_id"])
        if user:
            return {k: v for k, v in user.items() if k != "password_hash"}
        return None

    def list_api_keys(self, user_id: str) -> List[Dict]:
        return [
            {k: v for k, v in rec.items() if k != "key"}  # Don't expose full key
            for rec in self._api_keys.values()
            if rec["user_id"] == user_id
        ]

    # ─── JWT Implementation (pure Python, no PyJWT needed) ───────────────────

    def _encode_jwt(self, payload: Dict) -> str:
        import base64
        header_b64 = base64.urlsafe_b64encode(
            self.JWT_HEADER.encode()
        ).rstrip(b"=").decode()
        payload_b64 = base64.urlsafe_b64encode(
            json.dumps(payload, separators=(",", ":")).encode()
        ).rstrip(b"=").decode()
        signing_input = f"{header_b64}.{payload_b64}"
        sig = hmac.new(
            self.secret.encode(), signing_input.encode(), hashlib.sha256
        ).digest()
        sig_b64 = base64.urlsafe_b64encode(sig).rstrip(b"=").decode()
        return f"{signing_input}.{sig_b64}"

    def _decode_jwt(self, token: str) -> Optional[Dict]:
        import base64
        try:
            parts = token.split(".")
            if len(parts) != 3:
                return None
            header_b64, payload_b64, sig_b64 = parts
            signing_input = f"{header_b64}.{payload_b64}"
            expected_sig = hmac.new(
                self.secret.encode(), signing_input.encode(), hashlib.sha256
            ).digest()
            provided_sig = base64.urlsafe_b64decode(sig_b64 + "==")
            if not hmac.compare_digest(expected_sig, provided_sig):
                return None  # Tampered
            padded = payload_b64 + "=="
            payload = json.loads(base64.urlsafe_b64decode(padded).decode())
            return payload
        except Exception:
            return None

    def _hash_password(self, password: str) -> str:
        salt = self.secret[:16]
        return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()

    def _create_demo_user(self):
        """Pre-seed a demo account for testing."""
        self.create_user(
            email="demo@intelliflow.ai",
            password="Demo2026!",
            name="Demo User",
            plan="pro"
        )
