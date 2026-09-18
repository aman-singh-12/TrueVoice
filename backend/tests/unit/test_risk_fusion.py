"""
Unit Tests for Multi-Signal Risk Fusion & Asymmetric EMA Engine.
"""

import pytest

from app.core.constants import SignalAvailability, RiskTier
from app.risk.fusion import MultiSignalRiskFusion, classify_risk_tier
from app.risk.engine import SessionRiskEngine
from app.schemas.detection import DeepfakeResult
from app.schemas.speaker import VerificationResult
from app.forensics.analyzer import ForensicResult
from app.intelligence.context import ContextResult


def test_classify_risk_tier():
    """Verify standard 4-tier risk classification."""
    assert classify_risk_tier(0.0) == RiskTier.LOW
    assert classify_risk_tier(29.9) == RiskTier.LOW
    assert classify_risk_tier(30.0) == RiskTier.MODERATE
    assert classify_risk_tier(59.9) == RiskTier.MODERATE
    assert classify_risk_tier(60.0) == RiskTier.HIGH
    assert classify_risk_tier(79.9) == RiskTier.HIGH
    assert classify_risk_tier(80.0) == RiskTier.CRITICAL
    assert classify_risk_tier(100.0) == RiskTier.CRITICAL


def test_dynamic_weight_renormalization():
    """Verify that when speaker verification is UNAVAILABLE, weights renormalize to sum to 1.0."""
    fusion = MultiSignalRiskFusion()
    # Speaker unavailable
    r_raw, normalized_weights, has_compounding = fusion.fuse(
        s_df=40.0,
        df_avail=SignalAvailability.AVAILABLE,
        s_speaker=None,
        spk_avail=SignalAvailability.UNAVAILABLE,
        s_conv=0.2,
        conv_avail=SignalAvailability.AVAILABLE,
        s_context=0.1,
        ctx_avail=SignalAvailability.AVAILABLE,
        s_forensic=20.0,
        for_avail=SignalAvailability.AVAILABLE,
    )
    assert pytest.approx(sum(normalized_weights.values()), abs=1e-5) == 1.0
    assert "speaker" not in normalized_weights
    assert 0.0 <= r_raw <= 100.0


def test_compounding_multiplier():
    """Verify compounding multiplier Gamma=1.35 triggers when deepfake and speaker mismatch are elevated."""
    fusion = MultiSignalRiskFusion(gamma=1.35)

    # Both deepfake score > 60 and speaker similarity < 0.60
    r_raw, _, has_compounding = fusion.fuse(
        s_df=75.0,
        df_avail=SignalAvailability.AVAILABLE,
        s_speaker=0.30,  # High mismatch
        spk_avail=SignalAvailability.AVAILABLE,
        s_conv=0.0,
        conv_avail=SignalAvailability.UNAVAILABLE,
        s_context=0.0,
        ctx_avail=SignalAvailability.AVAILABLE,
        s_forensic=50.0,
        for_avail=SignalAvailability.AVAILABLE,
    )
    assert has_compounding is True
    assert r_raw > 60.0


def test_asymmetric_ema_smoothing():
    """Verify rapid attack response (alpha=0.60) and gradual decay (alpha=0.20)."""
    engine = SessionRiskEngine(session_id="test-sess", alpha_attack=0.60, alpha_decay=0.20)

    # First update from baseline 0 -> sudden spike to 80
    res1 = engine.evaluate_chunk(
        sequence_id=1,
        df_res=DeepfakeResult(
            score=80.0, label="SYNTHETIC", confidence=0.9,
            signal_availability=SignalAvailability.AVAILABLE,
            model_name="mock", model_version="v1", inference_time_ms=1.0
        ),
        spk_res=VerificationResult(
            similarity=0.2, threshold=0.75, signal_availability=SignalAvailability.AVAILABLE,
            model_name="mock", model_version="v1", inference_time_ms=1.0
        ),
        af_res=ForensicResult(score=60.0, features={}),
        s_conv=0.5,
        conv_avail=SignalAvailability.AVAILABLE,
        ctx_res=ContextResult(score=0.5, risk_factors=[], features={}),
    )
    score1 = res1["composite_risk"]
    assert score1 > 40.0  # Rapid escalation on attack

    # Next update with low risk (drop to 10)
    res2 = engine.evaluate_chunk(
        sequence_id=2,
        df_res=DeepfakeResult(
            score=10.0, label="AUTHENTIC", confidence=0.9,
            signal_availability=SignalAvailability.AVAILABLE,
            model_name="mock", model_version="v1", inference_time_ms=1.0
        ),
        spk_res=VerificationResult(
            similarity=0.9, threshold=0.75, signal_availability=SignalAvailability.AVAILABLE,
            model_name="mock", model_version="v1", inference_time_ms=1.0
        ),
        af_res=ForensicResult(score=10.0, features={}),
        s_conv=0.0,
        conv_avail=SignalAvailability.AVAILABLE,
        ctx_res=ContextResult(score=0.0, risk_factors=[], features={}),
    )
    score2 = res2["composite_risk"]
    # Gradual decay: score2 should decay slowly via alpha=0.20, remaining elevated
    assert score2 > 20.0
