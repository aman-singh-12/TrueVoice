import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChallengeModal } from '../components/ChallengeModal';
import type { ChallengeResponse, VerificationResultSummary } from '../types/api';

describe('ChallengeModal Component', () => {
  const sampleChallenge: ChallengeResponse = {
    challenge_token: 'chal-token-999',
    session_id: 'sess-888',
    challenge_type: 'OOB_PUSH',
    nonce: '482910',
    expires_at: new Date(Date.now() + 30000).toISOString(),
    ttl_seconds: 30,
    instructions: 'Check enrolled mobile device for push notification prompt',
  };

  it('renders challenge nonce and instructions', () => {
    render(
      <ChallengeModal
        challenge={sampleChallenge}
        isOpen={true}
        onClose={vi.fn()}
        onSubmitVerification={vi.fn()}
      />
    );

    expect(screen.getByTestId('challenge-modal')).toBeInTheDocument();
    expect(screen.getByText('482910')).toBeInTheDocument();
    expect(
      screen.getByText('Check enrolled mobile device for push notification prompt')
    ).toBeInTheDocument();
    expect(screen.getByText(/30s remaining/i)).toBeInTheDocument();
  });

  it('submits verification signature through backend API callback', async () => {
    const mockSubmit = vi.fn().mockResolvedValue({
      session_id: 'sess-888',
      status: 'SUCCESS',
      message: 'Cryptographic challenge verified successfully',
      verified_at: new Date().toISOString(),
    } as VerificationResultSummary);

    const mockClose = vi.fn();

    render(
      <ChallengeModal
        challenge={sampleChallenge}
        isOpen={true}
        onClose={mockClose}
        onSubmitVerification={mockSubmit}
      />
    );

    const input = screen.getByPlaceholderText('e.g., OTP code or nonce copy');
    fireEvent.change(input, { target: { value: '482910' } });

    const submitBtn = screen.getByText('Submit Verification');
    fireEvent.click(submitBtn);

    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(mockSubmit).toHaveBeenCalledWith(
      'chal-token-999',
      '482910',
      '482910'
    );

    await waitFor(() => {
      expect(screen.getByText(/SUCCESS:/i)).toBeInTheDocument();
    });
  });
});
