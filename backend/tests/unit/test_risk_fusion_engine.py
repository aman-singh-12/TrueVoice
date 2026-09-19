"""
Unit Tests for Multi-Signal Risk Fusion Engine & Asymmetric EMA Temporal Smoothing (Part D).
Verifies complete signal availability matrix, dynamic weight renormalization,
non-linear compounding multiplier, and asymmetric EMA smoothing across chunks.
"""

import pytest
from app.core.constants import SignalAvailability, RiskTier
from app.risk.fusion import MultiSignalRiskFusion, classify_risk_tier
from app.risk.engine import SessionRiskEngine
from app.schemas.detection import DeepfakeResult
from app.schemas.speaker import VerificationResult
from app.forensics.analyzer import ForensicResult
from app.intelligence.context import ContextResult


def test_complete_signal_availability_combinations():
    """Verify dynamic weight renormalization across different subsets of available signals."""
    fusion = MultiSignalRiskFusion()

    # Case 1: All 5 signals available
    _, w1, _ = fusion.fuse(
        s_df=20.0, df_avail=SignalAvailability.AVAILABLE,
        s_speaker=0.8, spk_avail=SignalAvailability.AVAILABLE,
        s_conv=0.1, conv_avail=SignalAvailability.AVAILABLE,
        s_context=0.2, ctx_avail=SignalAvailability.AVAILABLE,
        s_forensic=15.0, for_avail=SignalAvailability.AVAILABLE,
    )
    assert len(w1) == 5
    assert pytest.approx(sum(w1.values()), abs=1e-5) == 1.0

    # Case 2: Only Deepfake and Forensics available (early call, no speech transcript, no enrollment, no context)
    score2, w2, comp2 = fusion.fuse(
        s_df=70.0, df_avail=SignalAvailability.AVAILABLE,
        s_speaker=None, spk_avail=SignalAvailability.UNAVAILABLE,
        s_conv=0.0, conv_avail=SignalAvailability.UNAVAILABLE,
        s_context=0.0, ctx_avail=SignalAvailability.UNAVAILABLE,
        s_forensic=60.0, for_avail=SignalAvailability.AVAILABLE,
    )
    assert set(w2.keys()) == {"deepfake", "forensics"}
    assert pytest.approx(sum(w2.values()), abs=1e-5) == 1.0
    assert 0.0 <= score2 <= 100.0

    # Case 3: All signals unavailable (neutral baseline)
    score3, w3, comp3 = fusion.fuse(
        s_df=0.0, df_avail=SignalAvailability.UNAVAILABLE,
        s_speaker=None, spk_avail=SignalAvailability.UNAVAILABLE,
        s_conv=0.0, conv_avail=SignalAvailability.UNAVAILABLE,
        s_context=0.0, ctx_avail=SignalAvailability.UNAVAILABLE,
        s_forensic=0.0, for_avail=SignalAvailability.UNAVAILABLE,
    )
    assert score3 == 0.0
    assert w3 == {}
    assert comp3 is False


def test_compounding_multiplier_behavior():
    """Verify compounding multiplier Gamma triggers only when dual independent threats occur."""
    fusion = MultiSignalRiskFusion(gamma=1.35)

    # Only deepfake high -> No compounding
    s_single, _, comp_single = fusion.fuse(
        s_df=85.0, df_avail=SignalAvailability.AVAILABLE,
        s_speaker=0.90, spk_avail=SignalAvailability.AVAILABLE,
        s_conv=0.0, conv_avail=SignalAvailability.AVAILABLE,
        s_context=0.0, ctx_avail=SignalAvailability.AVAILABLE,
        s_forensic=10.0, for_avail=SignalAvailability.AVAILABLE,
    )
    assert comp_single is False

    # Deepfake high + Conversational threat high -> Dual threat compounding
    s_dual, _, comp_dual = fusion.fuse(
        s_df=85.0, df_avail=SignalAvailability.AVAILABLE,
        s_speaker=0.90, spk_avail=SignalAvailability.AVAILABLE,
        s_conv=0.80, conv_avail=SignalAvailability.AVAILABLE,
        s_context=0.0, ctx_avail=SignalAvailability.AVAILABLE,
        s_forensic=10.0, for_avail=SignalAvailability.AVAILABLE,
    )
    assert comp_dual is True
    assert s_dual > s_single


def test_asymmetric_ema_oscillation_resilience():
    """Verify asymmetric EMA prevents rapid score flapping during intermittent silence/noise."""
    engine = SessionRiskEngine(session_id="session-oscillation", alpha_attack=0.60, alpha_decay=0.20)

    # Initial attack chunk: high threat
    res1 = engine.evaluate_chunk(
        sequence_id=1,
        df_res=DeepfakeResult(
            score=85.0, label="SYNTHETIC", confidence=0.9,
            signal_availability=SignalAvailability.AVAILABLE,
            model_name="mock", model_version="v1", inference_time_ms=1.0,
        ),
        spk_res=VerificationResult(
            similarity=0.2, threshold=0.75, signal_availability=SignalAvailability.AVAILABLE,
            model_name="mock", model_version="v1", inference_time_ms=1.0,
        ),
        af_res=ForensicResult(score=70.0, features={}, signal_availability=SignalAvailability.AVAILABLE),
        s_conv=0.7,
        conv_avail=SignalAvailability.AVAILABLE,
        ctx_res=ContextResult(score=0.3, risk_factors=[], features={}, available=True),
    )
    score1 = res1["composite_risk"]
    assert score1 >= 50.0

    # Next 3 chunks are brief pauses or low-confidence noise chunks
    for seq in [2, 3, 4]:
        res = engine.evaluate_chunk(
            sequence_id=seq,
            df_res=DeepfakeResult(
                score=15.0, label="AUTHENTIC", confidence=0.8,
                signal_availability=SignalAvailability.AVAILABLE,
                model_name="mock", model_version="v1", inference_time_ms=1.0,
            ),
            spk_res=VerificationResult(
                similarity=0.85, threshold=0.75, signal_availability=SignalAvailability.AVAILABLE,
                model_name="mock", model_version="v1", inference_time_ms=1.0,
            ),
            af_res=ForensicResult(score=10.0, features={}, signal_availability=SignalAvailability.AVAILABLE),
            s_conv=0.0,
            conv_avail=SignalAvailability.AVAILABLE,
            ctx_res=ContextResult(score=0.1, risk_factors=[], features={}, available=True),
        )

    # Due to slow decay (0.20), after 3 chunks the score does not immediately drop to 0
    # It decays smoothly and resists instant flapping
    assert res["composite_risk"] > 15.0


def test_session_risk_engine_reset():
    """Verify reset() restores engine to pristine initial state."""
    engine = SessionRiskEngine(session_id="session-reset")
    engine.evaluate_chunk(
        sequence_id=1,
        df_res=DeepfakeResult(
            score=90.0, label="SYNTHETIC", confidence=0.95,
            signal_availability=SignalAvailability.AVAILABLE,
            model_name="mock", model_version="v1", inference_time_ms=1.0,
        ),
        spk_res=VerificationResult(
            similarity=0.1, threshold=0.75, signal_availability=SignalAvailability.AVAILABLE,
            model_name="mock", model_version="v1", inference_time_ms=1.0,
        ),
        af_res=ForensicResult(score=80.0, features={}, signal_availability=SignalAvailability.AVAILABLE),
        s_conv=0.8,
        conv_avail=SignalAvailability.AVAILABLE,
        ctx_res=ContextResult(score=0.5, risk_factors=[], features={}, available=True),
    )
    assert engine.smoothed_risk > 0.0
    assert engine.peak_risk_score > 0.0
    assert len(engine.evaluation_history) == 1

    engine.reset()
    assert engine.smoothed_risk == 0.0
    assert engine.peak_risk_score == 0.0
    assert len(engine.evaluation_history) == 0
