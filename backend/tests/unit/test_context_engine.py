"""
Unit Tests for Context Engine (Part C).
Verifies evaluation of 8 operational context signals, configurable tenant policy parameters,
structured factor provenance, and missing signal availability handling.
"""

import pytest
from app.intelligence.context import ContextEngine, ContextResult


def test_empty_or_none_context_handling():
    """Verify that empty or None metadata returns baseline score with available=False."""
    engine = ContextEngine()

    res_none = engine.evaluate(None)
    assert res_none.score == 0.0
    assert res_none.risk_factors == []
    assert res_none.available is False

    res_empty = engine.evaluate({})
    assert res_empty.score == 0.0
    assert res_empty.risk_factors == []
    assert res_empty.available is False


def test_all_eight_operational_context_signals():
    """Verify all 8 context signals contribute deterministically to exposure."""
    engine = ContextEngine()

    context_data = {
        "amount": 1500000.0,
        "is_new_beneficiary": True,
        "is_off_hours": True,
        "caller_ani_matches": False,
        "is_unusual_channel": True,
        "is_privileged_user": True,
        "is_sensitive_operation": True,
        "is_unusual_transaction": True,
    }

    res = engine.evaluate(context_data)
    assert res.available is True
    assert res.score >= 0.85

    expected_types = [
        "HIGH_VALUE_OPERATION",
        "NEW_BENEFICIARY",
        "OFF_HOURS",
        "CALLER_DIRECTORY_MISMATCH",
        "UNUSUAL_CHANNEL",
        "PRIVILEGED_USER",
        "SENSITIVE_OPERATION",
        "UNUSUAL_TRANSACTION",
    ]

    detected_types = [f["type"] for f in res.factors]
    for ftype in expected_types:
        assert ftype in detected_types, f"Missing expected factor type: {ftype}"

    assert len(res.risk_factors) == 8


def test_configurable_tenant_thresholds():
    """Verify tenant policy thresholds can adjust high-value evaluation dynamically."""
    # Tenant with low threshold ($10,000)
    strict_engine = ContextEngine(tenant_policy={"high_value_threshold": 10000.0})
    res_strict = strict_engine.evaluate({"amount": 15000.0})
    detected_types = [f["type"] for f in res_strict.factors]
    assert "HIGH_VALUE_OPERATION" in detected_types

    # Tenant with high threshold ($1,000,000)
    permissive_engine = ContextEngine(tenant_policy={"high_value_threshold": 1000000.0})
    res_permissive = permissive_engine.evaluate({"amount": 15000.0})
    detected_types_perm = [f["type"] for f in res_permissive.factors]
    assert "HIGH_VALUE_OPERATION" not in detected_types_perm


def test_context_feature_decoupling_invariant():
    """Verify context scores strictly measure operational exposure and do not alter acoustics."""
    engine = ContextEngine()
    res = engine.evaluate({"amount": 1000000.0, "is_new_beneficiary": True})
    # Context result must only report context score and factors, never deepfake or voice metrics
    assert "deepfake_score" not in res.features
    assert "f0_mean" not in res.features
    assert 0.0 <= res.score <= 1.0
