import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RiskGauge } from '../components/RiskGauge';

describe('RiskGauge Component', () => {
  it('renders correctly in active state with moderate risk score', () => {
    render(
      <RiskGauge
        score={45.7}
        tier="MODERATE"
        trustState="CAUTION"
        active={true}
      />
    );

    const gauge = screen.getByTestId('risk-gauge');
    expect(gauge).toBeInTheDocument();
    expect(gauge).toHaveAttribute('aria-valuenow', '46');

    // Shows rounded score text
    expect(screen.getByText('46')).toBeInTheDocument();
    // Shows MODERATE RISK label
    expect(screen.getByText('MODERATE RISK')).toBeInTheDocument();
    // Shows CAUTION trust state
    expect(screen.getByText('CAUTION')).toBeInTheDocument();
  });

  it('renders standby state when inactive', () => {
    render(
      <RiskGauge
        score={0}
        tier="LOW"
        trustState="OBSERVING"
        active={false}
      />
    );

    expect(screen.getByText('--')).toBeInTheDocument();
    expect(screen.getByText('LOW RISK')).toBeInTheDocument();
    expect(screen.getByText('OBSERVING')).toBeInTheDocument();
  });

  it('clamps high values to 100 with CRITICAL label', () => {
    render(
      <RiskGauge
        score={120}
        tier="CRITICAL"
        trustState="BLOCKED"
        active={true}
      />
    );

    const gauge = screen.getByTestId('risk-gauge');
    expect(gauge).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('CRITICAL RISK')).toBeInTheDocument();
    expect(screen.getByText('BLOCKED')).toBeInTheDocument();
  });
});
