"""
Security Tests: Out-of-Band (OOB) Challenge Lifecycle and Brute-Force Protection.
Fulfills Person 5 Part J requirements:
- Invalid verification response
- Expired challenge response
- Repeated verification attempts (rate limit / max attempts exceeded)
- Challenge replay prevention
"""

import pytest
from datetime import datetime, timezone, timedelta

from app.core.constants import ChallengeStatus
from app.verification.oob import OutOfBandVerificationManager


@pytest.fixture
def oob_manager():
    return OutOfBandVerificationManager(secret_key="unit-test-oob-secret-key", default_ttl_seconds=30)


@pytest.mark.security
def test_oob_invalid_response_rejected(oob_manager: OutOfBandVerificationManager):
    """Verify that an incorrect nonce response fails verification."""
    chal = oob_manager.generate_challenge(session_id="sess-sec-1")

    is_valid, new_status, reason = oob_manager.verify_response(
        challenge_token=chal["challenge_token"],
        nonce=chal["nonce"],
        client_response="WRONG_NONCE_RESPONSE",
        current_status=chal["status"],
        expires_at=chal["expires_at"],
        attempt_count=0,
    )

    assert is_valid is False
    assert new_status == ChallengeStatus.PENDING
    assert "invalid proof" in reason.lower()


@pytest.mark.security
def test_oob_expired_challenge_rejected(oob_manager: OutOfBandVerificationManager):
    """Verify that responding after challenge TTL has expired results in TIMEOUT."""
    chal = oob_manager.generate_challenge(session_id="sess-sec-2")
    past_expiry = datetime.now(timezone.utc) - timedelta(seconds=1)

    is_valid, new_status, reason = oob_manager.verify_response(
        challenge_token=chal["challenge_token"],
        nonce=chal["nonce"],
        client_response=chal["nonce"],
        current_status=chal["status"],
        expires_at=past_expiry,
        attempt_count=0,
    )

    assert is_valid is False
    assert new_status == ChallengeStatus.TIMEOUT
    assert "expired" in reason.lower()


@pytest.mark.security
def test_oob_repeated_attempts_exceeded(oob_manager: OutOfBandVerificationManager):
    """Verify that repeated failed attempts lock out the challenge."""
    chal = oob_manager.generate_challenge(session_id="sess-sec-3")

    is_valid, new_status, reason = oob_manager.verify_response(
        challenge_token=chal["challenge_token"],
        nonce=chal["nonce"],
        client_response="ATTACKER_BRUTE_FORCE",
        current_status=chal["status"],
        expires_at=chal["expires_at"],
        attempt_count=3,
        max_attempts=3,
    )

    assert is_valid is False
    assert new_status == ChallengeStatus.REJECTED
    assert "exceeded" in reason.lower()


@pytest.mark.security
def test_oob_challenge_replay_denied(oob_manager: OutOfBandVerificationManager):
    """Verify that an already successful challenge cannot be re-verified or reused."""
    now = datetime.now(timezone.utc)
    future_exp = now + timedelta(seconds=30)

    is_valid, new_status, reason = oob_manager.verify_response(
        challenge_token="token-already-used",
        nonce="valid-nonce-12345",
        client_response="valid-nonce-12345",
        current_status=ChallengeStatus.SUCCESS.value,
        expires_at=future_exp,
        attempt_count=1,
    )

    assert is_valid is False
    assert "already finalized" in reason.lower()
