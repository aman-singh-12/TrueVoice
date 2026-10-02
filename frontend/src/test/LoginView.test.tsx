import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginView } from '../views/LoginView';
import { api } from '../services/api';

describe('LoginView Component', () => {
  it('renders sign in mode and allows prefilling demo credentials', async () => {
    const onSuccess = vi.fn();
    render(<LoginView onSuccess={onSuccess} />);

    expect(screen.getByText('TrueVoice')).toBeInTheDocument();
    expect(screen.getByText('ENTERPRISE SOC')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Account/i })).toBeInTheDocument();

    // Click demo preset
    const analystPreset = screen.getByRole('button', { name: /Analyst Demo/i });
    fireEvent.click(analystPreset);

    const emailInput = screen.getByLabelText(/Analyst Email/i) as HTMLInputElement;
    expect(emailInput.value).toBe('analyst@truevoice.sec');
  });

  it('switches to create account mode and validates form fields', async () => {
    const onSuccess = vi.fn();
    render(<LoginView onSuccess={onSuccess} />);

    // Switch to Create Account
    const createAccountTab = screen.getByRole('button', { name: /Create Account/i });
    fireEvent.click(createAccountTab);

    expect(screen.getByLabelText(/Full Name \/ Call Sign/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Analyst Corporate Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Master Password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm Password/i)).toBeInTheDocument();
    expect(screen.getByText(/Security Role Assignment/i)).toBeInTheDocument();

    // Role options exist
    expect(screen.getByText('Security Analyst')).toBeInTheDocument();
    expect(screen.getByText('SOC Administrator')).toBeInTheDocument();
  });

  it('calls api.login on successful sign in submit', async () => {
    const onSuccess = vi.fn();
    const loginSpy = vi.spyOn(api, 'login').mockResolvedValueOnce({
      access_token: 'mock-token',
      token_type: 'bearer',
      expires_in_minutes: 15,
      user_id: 'user-123',
      org_id: 'org-123',
      role: 'SECURITY_ANALYST',
    });

    render(<LoginView onSuccess={onSuccess} />);

    const emailInput = screen.getByLabelText(/Analyst Email/i);
    const passwordInput = screen.getByLabelText(/Operator Access Token/i);
    const submitBtn = screen.getByRole('button', { name: /Access Security Console/i });

    fireEvent.change(emailInput, { target: { value: 'analyst@truevoice.sec' } });
    fireEvent.change(passwordInput, { target: { value: 'AnalystPass123!' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(loginSpy).toHaveBeenCalledWith({
        email: 'analyst@truevoice.sec',
        password: 'AnalystPass123!',
      });
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('calls api.register on valid account creation submit', async () => {
    const onSuccess = vi.fn();
    const registerSpy = vi.spyOn(api, 'register').mockResolvedValueOnce({
      access_token: 'new-user-token',
      token_type: 'bearer',
      expires_in_minutes: 15,
      user_id: 'new-user-123',
      org_id: 'new-org-123',
      role: 'SECURITY_ANALYST',
    });

    render(<LoginView onSuccess={onSuccess} />);

    // Switch to Create Account
    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/Analyst Corporate Email/i), { target: { value: 'jane@enterprise.sec' } });
    fireEvent.change(screen.getByLabelText(/^Master Password/i), { target: { value: 'SecurePassword123!' } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'SecurePassword123!' } });

    const submitBtn = screen.getByRole('button', { name: /Create Account & Access SOC/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalledWith({
        email: 'jane@enterprise.sec',
        password: 'SecurePassword123!',
        full_name: 'Jane Doe',
        role: 'SECURITY_ANALYST',
        organization_name: 'TrueVoice Security Operations',
      });
    });
  });
});
