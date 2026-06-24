"""
common/paystack_service.py
IntelliFlow Paystack Integration
Supports: transaction initialization, verification, subscriptions, webhooks
"""
import hmac
import hashlib
import json
import logging
import os
from typing import Any, Dict, Optional

import requests

logger = logging.getLogger("intelliflow.paystack")

PAYSTACK_BASE = "https://api.paystack.co"


class PaystackService:
    """
    Full Paystack integration for IntelliFlow.
    - Initialize one-time or recurring payments
    - Verify transactions
    - Manage plan subscriptions
    - Validate webhook signatures
    """

    def __init__(self, secret_key: str = "", public_key: str = ""):
        self.secret_key = secret_key or os.getenv("PAYSTACK_SECRET_KEY", "")
        self.public_key = public_key or os.getenv("PAYSTACK_PUBLIC_KEY", "")
        self._session = requests.Session()
        if self.secret_key:
            self._session.headers.update({
                "Authorization": f"Bearer {self.secret_key}",
                "Content-Type": "application/json"
            })

    # ─── Core Transactions ─────────────────────────────────────────────────────

    def initialize_transaction(
        self,
        email: str,
        amount: int,  # in kobo (NGN * 100) or pesewas/cents
        currency: str = "NGN",
        metadata: Optional[Dict] = None,
        callback_url: Optional[str] = None,
        plan_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Initialize a Paystack transaction.
        Returns: authorization_url, access_code, reference
        """
        if not self.secret_key:
            return self._mock_transaction(email, amount, metadata)

        payload: Dict[str, Any] = {
            "email": email,
            "amount": amount,
            "currency": currency,
            "metadata": metadata or {}
        }
        if callback_url:
            payload["callback_url"] = callback_url
        if plan_code:
            payload["plan"] = plan_code

        try:
            resp = self._session.post(f"{PAYSTACK_BASE}/transaction/initialize", json=payload, timeout=15)
            data = resp.json()
            if data.get("status") and data.get("data"):
                d = data["data"]
                return {
                    "success": True,
                    "authorization_url": d["authorization_url"],
                    "access_code": d["access_code"],
                    "reference": d["reference"]
                }
            return {"success": False, "error": data.get("message", "Unknown error")}
        except Exception as e:
            logger.exception("Paystack initialize failed")
            return {"success": False, "error": str(e)}

    def verify_transaction(self, reference: str) -> Dict[str, Any]:
        """Verify a transaction by reference."""
        if not self.secret_key:
            return self._mock_verify(reference)

        try:
            resp = self._session.get(
                f"{PAYSTACK_BASE}/transaction/verify/{reference}",
                timeout=15
            )
            data = resp.json()
            if data.get("status") and data.get("data", {}).get("status") == "success":
                d = data["data"]
                return {
                    "success": True,
                    "reference": reference,
                    "amount": d.get("amount"),
                    "currency": d.get("currency"),
                    "paid_at": d.get("paid_at"),
                    "customer_email": d.get("customer", {}).get("email"),
                    "metadata": d.get("metadata", {})
                }
            return {
                "success": False,
                "message": data.get("data", {}).get("gateway_response", "Payment not successful")
            }
        except Exception as e:
            logger.exception("Paystack verify failed")
            return {"success": False, "error": str(e)}

    # ─── Subscription Plans ────────────────────────────────────────────────────

    def create_plan(
        self,
        name: str,
        amount: int,
        interval: str = "monthly",
        description: str = ""
    ) -> Dict[str, Any]:
        """Create a Paystack subscription plan."""
        try:
            payload = {
                "name": name,
                "amount": amount,
                "interval": interval,  # hourly|daily|weekly|monthly|annually
                "description": description
            }
            resp = self._session.post(f"{PAYSTACK_BASE}/plan", json=payload, timeout=15)
            data = resp.json()
            if data.get("status"):
                return {"success": True, "plan_code": data["data"]["plan_code"], "id": data["data"]["id"]}
            return {"success": False, "error": data.get("message")}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def list_plans(self) -> Dict[str, Any]:
        """List all plans."""
        try:
            resp = self._session.get(f"{PAYSTACK_BASE}/plan", timeout=15)
            data = resp.json()
            return {"success": True, "plans": data.get("data", [])}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def cancel_subscription(self, subscription_code: str, token: str) -> Dict[str, Any]:
        """Cancel a subscription."""
        try:
            payload = {"code": subscription_code, "token": token}
            resp = self._session.post(f"{PAYSTACK_BASE}/subscription/disable", json=payload, timeout=15)
            data = resp.json()
            return {"success": data.get("status", False), "message": data.get("message")}
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ─── Webhook Verification ──────────────────────────────────────────────────

    def verify_webhook(self, payload: bytes, signature: str) -> bool:
        """Verify Paystack webhook signature using HMAC-SHA512."""
        if not self.secret_key:
            return True  # Skip in dev/test
        expected = hmac.new(
            self.secret_key.encode("utf-8"),
            payload,
            hashlib.sha512
        ).hexdigest()
        return hmac.compare_digest(expected, signature)

    # ─── Utilities ────────────────────────────────────────────────────────────

    def get_banks(self, country: str = "nigeria") -> Dict[str, Any]:
        """Fetch list of supported banks."""
        try:
            resp = self._session.get(f"{PAYSTACK_BASE}/bank?country={country}", timeout=10)
            data = resp.json()
            return {"success": True, "banks": data.get("data", [])}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def resolve_account(self, account_number: str, bank_code: str) -> Dict[str, Any]:
        """Resolve a bank account number to account name."""
        try:
            resp = self._session.get(
                f"{PAYSTACK_BASE}/bank/resolve?account_number={account_number}&bank_code={bank_code}",
                timeout=10
            )
            data = resp.json()
            if data.get("status"):
                return {"success": True, "account_name": data["data"]["account_name"]}
            return {"success": False, "error": data.get("message")}
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ─── Mock (Dev mode without live keys) ────────────────────────────────────

    def _mock_transaction(self, email: str, amount: int, metadata: Optional[Dict]) -> Dict:
        import uuid
        ref = f"mock_{uuid.uuid4().hex[:12]}"
        return {
            "success": True,
            "authorization_url": f"https://checkout.paystack.com/mock/{ref}",
            "access_code": f"mock_ac_{ref}",
            "reference": ref,
            "mock": True,
            "note": "Set PAYSTACK_SECRET_KEY env var for live payments"
        }

    def _mock_verify(self, reference: str) -> Dict:
        return {
            "success": True,
            "reference": reference,
            "amount": 1500000,
            "currency": "NGN",
            "paid_at": "2026-06-16T12:00:00Z",
            "metadata": {"plan": "pro"},
            "mock": True
        }
