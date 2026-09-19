import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SignalRadar } from '../components/SignalRadar';
import type { SignalBreakdown, RiskProvenance } from '../types/telemetry';

describe('SignalRadar Component', () => {
  it('renders all 5 signals with models and scores', () => {
    const breakdown: SignalBreakdown = {
      deepfake: 0.75,
      speaker_similarity: 0.90,
      forensic_anomaly: 0.20,
      conversational_threat: 0.45,
      context_sensitivity: 0.30,
    };

    const provenance: RiskProvenance = {
      deepfake: {
        score: 0.75,
        signal_availability: 'AVAILABLE',
        model_name: 'Wav2Vec2-RawNet2-Ensemble',
        weight_applied: 0.35,
      },
      speaker_similarity: {
        score: 0.90,
        signal_availability: 'AVAILABLE',
        model_name: 'ECAPA-TDNN',
        weight_applied: 0.25,
      },
    };

    render(
      <SignalRadar breakdown={breakdown} provenance={provenance} active={true} />
    );

    expect(screen.getByTestId('signal-radar')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('Wav2Vec2-RawNet2-Ensemble')).toBeInTheDocument();
  });

  it('explicitly renders UNAVAILABLE badge when speaker similarity is missing/unenrolled', () => {
    // Speaker similarity is null (no enrolled voiceprint)
    const breakdown = {
      deepfake: 0.60,
      speaker_similarity: null as unknown as number,
      forensic_anomaly: 0.15,
      conversational_threat: 0.10,
      context_sensitivity: 0.20,
    };

    const provenance: RiskProvenance = {
      speaker_similarity: {
        score: 0.0,
        signal_availability: 'UNAVAILABLE',
        model_name: 'ECAPA-TDNN',
        weight_applied: 0.0,
      },
    };

    render(
      <SignalRadar breakdown={breakdown} provenance={provenance} active={true} />
    );

    // Must NOT show 0% for speaker similarity, must show UNAVAILABLE
    const speakerRow = screen.getByTestId('signal-speaker_similarity');
    expect(speakerRow).toHaveTextContent('Unavailable');
    expect(speakerRow).not.toHaveTextContent('0%');
  });
});
