import React, { useState } from 'react';
import { BiometricIdentity } from '../../types';

interface VoiceBiometricsVaultViewProps {
  speakers: BiometricIdentity[];
  onAddSpeaker: (speaker: BiometricIdentity) => void;
}

export const VoiceBiometricsVaultView: React.FC<VoiceBiometricsVaultViewProps> = ({
  speakers,
  onAddSpeaker,
}) => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [enrollStep, setEnrollStep] = useState<1 | 2 | 3>(1);
  const [speakerList, setSpeakerList] = useState<BiometricIdentity[]>(speakers);

  const [formData, setFormData] = useState({
    fullName: '',
    title: '',
    department: 'Global Treasury & Finance',
  });
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordSeconds, setRecordSeconds] = useState<number>(0);

  React.useEffect(() => {
    let timer: any = null;
    if (isRecording) {
      timer = setInterval(() => {
        setRecordSeconds((s) => {
          if (s >= 5) {
            setIsRecording(false);
            setEnrollStep(3);
            return 5;
          }
          return s + 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  const handleStartRecord = () => {
    setIsRecording(true);
    setRecordSeconds(0);
  };

  const handleCompleteEnrollment = () => {
    const newSpeaker: BiometricIdentity = {
      enrolledId: `BIO-EXEC-${Math.floor(100 + Math.random() * 900)}`,
      fullName: formData.fullName || 'Authorized Executive',
      title: formData.title || 'Director',
      department: formData.department,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      ecapaEmbeddingHash: `0x${Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}...192d_centroid`,
      centroidSamples: 15,
      enrolledDate: new Date().toISOString().split('T')[0],
      similarityScore: 0.95,
      matchThreshold: 0.78,
      status: 'VERIFIED_MATCH',
    };

    setSpeakerList([newSpeaker, ...speakerList]);
    onAddSpeaker(newSpeaker);
    setIsModalOpen(false);
    setEnrollStep(1);
    setFormData({ fullName: '', title: '', department: 'Global Treasury & Finance' });
  };

  return (
    <div className="space-y-6">
      {/* Vault Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white border border-[#EAEAE5] p-5 rounded-2xl shadow-soft">
        <div>
          <h2 className="text-lg font-bold text-[#18181B] flex items-center gap-2.5">
            <svg className="w-5 h-5 text-[#EA580C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Voice Biometrics Vault & Enrollment Studio
          </h2>
          <p className="text-xs text-[#71717A] mt-1 font-mono">
            {speakerList.length} Authorized Executive Profiles • 192-d ECAPA-TDNN Centroids Enrolled
          </p>
        </div>

        <button
          onClick={() => {
            setIsModalOpen(true);
            setEnrollStep(1);
          }}
          className="px-4 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-mono text-xs font-semibold transition-all shadow-soft flex items-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          ENROLL NEW EXECUTIVE
        </button>
      </div>

      {/* Directory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {speakerList.map((speaker) => (
          <div
            key={speaker.enrolledId}
            className="bg-white border border-[#EAEAE5] hover:border-[#D4D4D0] rounded-2xl p-5 shadow-soft transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-4">
                <img
                  src={speaker.avatarUrl}
                  alt={speaker.fullName}
                  className="w-14 h-14 rounded-2xl object-cover border border-[#EAEAE5] shadow-soft-sm group-hover:scale-105 transition-transform"
                />
                <span className="text-[10px] font-mono uppercase bg-[#F4F4F0] text-[#52525B] px-2 py-0.5 rounded border border-[#E4E4DF]">
                  {speaker.enrolledId}
                </span>
              </div>

              <h3 className="text-base font-semibold text-[#18181B] group-hover:text-[#EA580C] transition-colors">
                {speaker.fullName}
              </h3>
              <p className="text-xs text-[#71717A] mt-0.5">{speaker.title}</p>
              <p className="text-[11px] font-mono text-[#EA580C] mt-1 font-medium">{speaker.department}</p>

              <div className="mt-4 pt-3 border-t border-[#EAEAE5] space-y-2 text-xs font-mono">
                <div className="flex justify-between text-[#71717A]">
                  <span>Centroid Samples:</span>
                  <span className="text-[#18181B] font-medium">{speaker.centroidSamples} clean PCM-16</span>
                </div>
                <div className="flex justify-between text-[#71717A]">
                  <span>Enrolled Date:</span>
                  <span className="text-[#18181B] font-medium">{speaker.enrolledDate}</span>
                </div>
                <div className="flex justify-between text-[#71717A]">
                  <span>Centroid Hash:</span>
                  <span className="text-[#EA580C] truncate max-w-[120px]" title={speaker.ecapaEmbeddingHash}>
                    {speaker.ecapaEmbeddingHash.slice(0, 10)}...
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-[#EAEAE5] flex items-center justify-between">
              <span className="text-[11px] font-mono text-[#047857] flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                Active Guard
              </span>
              <button className="text-xs text-[#71717A] hover:text-[#EA580C] font-mono transition-colors font-medium">
                Re-sample →
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 3-Step Microphone Enrollment Studio Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#18181B]/30 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-[#EAEAE5] rounded-2xl p-6 shadow-soft-lg animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#EAEAE5] pb-4 mb-5">
              <div>
                <h3 className="text-base font-bold text-[#18181B] flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#EA580C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  </svg>
                  Voice Biometrics Enrollment Studio
                </h3>
                <p className="text-xs text-[#71717A] font-mono mt-0.5">
                  Step {enrollStep} of 3 • ECAPA-TDNN Centroid Generation
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl bg-white hover:bg-[#F4F4F0] border border-[#E4E4DF] text-[#71717A] transition-colors shadow-soft-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Step 1: Metadata Form */}
            {enrollStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-[#52525B] mb-1 font-semibold">
                    Executive Full Name
                  </label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="e.g. Katherine Sterling"
                    className="w-full bg-white border border-[#E4E4DF] rounded-xl px-3.5 py-2.5 text-xs text-[#18181B] placeholder-[#A1A1AA] focus:outline-none focus:border-[#EA580C] font-mono shadow-soft-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-[#52525B] mb-1 font-semibold">
                    Corporate Title / Clearance
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Chief Operating Officer"
                    className="w-full bg-white border border-[#E4E4DF] rounded-xl px-3.5 py-2.5 text-xs text-[#18181B] placeholder-[#A1A1AA] focus:outline-none focus:border-[#EA580C] font-mono shadow-soft-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-[#52525B] mb-1 font-semibold">
                    Department Unit
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full bg-white border border-[#E4E4DF] rounded-xl px-3.5 py-2.5 text-xs text-[#18181B] focus:outline-none focus:border-[#EA580C] font-mono shadow-soft-sm"
                  >
                    <option>Global Treasury & Finance</option>
                    <option>Executive Office</option>
                    <option>Global Security & Resiliency</option>
                    <option>Platform Engineering</option>
                    <option>Legal & Compliance</option>
                  </select>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    onClick={() => setEnrollStep(2)}
                    disabled={!formData.fullName}
                    className="px-5 py-2.5 rounded-xl bg-[#EA580C] disabled:opacity-40 hover:bg-[#C2410C] text-white font-mono text-xs font-semibold transition-all shadow-soft"
                  >
                    PROCEED TO AUDIO CAPTURE →
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Microphone Recording Studio */}
            {enrollStep === 2 && (
              <div className="space-y-4 text-center py-2">
                <p className="text-xs text-[#52525B] mb-2 font-sans">
                  Please read the following phonetic verification prompt aloud into your microphone:
                </p>

                <div className="p-4 rounded-xl bg-[#FFF7ED] border border-[#FED7AA] text-xs font-mono text-[#9A3412] leading-relaxed italic shadow-soft-sm">
                  "I hereby authorize TrueVoice acoustic biometric profiling to safeguard my identity and downstream enterprise authorization workflows."
                </div>

                {/* Animated VU Meter & Record Button */}
                <div className="my-6 flex flex-col items-center justify-center">
                  <div className="w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all duration-300 relative cursor-pointer shadow-soft"
                    style={{
                      borderColor: isRecording ? '#BE123C' : '#EA580C',
                      backgroundColor: isRecording ? '#FFF1F2' : '#FFF7ED'
                    }}
                    onClick={!isRecording ? handleStartRecord : undefined}
                  >
                    <svg className={`w-8 h-8 ${isRecording ? 'text-[#BE123C] animate-pulse' : 'text-[#EA580C]'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    </svg>
                  </div>

                  <div className="mt-3 font-mono text-xs">
                    {isRecording ? (
                      <span className="text-[#BE123C] font-bold">
                        RECORDING HARMONIC TOKENS... {5 - recordSeconds}s REMAINING
                      </span>
                    ) : (
                      <span className="text-[#71717A]">Click microphone to begin 5-second capture</span>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex justify-between">
                  <button
                    onClick={() => setEnrollStep(1)}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-[#F4F4F0] border border-[#E4E4DF] text-[#71717A] font-mono text-xs shadow-soft-sm"
                  >
                    ← BACK
                  </button>
                  <button
                    onClick={() => setEnrollStep(3)}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-[#F4F4F0] text-[#EA580C] font-mono text-xs border border-[#E4E4DF] shadow-soft-sm font-semibold"
                  >
                    Skip to Extraction →
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Neural Centroid Extraction & Success */}
            {enrollStep === 3 && (
              <div className="space-y-4 text-center py-4">
                <div className="w-16 h-16 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] text-[#047857] flex items-center justify-center mx-auto shadow-soft">
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>

                <h4 className="text-base font-bold text-[#18181B]">
                  192-d ECAPA-TDNN Centroid Extracted!
                </h4>
                <p className="text-xs text-[#71717A] max-w-sm mx-auto">
                  Vocal tract characteristics, formants, and MFCC representations have been normalized and committed to the encrypted biometric enclave.
                </p>

                <div className="p-3 bg-[#F9F9F7] rounded-xl border border-[#EAEAE5] font-mono text-[11px] text-[#52525B] text-left space-y-1">
                  <div><strong>Speaker:</strong> {formData.fullName || 'Authorized Executive'}</div>
                  <div><strong>Embedding Dimension:</strong> 192 float32</div>
                  <div><strong>Initial Quality Score:</strong> 0.95 (High Purity)</div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={handleCompleteEnrollment}
                    className="w-full py-3 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-mono text-xs font-semibold transition-all shadow-soft"
                  >
                    REGISTER TO VAULT & CLOSE STUDIO
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
