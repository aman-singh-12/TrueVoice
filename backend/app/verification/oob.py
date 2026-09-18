"""
TrueVoice Out-of-Band (OOB) Secondary Verification Engine.
Manages cryptographically strong nonces, 30s TTL challenge lifecycles,
HMAC signature validation, and anti-replay protections.
"""

import hmac
import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, Tuple

from app.core.constants import ChallengeType, ChallengeStatus
from app.core.exceptions import VerificationError
from app.config import get_settings


class OutOfBandVerificationManager:
    """
    Manages OOB push and in-band challenge lifecycle for secondary identity authentication.
    Enforces 30s TTL, replay prevention, and cryptographic proof verification.
    """

    def __init__(self, secret_key: Optional[str] = None, default_ttl_seconds: int = 30):
        settings = get_settings()
        self.secret_key = (secret_key or settings.secret_key).encode("utf-8")
        self.default_ttl = default_ttl_seconds

    def generate_challenge(
        self,
        session_id: str,
        challenge_type: ChallengeType = ChallengeType.OOB_PUSH,
        ttl_seconds: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Create a new cryptographic verification challenge with high-entropy nonce and expiration.
        """
        ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(seconds=ttl)

        challenge_token = secrets.token_hex(32)
        nonce = secrets.token_urlsafe(16)

        # Compute HMAC signature for client-side tamper-proofing
        msg = f"{session_id}:{challenge_token}:{nonce}:{int(expires_at.timestamp())}".encode("utf-8")
        signature = hmac.new(self.secret_key, msg, hashlib.sha256).hexdigest()

        return {
            "challenge_token": challenge_token,
            "nonce": nonce,
            "session_id": session_id,
            "challenge_type": challenge_type.value,
            "status": ChallengeStatus.PENDING.value,
            "expires_at": expires_at,
            "dispatched_at": now,
            "signature": signature,
        }

    def compute_expected_proof(self, challenge_token: str, nonce: str) -> str:
        """
        Derive the expected client verification proof:
        Proof = HMAC-SHA256(SecretKey, challenge_token || ":" || nonce)
        """
        msg = f"{challenge_token}:{nonce}".encode("utf-8")
        return hmac.new(self.secret_key, msg, hashlib.sha256).hexdigest()

    def verify_response(
        self,
        challenge_token: str,
        nonce: str,
        client_response: str,
        current_status: str,
        expires_at: datetime,
        attempt_count: int = 0,
        max_attempts: int = 3
    ) -> Tuple[bool, ChallengeStatus, str]:
        """
        Validate client response against active challenge.
        Returns (is_valid, new_status, reason).
        """
        now = datetime.now(timezone.utc)

        # 1. Anti-replay check
        if current_status != ChallengeStatus.PENDING.value:
            return False, ChallengeStatus(current_status), f"Challenge is already finalized ({current_status})"

        # 2. Expiration check
        # Ensure expires_at has timezone
        exp = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=timezone.utc)
        if now > exp:
            return False, ChallengeStatus.TIMEOUT, "Verification challenge has expired (TTL elapsed)"

        # 3. Rate limiting check
        if attempt_count >= max_attempts:
            return False, ChallengeStatus.REJECTED, "Maximum verification attempts exceeded"

        # 4. Cryptographic validation (constant-time comparison)
        # Client may send either the raw nonce or the derived HMAC proof
        expected_proof = self.compute_expected_proof(challenge_token, nonce)
        is_nonce_match = hmac.compare_digest(client_response.strip(), nonce.strip())
        is_proof_match = hmac.compare_digest(client_response.strip(), expected_proof)

        if is_nonce_match or is_proof_match:
            return True, ChallengeStatus.SUCCESS, "Verification proof confirmed"

        # If failed and reached max attempts
        if attempt_count + 1 >= max_attempts:
            return False, ChallengeStatus.REJECTED, "Invalid proof: max attempts reached"

        return False, ChallengeStatus.PENDING, "Invalid proof submitted"
