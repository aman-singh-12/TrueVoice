import React from 'react';
import { RiskTier } from '../../types';

interface StatusBadgeProps {
  tier: RiskTier;
  size?: 'sm' | 'md' | 'lg';
  showPulse?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ tier, size = 'md', showPulse = true }) => {
  const configs = {
    LOW: {
      bg: 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]',
      dot: 'bg-[#047857]',
      label: 'LOW RISK'
    },
    CAUTION: {
      bg: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]',
      dot: 'bg-[#B45309]',
      label: 'CAUTION'
    },
    VERIFY: {
      bg: 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]',
      dot: 'bg-[#EA580C]',
      label: 'STEP-UP VERIFY'
    },
    CRITICAL: {
      bg: 'bg-[#FFF1F2] text-[#BE123C] border-[#FECDD3]',
      dot: 'bg-[#BE123C]',
      label: 'CRITICAL THREAT'
    }
  };

  const config = configs[tier] || configs.LOW;
  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 tracking-wider',
    md: 'text-xs px-2.5 py-1 tracking-wider',
    lg: 'text-sm px-3.5 py-1.5 tracking-widest'
  }[size];

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono font-semibold rounded-full border ${config.bg} ${sizeClasses} uppercase transition-all duration-300 shadow-soft-sm`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} ${showPulse ? 'animate-pulse' : ''}`} />
      {config.label}
    </span>
  );
};
