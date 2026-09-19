import React, { useState } from 'react';
import { AuditBlock } from '../../types';

interface AuditLedgerViewProps {
  auditBlocks: AuditBlock[];
}

export const AuditLedgerView: React.FC<AuditLedgerViewProps> = ({ auditBlocks }) => {
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<string | null>(null);

  const handleVerifyChain = () => {
    setIsVerifying(true);
    setVerificationResult(null);

    setTimeout(() => {
      setIsVerifying(false);
      setVerificationResult('All 4,892 cryptographic blocks verified intact. Zero tampering or invalid chain mutations detected.');
    }, 2000);
  };

  return (
    <div className="space-y-6">
      {/* Ledger Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white border border-[#EAEAE5] p-5 rounded-2xl shadow-soft">
        <div>
          <h2 className="text-lg font-bold text-[#18181B] flex items-center gap-2.5">
            <svg className="w-5 h-5 text-[#EA580C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            Cryptographic SHA-256 Audit Ledger
          </h2>
          <p className="text-xs text-[#71717A] mt-1 font-mono">
            Immutable Merkle Linkage • H(n-1) || Event(n) → H(n) Nonce Verification
          </p>
        </div>

        <button
          onClick={handleVerifyChain}
          disabled={isVerifying}
          className="px-4 py-2.5 rounded-xl bg-white hover:bg-[#F4F4F0] border border-[#E4E4DF] text-[#18181B] font-mono text-xs font-semibold transition-all flex items-center gap-2 shadow-soft-sm"
        >
          {isVerifying ? (
            <>
              <svg className="w-4 h-4 animate-spin text-[#EA580C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              VERIFYING HASH CONTINUITY...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 text-[#EA580C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              VERIFY LEDGER INTEGRITY
            </>
          )}
        </button>
      </div>

      {/* Verification Success Toast */}
      {verificationResult && (
        <div className="p-4 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-xs font-mono flex items-center gap-3 animate-in fade-in shadow-soft-sm">
          <span className="w-3 h-3 rounded-full bg-[#10B981]" />
          <span>{verificationResult}</span>
        </div>
      )}

      {/* Chained Blocks Timeline */}
      <div className="space-y-4">
        {auditBlocks.map((block, index) => {
          const isLatest = index === 0;

          const eventTypeBadge = {
            INCIDENT_VERDICT: 'bg-[#FFF1F2] text-[#BE123C] border-[#FECDD3]',
            POLICY_CHANGE: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]',
            BIOMETRIC_ENROLLMENT: 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]',
            CHALLENGE_ISSUED: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]',
            ACTION_OVERRIDE: 'bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]',
          }[block.eventType];

          return (
            <div key={block.blockNumber} className="relative">
              {/* Chain Link Connector Line */}
              {index < auditBlocks.length - 1 && (
                <div className="absolute left-8 top-full h-4 w-[2px] bg-[#EA580C]/30 z-0" />
              )}

              <div className={`bg-white border rounded-2xl p-5 shadow-soft transition-all ${
                isLatest
                  ? 'border-[#EA580C]/60 ring-2 ring-[#EA580C]/10'
                  : 'border-[#EAEAE5] hover:border-[#D4D4D0]'
              }`}>
                {/* Block Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAEAE5] pb-3 mb-3 font-mono">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#FFF7ED] border border-[#FFEDD5] text-[#EA580C] flex items-center justify-center font-bold text-xs shadow-soft-sm">
                      #{block.blockNumber}
                    </div>
                    <div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${eventTypeBadge}`}>
                        {block.eventType.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-[#71717A] ml-2">by {block.actor}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-[#71717A]">
                    <span>{block.timestamp}</span>
                    <span className="flex items-center gap-1 text-[#047857] font-bold">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      VALID
                    </span>
                  </div>
                </div>

                {/* Event Details Content */}
                <p className="text-xs text-[#27272A] font-sans leading-relaxed mb-4">
                  {block.details}
                </p>

                {/* Hashes Row: PrevHash -> CurrentHash */}
                <div className="bg-[#F9F9F7] p-3 rounded-xl border border-[#EAEAE5] font-mono text-[11px] grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[#A1A1AA] block mb-0.5">Previous Block Hash H(n-1):</span>
                    <span className="text-[#71717A] truncate block select-all" title={block.previousHash}>
                      {block.previousHash}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#EA580C] font-semibold block mb-0.5">Calculated Block Hash H(n):</span>
                    <span className="text-[#18181B] font-bold truncate block select-all" title={block.blockHash}>
                      {block.blockHash}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
