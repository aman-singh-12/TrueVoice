import React, { useState } from 'react';
import { BiometricIdentity, LockedAction } from '../../types';

interface BiometricLockdownPanelProps {
  biometric: BiometricIdentity;
  lockedActions: LockedAction[];
  forensicHash: string;
  onSendChallenge?: () => void;
  onManualOverride?: (actionId: string) => void;
}

export const BiometricLockdownPanel: React.FC<BiometricLockdownPanelProps> = ({
  biometric,
  lockedActions,
  forensicHash,
  onSendChallenge,
  onManualOverride,
}) => {
  const [challengeSent, setChallengeSent] = useState<boolean>(false);
  const [copiedHash, setCopiedHash] = useState<boolean>(false);
  const [localActions, setLocalActions] = useState<LockedAction[]>(lockedActions);

  React.useEffect(() => {
    setLocalActions(lockedActions);
  }, [lockedActions]);

  const handleChallenge = () => {
    setChallengeSent(true);
    if (onSendChallenge) onSendChallenge();
    setTimeout(() => {
      setChallengeSent(false);
    }, 4000);
  };

  const handleCopyHash = () => {
    navigator.clipboard.writeText(forensicHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleOverrideClick = (actionId: string) => {
    setLocalActions((prev) =>
      prev.map((act) =>
        act.id === actionId ? { ...act, status: 'RELEASED' } : act
      )
    );
    if (onManualOverride) onManualOverride(actionId);
  };

  const isMismatch = biometric.similarityScore < biometric.matchThreshold;

  return (
    <div className="space-y-4">
      {/* Enrolled Biometric Identity Verification Card */}
      <div className="bg-white border border-[#EAEAE5] rounded-2xl p-5 shadow-soft">
        <div className="flex items-center justify-between border-b border-[#EAEAE5] pb-3 mb-4">
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#52525B] font-semibold flex items-center gap-2">
              <svg className="w-4 h-4 text-[#EA580C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
              Enrolled Biometrics (ECAPA-TDNN)
            </h3>
            <p className="text-[11px] text-[#71717A] font-mono mt-0.5">
              192-Dimensional Acoustic Centroid
            </p>
          </div>
          <span
            className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full border shadow-soft-sm ${
              isMismatch
                ? 'bg-[#FFF1F2] text-[#BE123C] border-[#FECDD3]'
                : 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]'
            }`}
          >
            {isMismatch ? '🔴 MISMATCH' : '🟢 VERIFIED MATCH'}
          </span>
        </div>

        {/* Identity Row */}
        <div className="flex items-center gap-3.5 mb-4">
          <img
            src={biometric.avatarUrl}
            alt={biometric.fullName}
            className="w-12 h-12 rounded-xl object-cover border border-[#EAEAE5] shadow-soft-sm"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-[#18181B] truncate">
                {biometric.fullName}
              </h4>
              <span className="text-[10px] font-mono text-[#52525B] bg-[#F4F4F0] px-1.5 py-0.5 rounded border border-[#E4E4DF]">
                {biometric.enrolledId}
              </span>
            </div>
            <p className="text-xs text-[#71717A] truncate">{biometric.title}</p>
            <p className="text-[11px] text-[#A1A1AA] font-mono">{biometric.department}</p>
          </div>
        </div>

        {/* Centroid Match Score Gauge Bar */}
        <div className="space-y-1.5 bg-[#F9F9F7] p-3 rounded-xl border border-[#EAEAE5]">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-[#71717A]">Cosine Similarity:</span>
            <span className="font-bold text-[#18181B]">
              <span className={isMismatch ? 'text-[#BE123C]' : 'text-[#047857]'}>
                {biometric.similarityScore.toFixed(2)}
              </span>
              <span className="text-[#A1A1AA] font-normal"> / {biometric.matchThreshold.toFixed(2)} req</span>
            </span>
          </div>
          <div className="w-full bg-[#EAEAE5] rounded-full h-2 overflow-hidden relative">
            {/* Threshold Marker Pin */}
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-[#B45309] z-10"
              style={{ left: `${biometric.matchThreshold * 100}%` }}
              title={`Enterprise Threshold: ${biometric.matchThreshold}`}
            />
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                isMismatch ? 'bg-[#BE123C]' : 'bg-[#047857]'
              }`}
              style={{ width: `${biometric.similarityScore * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-[#A1A1AA] pt-0.5">
            <span>Centroid Samples: {biometric.centroidSamples}</span>
            <span>Enrolled: {biometric.enrolledDate}</span>
          </div>
        </div>
      </div>

      {/* Zero-Trust Autonomous Action Intercept Panel */}
      <div className="bg-white border border-[#EAEAE5] rounded-2xl p-5 shadow-soft">
        <div className="flex items-center justify-between border-b border-[#EAEAE5] pb-3 mb-4">
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#52525B] font-semibold flex items-center gap-2">
              <svg className="w-4 h-4 text-[#EA580C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Autonomous Policy Guard
            </h3>
            <p className="text-[11px] text-[#71717A] font-mono mt-0.5">
              Downstream Treasury & API Execution Gates
            </p>
          </div>
          <span className="text-xs font-mono text-[#71717A]">
            {localActions.filter((a) => a.status === 'LOCKED').length} Intercepted
          </span>
        </div>

        {localActions.length === 0 ? (
          <div className="p-4 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-center text-xs font-mono text-[#047857] shadow-soft-sm">
            <svg className="w-5 h-5 mx-auto mb-1 text-[#047857]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            No high-risk actions requested. Normal execution path open.
          </div>
        ) : (
          <div className="space-y-2.5">
            {localActions.map((action) => {
              const isLocked = action.status === 'LOCKED';
              const isPending = action.status === 'PENDING_CHALLENGE';

              return (
                <div
                  key={action.id}
                  className={`p-3 rounded-xl border transition-all shadow-soft-sm ${
                    isLocked
                      ? 'bg-[#FFF1F2] border-[#FECDD3]'
                      : isPending
                      ? 'bg-[#FFFBEB] border-[#FDE68A]'
                      : 'bg-[#F9F9F7] border-[#EAEAE5] text-[#71717A]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-[#18181B] truncate">
                      {action.actionName}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                        isLocked
                          ? 'bg-[#FFE4E6] text-[#BE123C] border border-[#FECDD3]'
                          : isPending
                          ? 'bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]'
                          : 'bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]'
                      }`}
                    >
                      {action.status}
                    </span>
                  </div>

                  <p className="text-[11px] font-mono text-[#52525B] truncate mb-2">
                    Target: {action.targetResource}
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-[#EAEAE5]/80 text-[11px] font-mono">
                    <span className="text-[#A1A1AA]">Locked At: {action.lockedAt}</span>
                    {isLocked && (
                      <button
                        onClick={() => handleOverrideClick(action.id)}
                        className="text-xs text-[#BE123C] hover:text-[#9F1239] font-medium hover:underline transition-colors"
                      >
                        Override Lock →
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Action Buttons: Out-of-Band Challenge & Override */}
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={handleChallenge}
                disabled={challengeSent}
                className={`w-full py-2.5 px-4 rounded-xl font-mono text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-soft ${
                  challengeSent
                    ? 'bg-[#047857] text-white'
                    : 'bg-[#EA580C] hover:bg-[#C2410C] text-white'
                }`}
              >
                {challengeSent ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    CHALLENGE BROADCASTED (WAITING FIDO2)...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                      <line x1="12" y1="18" x2="12.01" y2="18" />
                    </svg>
                    ISSUE HARDWARE STEP-UP CHALLENGE
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Cryptographic SHA-256 Hash Verification Footnote */}
        <div className="mt-4 pt-3 border-t border-[#EAEAE5] flex items-center justify-between text-[11px] font-mono text-[#71717A]">
          <div className="truncate max-w-[200px]" title={forensicHash}>
            SHA-256: {forensicHash.slice(0, 16)}...
          </div>
          <button
            onClick={handleCopyHash}
            className="text-[#EA580C] hover:text-[#C2410C] font-semibold transition-colors flex items-center gap-1"
          >
            {copiedHash ? '✓ Copied' : 'Copy Hash'}
          </button>
        </div>
      </div>
    </div>
  );
};
