import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AnalyzeView } from '../views/AnalyzeView';
import { api, ApiError } from '../services/api';
import type { AudioAnalysisResponse } from '../types/api';

const mockSuccessResponse: AudioAnalysisResponse = {
  analysis_id: 'test-analysis-uuid-1234',
  status: 'COMPLETED',
  created_at: '2026-09-19T10:00:00Z',
  reference_audio: {
    filename: 'reference_aditya.wav',
    size_bytes: 32000,
    duration_seconds: 1.0,
    sample_rate: 16000,
    channels: 1,
    format: 'WAV',
  },
  suspected_audio: {
    filename: 'suspected_clone.wav',
    size_bytes: 48000,
    duration_seconds: 1.5,
    sample_rate: 16000,
    channels: 1,
    format: 'WAV',
  },
  risk_score: 74.2,
  risk_tier: 'HIGH',
  trust_state: 'CAUTION',
  security_action: 'REQUEST_VERIFICATION',
  action_reason: 'Synthetic voice indicators with biometric divergence',
  rule_matched: 'HIGH_SYNTHETIC_DIVERGENCE_STEP_UP',
  primary_factors: [
    'Synthetic voice artifacts detected (Deepfake Score: 78.4/100)',
    'Biometric voiceprint divergence: Similarity of 0.42 is below verification threshold 0.75',
  ],
  evidence: [
    'Synthetic voice artifacts detected (Deepfake Score: 78.4/100)',
    'Biometric voiceprint divergence: Similarity of 0.42 is below verification threshold 0.75',
    'Acoustic DSP anomalies present (Score: 65.0/100)',
  ],
  signals: {
    deepfake: {
      score: 78.4,
      label: 'SYNTHETIC',
      confidence: 0.88,
      signal_availability: 'AVAILABLE',
      model_name: 'wav2vec2',
      model_version: '1.0.0',
      inference_time_ms: 12.5,
    },
    speaker: {
      similarity: 0.42,
      threshold: 0.75,
      is_match: false,
      confidence: 0.83,
      signal_availability: 'AVAILABLE',
      model_name: 'ecapa-tdnn',
      model_version: '1.0.0',
      inference_time_ms: 8.2,
    },
    forensics: {
      score: 65.0,
      signal_availability: 'AVAILABLE',
      f0_mean: 185.4,
      f0_std: 42.1,
      jitter_local: 0.0012,
      shimmer_local: 0.0095,
      hnr_db: 12.4,
      spectral_centroid_mean: 2350.0,
      spectral_rolloff_mean: 4800.0,
      spectral_flux_mean: 0.0345,
      rms_energy_mean: 0.0821,
      anomalies_detected: ['Acoustic micro-tremor pitch suppression (jitter 0.0012 < 0.0020)'],
      evidence: ['Acoustic micro-tremor pitch suppression (jitter 0.0012 < 0.0020)'],
      model_name: 'dsp-forensic-analyzer',
      model_version: 'v1.2.0',
    },
    conversation: {
      threat_score: 0.85,
      detected_intents: ['URGENCY_PRESSURE', 'OTP_SOLICITATION'],
      transcript: 'Please read the 6-digit one-time passcode immediately.',
      language: 'en',
      confidence: 0.94,
      signal_availability: 'AVAILABLE',
      model_name: 'faster-whisper',
      model_version: 'small',
    },
    context: {
      score: 0.4,
      signal_availability: 'AVAILABLE',
      risk_factors: ['High transaction amount'],
      features: { transaction_amount: 150000 },
    },
  },
  provenance: {
    deepfake_model: 'wav2vec2',
    deepfake_model_version: '1.0.0',
    speaker_model: 'ecapa-tdnn',
    speaker_model_version: '1.0.0',
    asr_model: 'faster-whisper',
    asr_model_version: 'small',
    ml_mode: 'live',
    ml_device: 'cpu',
  },
  pipeline_stages_completed: [
    'upload_received',
    'audio_preprocessing',
    'deepfake_detection',
    'speaker_verification',
    'acoustic_forensics',
    'asr_transcription',
    'multi_signal_risk_fusion',
    'policy_evaluation',
    'final_result_ready',
  ],
  total_processing_time_ms: 142.5,
};

describe('AnalyzeView Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-audio-preview-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('renders initial state with dual upload dropzones and disabled submit button', () => {
    render(<AnalyzeView />);

    expect(screen.getByText('Voice Forensic Analysis')).toBeInTheDocument();
    expect(screen.getByText('Reference Voice Sample')).toBeInTheDocument();
    expect(screen.getByText('Suspected Voice Recording')).toBeInTheDocument();

    const analyzeBtn = screen.getByRole('button', { name: /Analyze Voice/i });
    expect(analyzeBtn).toBeDisabled();
  });

  it('handles file selection for reference and suspected recordings', async () => {
    render(<AnalyzeView />);

    const refFile = new File(['fake-ref-audio-content'], 'reference_sample.wav', { type: 'audio/wav' });
    const suspFile = new File(['fake-susp-audio-content'], 'suspected_sample.wav', { type: 'audio/wav' });

    const fileInputs = document.querySelectorAll('input[type="file"]');
    expect(fileInputs.length).toBe(2);

    fireEvent.change(fileInputs[0], { target: { files: [refFile] } });
    fireEvent.change(fileInputs[1], { target: { files: [suspFile] } });

    expect(screen.getByText('reference_sample.wav')).toBeInTheDocument();
    expect(screen.getByText('suspected_sample.wav')).toBeInTheDocument();

    const analyzeBtn = screen.getByRole('button', { name: /Analyze Voice/i });
    expect(analyzeBtn).not.toBeDisabled();
  });

  it('executes analysis and renders authoritative results correctly', async () => {
    const analyzeSpy = vi.spyOn(api, 'analyzeAudio').mockResolvedValueOnce(mockSuccessResponse);

    render(<AnalyzeView />);

    const refFile = new File(['audio-content-1'], 'reference_aditya.wav', { type: 'audio/wav' });
    const suspFile = new File(['audio-content-2'], 'suspected_clone.wav', { type: 'audio/wav' });

    const fileInputs = document.querySelectorAll('input[type="file"]');
    fireEvent.change(fileInputs[0], { target: { files: [refFile] } });
    fireEvent.change(fileInputs[1], { target: { files: [suspFile] } });

    const analyzeBtn = screen.getByRole('button', { name: /Analyze Voice/i });
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(analyzeSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Analysis Complete')).toBeInTheDocument();
      // Primary Verdicts
      expect(screen.getByText('74.2')).toBeInTheDocument();
      expect(screen.getByText('High')).toBeInTheDocument();
      expect(screen.getByText(/REQUEST VERIFICATION/i)).toBeInTheDocument();
    });

    // Signal Breakdown
    expect(screen.getByText('78.4')).toBeInTheDocument();
    expect(screen.getByText('SYNTHETIC')).toBeInTheDocument();
    expect(screen.getByText('0.420')).toBeInTheDocument();
    expect(screen.getByText('DIVERGENCE')).toBeInTheDocument();
    expect(screen.getByText('URGENCY_PRESSURE')).toBeInTheDocument();
    expect(screen.getByText('OTP_SOLICITATION')).toBeInTheDocument();

    // Evidence
    expect(
      screen.getByText(/Synthetic voice artifacts detected \(Deepfake Score: 78.4\/100\)/i)
    ).toBeInTheDocument();

    // Model Provenance
    expect(screen.getByText(/live mode/i)).toBeInTheDocument();
  });

  it('handles backend error properly and displays error banner', async () => {
    vi.spyOn(api, 'analyzeAudio').mockRejectedValueOnce(
      new ApiError(400, 'Audio file duration (0.10s) is below minimum required 0.25 seconds.')
    );

    render(<AnalyzeView />);

    const refFile = new File(['audio-content-1'], 'ref.wav', { type: 'audio/wav' });
    const suspFile = new File(['audio-content-2'], 'susp.wav', { type: 'audio/wav' });

    const fileInputs = document.querySelectorAll('input[type="file"]');
    fireEvent.change(fileInputs[0], { target: { files: [refFile] } });
    fireEvent.change(fileInputs[1], { target: { files: [suspFile] } });

    const analyzeBtn = screen.getByRole('button', { name: /Analyze Voice/i });
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(screen.getByText(/Analysis Failed/i)).toBeInTheDocument();
      expect(screen.getByText(/below minimum required 0.25 seconds/i)).toBeInTheDocument();
    });
  });

  it('allows expanding transcript and forensic details', async () => {
    vi.spyOn(api, 'analyzeAudio').mockResolvedValueOnce(mockSuccessResponse);

    render(<AnalyzeView />);

    const refFile = new File(['audio-content-1'], 'ref.wav', { type: 'audio/wav' });
    const suspFile = new File(['audio-content-2'], 'susp.wav', { type: 'audio/wav' });

    const fileInputs = document.querySelectorAll('input[type="file"]');
    fireEvent.change(fileInputs[0], { target: { files: [refFile] } });
    fireEvent.change(fileInputs[1], { target: { files: [suspFile] } });

    fireEvent.click(screen.getByRole('button', { name: /Analyze Voice/i }));

    await waitFor(() => {
      expect(screen.getByText('Analysis Complete')).toBeInTheDocument();
    });

    // Expand transcript
    const transcriptHeader = screen.getByText(/Speech Recognition & Transcript/i);
    fireEvent.click(transcriptHeader);
    expect(
      screen.getByText(/"Please read the 6-digit one-time passcode immediately."/i)
    ).toBeInTheDocument();

    // Expand acoustic forensics
    const forensicsHeader = screen.getByText(/Acoustic Forensics & Physical DSP Measurements/i);
    fireEvent.click(forensicsHeader);
    expect(screen.getByText('185.4 Hz')).toBeInTheDocument();
    expect(screen.getByText('12.4 dB')).toBeInTheDocument();
  });
});
