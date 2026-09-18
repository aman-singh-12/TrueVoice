"""
Unit Tests for Out-of-Band (OOB) Secondary Verification.
"""

from datetime import datetime, timezone, timedelta
import pytest

from app.core.constants import ChallengeStatus
from app.verification.oob import OutOfBandVerificationManager


def test_challenge_generation_and_success():
    """Verify challenge issuance and successful response validation."""
    mgr = OutOfBandVerificationManager(secret_key="test-secret-key-123", default_ttl_seconds=30)
    chal = mgr.generate_challenge(session_id="sess-test-1")

    assert chal["status"] == ChallengeStatus.PENDING.value
    assert len(chal["nonce"]) > 10

    # Client supplies correct nonce
    is_valid, new_status, reason = mgr.verify_response(
        challenge_token=chal["challenge_token"],
        nonce=chal["nonce"],
        client_response=chal["nonce"],
        current_status=chal["status"],
        expires_at=chal["expires_at"],
        attempt_count=0,
    )
    assert is_valid is True
    assert new_status == ChallengeStatus.SUCCESS


def test_challenge_expiration():
    """Verify expired challenge evaluates to TIMEOUT."""
    mgr = OutOfBandVerificationManager(secret_key="test-secret-key-123", default_ttl_seconds=30)
    chal = mgr.generate_challenge(session_id="sess-test-2")

    # Set expires_at in the past
    past_expiration = datetime.now(timezone.utc) - timedelta(seconds=5)

    is_valid, new_status, reason = mgr.verify_response(
        challenge_token=chal["challenge_token"],
        nonce=chal["nonce"],
        client_response=chal["nonce"],
        current_status=chal["status"],
        expires_at=past_expiration,
        attempt_count=0,
    )
    assert is_valid is False
    assert new_status == ChallengeStatus.TIMEOUT


def test_challenge_replay_prevention():
    """Verify already resolved challenge cannot be replayed."""
    mgr = OutOfBandVerificationManager(secret_key="test-secret-key-123", default_ttl_seconds=30)
    now = datetime.now(timezone.utc)
    exp = now + timedelta(seconds=30)

    is_valid, new_status, reason = mgr.verify_response(
        challenge_token="token-1",
        nonce="nonce-1",
        client_response="nonce-1",
        current_status=ChallengeStatus.SUCCESS.value,  # Already used
        expires_at=exp,
        attempt_count=1,
    )
    assert is_valid is False
    assert "already finalized" in reason.lower()
