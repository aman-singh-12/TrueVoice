"""
Unit Tests for Tamper-Evident SHA-256 Hash-Chained Audit Ledger.
Verifies H_n = SHA256(H_(n-1) || CanonicalJSON(Event_n)) and tamper detection.
"""

from app.audit.chain import AuditLedgerChainer, GENESIS_PREV_HASH


def test_hash_chaining_and_verification():
    """Verify valid chain generation and mathematical verification."""
    session_id = "sess-12345"
    prev_hash = GENESIS_PREV_HASH
    records = []

    for seq in range(1, 4):
        event_type = f"EVENT_{seq}"
        trust_state = "OBSERVING"
        payload = {"step": seq, "action": "test"}

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

    is_valid, corrupted_seq, detail = AuditLedgerChainer.verify_chain(records)
    assert is_valid is True
    assert corrupted_seq is None


def test_tamper_detection_on_payload_alteration():
    """Verify that tampering with an event's payload invalidates the chain."""
    session_id = "sess-tamper-test"
    prev_hash = GENESIS_PREV_HASH
    records = []

    for seq in range(1, 4):
        payload = {"amount": 1000 * seq}
        ev_hash = AuditLedgerChainer.compute_hash(
            prev_hash=prev_hash,
            sequence_id=seq,
            session_id=session_id,
            event_type="TX",
            trust_state="OBSERVING",
            payload=payload,
        )
        records.append({
            "sequence_id": seq,
            "session_id": session_id,
            "event_type": "TX",
            "trust_state": "OBSERVING",
            "prev_event_hash": prev_hash,
            "event_hash": ev_hash,
            "payload_json": payload,
        })
        prev_hash = ev_hash

    # Tamper with record 2 payload (e.g. change transaction amount)
    records[1]["payload_json"] = {"amount": 999999}

    is_valid, corrupted_seq, detail = AuditLedgerChainer.verify_chain(records)
    assert is_valid is False
    assert corrupted_seq == 2
    assert "tampering detected" in detail.lower()
