import React, { useState } from 'react';
import { ThreatPolicy } from '../../types';

interface PolicyTuningViewProps {
  initialPolicy: ThreatPolicy;
  onSavePolicy: (policy: ThreatPolicy) => void;
}

export const PolicyTuningView: React.FC<PolicyTuningViewProps> = ({
  initialPolicy,
  onSavePolicy,
}) => {
  const [policy, setPolicy] = useState<ThreatPolicy>(initialPolicy);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  const handleSave = () => {
    onSavePolicy(policy);
    setSaveToast('Policy rules committed to cryptographic audit ledger and synchronized across active cluster nodes.');
    setTimeout(() => setSaveToast(null), 3500);
  };

  const handleReset = () => {
    setPolicy({
      cautionThreshold: 35,
      verifyThreshold: 65,
      blockThreshold: 85,
      ecapaSimilarityThreshold: 0.78,
      syntheticBurstToleranceSec: 0.8,
      highValueWireLockdown: true,
      mfaChallengeAutomatic: true,
      telephonyVpnAnomalyBoost: true,
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Policy Header Banner */}
      <div className="bg-white border border-[#EAEAE5] p-5 rounded-2xl shadow-soft flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#18181B] flex items-center gap-2.5">
            <svg className="w-5 h-5 text-[#EA580C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            Threat Policies & Threshold Tuning
          </h2>
          <p className="text-xs text-[#71717A] mt-1 font-mono">
            Calibrate detection sensitivity, biometric cosine tolerance, and zero-trust action triggers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#F4F4F0] border border-[#E4E4DF] text-[#71717A] text-xs font-mono transition-colors shadow-soft-sm"
          >
            Reset Defaults
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-mono text-xs font-semibold transition-all shadow-soft"
          >
            SAVE POLICY CHANGES
          </button>
        </div>
      </div>

      {saveToast && (
        <div className="p-4 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-xs font-mono flex items-center gap-2 animate-in fade-in shadow-soft-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
          {saveToast}
        </div>
      )}

      {/* Threshold Sliders Section */}
      <div className="bg-white border border-[#EAEAE5] p-6 rounded-2xl shadow-soft space-y-6">
        <h3 className="text-sm font-bold text-[#18181B] font-mono uppercase tracking-wider border-b border-[#EAEAE5] pb-3">
          Composite Threat Tier Calibration
        </h3>

        {/* Caution Threshold Slider */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-[#B45309] font-semibold">1. Caution Alert Threshold</span>
            <span className="text-[#18181B] font-bold bg-[#F4F4F0] border border-[#E4E4DF] px-2 py-0.5 rounded">
              {policy.cautionThreshold}% Risk
            </span>
          </div>
          <input
            type="range"
            min="10"
            max="50"
            value={policy.cautionThreshold}
            onChange={(e) => setPolicy({ ...policy, cautionThreshold: Number(e.target.value) })}
            className="w-full accent-[#F59E0B] bg-[#EAEAE5] h-2 rounded-lg cursor-pointer"
          />
          <p className="text-[11px] text-[#71717A]">
            Triggers internal SOC alert tag on call session without interrupting active telephony audio.
          </p>
        </div>

        {/* Step-Up Verify Slider */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-[#EA580C] font-semibold">2. Step-Up Verification Threshold</span>
            <span className="text-[#18181B] font-bold bg-[#F4F4F0] border border-[#E4E4DF] px-2 py-0.5 rounded">
              {policy.verifyThreshold}% Risk
            </span>
          </div>
          <input
            type="range"
            min="40"
            max="80"
            value={policy.verifyThreshold}
            onChange={(e) => setPolicy({ ...policy, verifyThreshold: Number(e.target.value) })}
            className="w-full accent-[#EA580C] bg-[#EAEAE5] h-2 rounded-lg cursor-pointer"
          />
          <p className="text-[11px] text-[#71717A]">
            Enforces out-of-band hardware push challenge or secondary analyst confirmation before unlocking actions.
          </p>
        </div>

        {/* Block / Lockdown Slider */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-[#BE123C] font-semibold">3. Autonomous Lockdown Threshold</span>
            <span className="text-[#18181B] font-bold bg-[#F4F4F0] border border-[#E4E4DF] px-2 py-0.5 rounded">
              {policy.blockThreshold}% Risk
            </span>
          </div>
          <input
            type="range"
            min="70"
            max="95"
            value={policy.blockThreshold}
            onChange={(e) => setPolicy({ ...policy, blockThreshold: Number(e.target.value) })}
            className="w-full accent-[#BE123C] bg-[#EAEAE5] h-2 rounded-lg cursor-pointer"
          />
          <p className="text-[11px] text-[#71717A]">
            Instantly blocks all downstream wire transactions, credential resets, and infrastructure API triggers.
          </p>
        </div>
      </div>

      {/* ECAPA & Audio Specific Tuning */}
      <div className="bg-white border border-[#EAEAE5] p-6 rounded-2xl shadow-soft space-y-6">
        <h3 className="text-sm font-bold text-[#18181B] font-mono uppercase tracking-wider border-b border-[#EAEAE5] pb-3">
          Acoustic & Biometric Strictness
        </h3>

        {/* ECAPA Cosine Threshold */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-[#EA580C] font-semibold">ECAPA-TDNN Cosine Match Strictness</span>
            <span className="text-[#18181B] font-bold bg-[#F4F4F0] border border-[#E4E4DF] px-2 py-0.5 rounded">
              {policy.ecapaSimilarityThreshold.toFixed(2)} Similarity
            </span>
          </div>
          <input
            type="range"
            min="0.60"
            max="0.90"
            step="0.01"
            value={policy.ecapaSimilarityThreshold}
            onChange={(e) => setPolicy({ ...policy, ecapaSimilarityThreshold: Number(e.target.value) })}
            className="w-full accent-[#EA580C] bg-[#EAEAE5] h-2 rounded-lg cursor-pointer"
          />
          <p className="text-[11px] text-[#71717A]">
            Higher values reduce false accepts (impersonations) but may require re-enrollment in noisy environments.
          </p>
        </div>

        {/* Synthetic Burst Window */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-[#EA580C] font-semibold">Synthetic Burst Window Tolerance</span>
            <span className="text-[#18181B] font-bold bg-[#F4F4F0] border border-[#E4E4DF] px-2 py-0.5 rounded">
              {policy.syntheticBurstToleranceSec.toFixed(1)}s Continuous Window
            </span>
          </div>
          <input
            type="range"
            min="0.3"
            max="2.0"
            step="0.1"
            value={policy.syntheticBurstToleranceSec}
            onChange={(e) => setPolicy({ ...policy, syntheticBurstToleranceSec: Number(e.target.value) })}
            className="w-full accent-[#EA580C] bg-[#EAEAE5] h-2 rounded-lg cursor-pointer"
          />
          <p className="text-[11px] text-[#71717A]">
            Duration of synthetic artifacts required before raising acoustic alarm (avoids transient network glitch false alarms).
          </p>
        </div>
      </div>

      {/* Autonomous Guard Toggles */}
      <div className="bg-white border border-[#EAEAE5] p-6 rounded-2xl shadow-soft space-y-4">
        <h3 className="text-sm font-bold text-[#18181B] font-mono uppercase tracking-wider border-b border-[#EAEAE5] pb-3">
          Zero-Trust Automated Enforcements
        </h3>

        <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#F9F9F7] border border-[#EAEAE5] cursor-pointer hover:border-[#D4D4D0] transition-colors">
          <div>
            <div className="text-xs font-semibold text-[#18181B]">
              Auto-Lock High-Value Treasury Wires (&gt; $500k USD)
            </div>
            <div className="text-[11px] text-[#71717A]">
              Immediately intercept SWIFT / ACH instructions if voice confidence drops below 80%.
            </div>
          </div>
          <input
            type="checkbox"
            checked={policy.highValueWireLockdown}
            onChange={(e) => setPolicy({ ...policy, highValueWireLockdown: e.target.checked })}
            className="w-5 h-5 accent-[#EA580C] rounded cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#F9F9F7] border border-[#EAEAE5] cursor-pointer hover:border-[#D4D4D0] transition-colors">
          <div>
            <div className="text-xs font-semibold text-[#18181B]">
              Automatic Out-of-Band Hardware FIDO2 Challenge
            </div>
            <div className="text-[11px] text-[#71717A]">
              Dispatch push verification prompt to executive authenticator device on identity mismatch.
            </div>
          </div>
          <input
            type="checkbox"
            checked={policy.mfaChallengeAutomatic}
            onChange={(e) => setPolicy({ ...policy, mfaChallengeAutomatic: e.target.checked })}
            className="w-5 h-5 accent-[#EA580C] rounded cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#F9F9F7] border border-[#EAEAE5] cursor-pointer hover:border-[#D4D4D0] transition-colors">
          <div>
            <div className="text-xs font-semibold text-[#18181B]">
              Telephony Route AS-Path Anomaly Threat Multiplier
            </div>
            <div className="text-[11px] text-[#71717A]">
              Apply 1.35x threat boost when inbound SIP trunk originates from known proxy or foreign hop.
            </div>
          </div>
          <input
            type="checkbox"
            checked={policy.telephonyVpnAnomalyBoost}
            onChange={(e) => setPolicy({ ...policy, telephonyVpnAnomalyBoost: e.target.checked })}
            className="w-5 h-5 accent-[#EA580C] rounded cursor-pointer"
          />
        </label>
      </div>
    </div>
  );
};
