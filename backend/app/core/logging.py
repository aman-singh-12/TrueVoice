"""
TrueVoice Structured JSON Logger.
Enforces PII redaction and context correlation (request_id, session_id, org_id).
Never logs raw audio bytes, passwords, tokens, or raw biometric embeddings.
"""

import json
import logging
import re
import sys
from datetime import datetime, timezone
from typing import Any, Dict, Optional


# Regex patterns for redacting sensitive Indian identity and financial tokens
SENSITIVE_PATTERNS = [
    (re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b"), "[REDACTED_PAN]"),
    (re.compile(r"\b\d{4}\s?\d{4}\s?\d{4}\b"), "[REDACTED_AADHAAR]"),
    (re.compile(r"\b(?:\d{4}[-\s]?){3}\d{4}\b"), "[REDACTED_CARD]"),
    (re.compile(r"\b\d{6}\b"), "[REDACTED_OTP]"),
    (re.compile(r"(?i)(password|secret|token|bearer)\s*[:=]\s*['\"]?[^\s'\"]+"), r"\1=[REDACTED]"),
]


def redact_sensitive_text(text: str) -> str:
    """Redact sensitive identity numbers, credentials, and financial patterns."""
    if not isinstance(text, str):
        return text
    for pattern, replacement in SENSITIVE_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


class StructuredJsonFormatter(logging.Formatter):
    """Formats log records as single-line JSON objects."""

    def format(self, record: logging.LogRecord) -> str:
        log_data: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": redact_sensitive_text(record.getMessage()),
        }

        # Inject correlation identifiers if present
        for key in ("request_id", "session_id", "org_id", "model_version", "event_type"):
            if hasattr(record, key):
                log_data[key] = getattr(record, key)

        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_data)


def setup_logging(level: str = "INFO") -> logging.Logger:
    """Initialize root structured logger."""
    root_logger = logging.getLogger("truevoice")
    root_logger.setLevel(level.upper())
    root_logger.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(StructuredJsonFormatter())
    root_logger.addHandler(handler)
    root_logger.propagate = False

    return root_logger


logger = logging.getLogger("truevoice")
