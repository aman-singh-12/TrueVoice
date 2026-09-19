"""
Comprehensive Verification of Cryptographic Audit Ledger Integrity.
Fulfills Person 5 Part I requirements:
1. valid chain
2. modified payload
3. modified event hash
4. broken previous-hash link
5. reordered event
6. missing event
7. genesis validation
"""

import pytest
from app.audit.chain import AuditLedgerChainer, GENESIS_PREV_HASH


def build_valid_chain(n_events: int = 5, session_id: str = "sess-audit-integrity"):
    """Helper to generate a mathematically valid sequential audit chain."""
    prev_hash = GENESIS_PREV_HASH
    records = []

    for seq in range(1, n_events + 1):
        event_type = f"AUDIT_ACTION_{seq}"
        trust_state = "TRUSTED" if seq > 2 else "OBSERVING"
        payload = {"step": seq, "user_id": f"usr_{seq}", "auth_state": "OK"}

        ev_hash = AuditLedgerChainer.compute_hash(
            prev_hash=prev_hash,
            sequence_id=seq,
            session_id=session_id,
            event_type=event_type,
            trust_state=trust_state,
            payload=payload,
        )

        records.append({
            "sequence_id": seq,
            "session_id": session_id,
            "event_type": event_type,
            "trust_state": trust_state,
            "prev_event_hash": prev_hash,
            "event_hash": ev_hash,
            "payload_json": payload,
        })
        prev_hash = ev_hash

    return records


@pytest.mark.unit
def test_audit_valid_chain_succeeds():
    """Requirement 1: Valid sequential chain successfully passes verification."""
    records = build_valid_chain(n_events=6)
    is_valid, corrupted_seq, detail = AuditLedgerChainer.verify_chain(records)

    assert is_valid is True
    assert corrupted_seq is None
    assert detail is None


@pytest.mark.unit
def test_audit_modified_payload_fails():
    """Requirement 2: Tampering with payload content invalidates the chain."""
    records = build_valid_chain(n_events=5)
    # Alter payload at sequence 3
    records[2]["payload_json"]["auth_state"] = "TAMPERED_BY_ATTACKER"

    is_valid, corrupted_seq, detail = AuditLedgerChainer.verify_chain(records)

    assert is_valid is False
    assert corrupted_seq == 3
    assert "Payload tampering detected" in detail


@pytest.mark.unit
def test_audit_modified_event_hash_fails():
    """Requirement 3: Directly altering stored event hash fails verification."""
    records = build_valid_chain(n_events=5)
    # Tamper with event_hash at sequence 2
    records[1]["event_hash"] = "deadbeef" * 8

    is_valid, corrupted_seq, detail = AuditLedgerChainer.verify_chain(records)

    assert is_valid is False
    assert corrupted_seq in (2, 3)
    assert ("Payload tampering detected" in detail) or ("Chain link broken" in detail)


@pytest.mark.unit
def test_audit_broken_previous_hash_link_fails():
    """Requirement 4: Severing previous-hash link triggers broken chain detection."""
    records = build_valid_chain(n_events=5)
    # Invalidate prev_event_hash at sequence 4
    records[3]["prev_event_hash"] = "f" * 64

    is_valid, corrupted_seq, detail = AuditLedgerChainer.verify_chain(records)

    assert is_valid is False
    assert corrupted_seq == 4
    assert "Chain link broken" in detail


@pytest.mark.unit
def test_audit_reordered_events_fails():
    """Requirement 5: Swapping event order breaks cryptographic continuity."""
    records = build_valid_chain(n_events=5)
    # Swap sequence 2 and 3 sequence_ids (simulate malicious out-of-order execution)
    records[1]["sequence_id"] = 3
    records[2]["sequence_id"] = 2

    is_valid, corrupted_seq, detail = AuditLedgerChainer.verify_chain(records)

    assert is_valid is False
    assert corrupted_seq is not None


@pytest.mark.unit
def test_audit_missing_event_fails():
    """Requirement 6: Deleting an intermediate record from the ledger is detected."""
    records = build_valid_chain(n_events=5)
    # Attacker drops event at sequence 3 (sequence 1, 2, 4, 5 remain)
    deleted_seq = records.pop(2)
    assert deleted_seq["sequence_id"] == 3

    is_valid, corrupted_seq, detail = AuditLedgerChainer.verify_chain(records)

    assert is_valid is False
    # Sequence 4's prev_hash points to sequence 3's hash, but sequence 2's hash was expected
    assert corrupted_seq == 4
    assert "Chain link broken" in detail


@pytest.mark.unit
def test_audit_genesis_validation_fails_on_bogus_root():
    """Requirement 7: Genesis record with invalid prev_hash (not 64 zeros) fails."""
    records = build_valid_chain(n_events=3)
    # Corrupt genesis prev_hash
    records[0]["prev_event_hash"] = "1" * 64

    is_valid, corrupted_seq, detail = AuditLedgerChainer.verify_chain(records)

    assert is_valid is False
    assert corrupted_seq == 1
    assert "Chain link broken at sequence 1" in detail
