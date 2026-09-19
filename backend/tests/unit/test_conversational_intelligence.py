"""
Unit Tests for Conversational Threat Intelligence Engine (Part B).
Verifies detection of 9 structured threat categories, multi-indicator scoring,
defensive speech resilience, and legacy API backward compatibility.
"""

import pytest
from app.intelligence.intent import IntentAnalyzer, IntentResult


def test_all_nine_threat_categories():
    """Verify each of the 9 specific threat categories is identified correctly."""
    analyzer = IntentAnalyzer()

    test_cases = [
        (
            "This is IT department executive security calling regarding an urgent directive.",
            "AUTHORITY_IMPERSONATION",
        ),
        (
            "You must process this wire transfer immediately within the next ten minutes or face penalties.",
            "FINANCIAL_URGENCY",
        ),
        (
            "Please confirm your security code and enter your password now.",
            "CREDENTIAL_SOLICITATION",
        ),
        (
            "Read me the 6-digit one-time passcode SMS code sent to your phone immediately.",
            "MFA_OTP_SOLICITATION",
        ),
        (
            "Please bypass standard dual authorization procedure just this once under special exception.",
            "SECURITY_BYPASS",
        ),
        (
            "Keep this strictly confidential between us and do not tell anyone in your office.",
            "SECRECY_REQUEST",
        ),
        (
            "Do not hang up or call me back on the main office line, stay on this line.",
            "CALLBACK_SUPPRESSION",
        ),
        (
            "If you do not comply right now, your account will be immediately suspended and terminated.",
            "COERCION_PRESSURE",
        ),
        (
            "Update the recipient account to this new escrow routing number and purchase gift card vouchers.",
            "UNUSUAL_PAYMENT_INSTRUCTION",
        ),
    ]

    for transcript, expected_category in test_cases:
        res = analyzer.analyze(transcript)
        assert expected_category in res.threat_categories, (
            f"Expected category {expected_category} for transcript: '{transcript}', got: {res.threat_categories}"
        )
        assert res.threat_score > 0.20


def test_multi_indicator_compounding():
    """Verify that multiple compounding threats yield a higher threat score."""
    analyzer = IntentAnalyzer()

    single_threat = "This is IT support calling."
    multi_threat = (
        "This is the executive director calling. You must bypass dual approval immediately, "
        "keep this strictly confidential, and wire the funds to this new routing account right now!"
    )

    res_single = analyzer.analyze(single_threat)
    res_multi = analyzer.analyze(multi_threat)

    assert len(res_multi.threat_categories) >= 3
    assert res_multi.threat_score > res_single.threat_score
    assert res_multi.threat_score >= 0.70


def test_defensive_speech_resilience():
    """Verify that defensive/educational security reminders do not cause false positives."""
    analyzer = IntentAnalyzer()

    advisory = (
        "Remember our policy: never share your password, PIN, or OTP with anyone. "
        "Do not bypass verification procedures."
    )
    res = analyzer.analyze(advisory)
    # Threat score should be suppressed or zero due to defensive patterns
    assert res.threat_score < 0.20


def test_legacy_api_compatibility():
    """Verify legacy evaluate() method returns tuple (score, flags) with both modern and legacy names."""
    analyzer = IntentAnalyzer()
    transcript = "This is IT support asking for your password and do not hang up."
    score, flags = analyzer.evaluate(transcript)

    assert isinstance(score, float)
    assert isinstance(flags, list)
    # Legacy aliases check
    assert "CREDENTIAL_REQUEST" in flags or "CREDENTIAL_SOLICITATION" in flags
