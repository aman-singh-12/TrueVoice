"""
TrueVoice Tamper-Evident SHA-256 Hash-Chained Audit Ledger.
Enforces cryptographic audit record integrity using sequential hash chaining:
H_n = SHA256(H_(n-1) || CanonicalJSON(Event_n))
"""

import json
import hashlib
from typing import Dict, Any, List, Optional, Tuple

from app.core.exceptions import AuditTamperDetectedError


GENESIS_PREV_HASH = "0" * 64


class AuditLedgerChainer:
    """
    Cryptographic manager for the tamper-evident SHA-256 hash-chained audit ledger.
    Provides canonical serialization, hash generation, and full chain integrity verification.
    """

    @staticmethod
    def canonical_serialize(data: Dict[str, Any]) -> str:
        """
        Serialize event dictionary to canonical JSON representation:
        Key-sorted, whitespace-stripped separators (',', ':'), UTF-8 safe.
        """
        return json.dumps(data, sort_keys=True, separators=(',', ':'), default=str)

    @classmethod
    def compute_hash(
        cls,
        prev_hash: str,
        sequence_id: int,
        session_id: str,
        event_type: str,
        trust_state: str,
        payload: Dict[str, Any]
    ) -> str:
        """
        Compute SHA-256 hash for an audit record:
        H_n = SHA256(H_(n-1) || CanonicalJSON({sequence_id, session_id, event_type, trust_state, payload}))
        """
        canonical_event = {
            "sequence_id": sequence_id,
            "session_id": str(session_id),
            "event_type": event_type,
            "trust_state": trust_state,
            "payload": payload,
        }
        canonical_str = cls.canonical_serialize(canonical_event)
        combined = f"{prev_hash}{canonical_str}".encode("utf-8")
        return hashlib.sha256(combined).hexdigest()

    @classmethod
    def verify_chain(cls, records: List[Any]) -> Tuple[bool, Optional[int], Optional[str]]:
        """
        Validate a sequential list of audit records for tamper detection.
        Records can be AuditLog model instances or dicts.
        Returns: (is_valid, corrupted_sequence_id, error_detail)
        """
        if not records:
            return True, None, None

        # Ensure ordered by sequence_id
        sorted_records = sorted(
            records,
            key=lambda r: r.sequence_id if hasattr(r, "sequence_id") else r["sequence_id"]
        )

        expected_prev_hash = GENESIS_PREV_HASH

        for record in sorted_records:
            seq_id = record.sequence_id if hasattr(record, "sequence_id") else record["sequence_id"]
            sess_id = record.session_id if hasattr(record, "session_id") else record["session_id"]
            ev_type = record.event_type if hasattr(record, "event_type") else record["event_type"]
            t_state = record.trust_state if hasattr(record, "trust_state") else record["trust_state"]
            prev_h = record.prev_event_hash if hasattr(record, "prev_event_hash") else record["prev_event_hash"]
            ev_hash = record.event_hash if hasattr(record, "event_hash") else record["event_hash"]
            payload = record.payload_json if hasattr(record, "payload_json") else record["payload_json"]

            # 1. Check parent link
            if prev_h != expected_prev_hash:
                detail = (
                    f"Chain link broken at sequence {seq_id}: "
                    f"expected prev_hash '{expected_prev_hash}', got '{prev_h}'"
                )
                return False, seq_id, detail

            # 2. Recompute hash
            recomputed = cls.compute_hash(
                prev_hash=prev_h,
                sequence_id=seq_id,
                session_id=str(sess_id),
                event_type=ev_type,
                trust_state=t_state,
                payload=payload if isinstance(payload, dict) else {},
            )

            if recomputed != ev_hash:
                detail = (
                    f"Payload tampering detected at sequence {seq_id}: "
                    f"expected hash '{recomputed}', stored hash '{ev_hash}'"
                )
                return False, seq_id, detail

            expected_prev_hash = ev_hash

        return True, None, None
