import React, { useState } from 'react';
import { ForensicCallScenario } from '../../types';
import { RiskSpeedometer } from '../forensics/RiskSpeedometer';
import { AudioPlayerWaveform } from '../forensics/AudioPlayerWaveform';
import { TranscriptPanel } from '../forensics/TranscriptPanel';
import { BiometricLockdownPanel } from '../forensics/BiometricLockdownPanel';

interface ForensicsConsoleViewProps {
  currentScenario: ForensicCallScenario;
  onSelectScenario: (id: string) => void;
  onFileUpload: (file: File) => void;
}

export const ForensicsConsoleView: React.FC<ForensicsConsoleViewProps> = ({
  currentScenario,
  onSelectScenario,
  onFileUpload,
}) => {
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [uploadToast, setUploadToast] = useState<string | null>(null);

  // Reset playback position on scenario switch
  React.useEffect(() => {
    setCurrentTime(0);
  }, [currentScenario.id]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setUploadToast(`Ingesting forensic audio: ${file.name} (Extracting Mel Spectrogram & ECAPA Centroids...)`);
    onFileUpload(file);
    setTimeout(() => {
      setUploadToast(null);
    }, 4500);
  };

  return (
    <div className="space-y-6">
      {/* Forensic Ingestion Banner & Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative rounded-2xl border-2 border-dashed p-4 md:p-6 transition-all duration-300 shadow-soft ${
          isDragging
            ? 'border-[#EA580C] bg-[#FFF7ED] shadow-glow-terracotta'
            : 'border-[#EAEAE5] bg-white hover:border-[#D4D4D0]'
        }`}
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-left">
            <div className="w-12 h-12 rounded-xl bg-[#FFF7ED] border border-[#FFEDD5] text-[#EA580C] flex items-center justify-center flex-shrink-0 shadow-soft-sm">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-[#18181B] font-sans">
                  Recorded Voice Ingestion & Forensics Pipeline
                </h2>
                <span className="text-[10px] font-mono uppercase bg-[#F4F4F0] text-[#52525B] px-2 py-0.5 rounded border border-[#E4E4DF]">
                  Dual-Channel Support
                </span>
              </div>
              <p className="text-xs text-[#71717A] mt-1">
                Drop audio recording (<code className="text-[#EA580C] font-semibold">.wav</code>, <code className="text-[#EA580C] font-semibold">.mp3</code>, <code className="text-[#EA580C] font-semibold">.m4a</code>, <code className="text-[#EA580C] font-semibold">.flac</code>) to run acoustic vocoder detection, ECAPA-TDNN biometric centroid verification, and whisper transcription.
              </p>
            </div>
          </div>

          {/* Action / Browse Button */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <label className="cursor-pointer px-4 py-2.5 rounded-xl bg-white hover:bg-[#F4F4F0] border border-[#E4E4DF] text-[#18181B] text-xs font-mono font-semibold transition-colors flex items-center gap-2 shadow-soft-sm">
              <svg className="w-4 h-4 text-[#EA580C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                <path d="M12 12v9" />
                <path d="m8 16 4-4 4 4" />
              </svg>
              SELECT AUDIO FILE
              <input
                type="file"
                accept=".wav,.mp3,.m4a,.flac"
                className="hidden"
                onChange={handleFileInput}
              />
            </label>
          </div>
        </div>

        {/* Upload Status Toast */}
        {uploadToast && (
          <div className="mt-3 p-3 rounded-xl bg-[#FFF7ED] border border-[#FED7AA] text-[#9A3412] text-xs font-mono flex items-center gap-2.5 animate-pulse shadow-soft-sm">
            <span className="w-2 h-2 rounded-full bg-[#EA580C] animate-ping" />
            {uploadToast}
          </div>
        )}
      </div>

      {/* Active Scenario Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-[#EAEAE5] px-5 py-3 rounded-2xl shadow-soft">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-[#71717A]">ACTIVE INVESTIGATION:</span>
          <span className="text-sm font-semibold text-[#18181B] font-mono">
            {currentScenario.title}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#A1A1AA] font-mono">Quick Scenarios:</span>
          <button
            onClick={() => onSelectScenario('attack')}
            className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
              currentScenario.type === 'attack'
                ? 'bg-[#FFF1F2] text-[#BE123C] border border-[#FECDD3] font-bold shadow-soft-sm'
                : 'text-[#71717A] hover:text-[#18181B] bg-[#F4F4F0]'
            }`}
          >
            🔴 Escrow Attack
          </button>
          <button
            onClick={() => onSelectScenario('authentic')}
            className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
              currentScenario.type === 'authentic'
                ? 'bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0] font-bold shadow-soft-sm'
                : 'text-[#71717A] hover:text-[#18181B] bg-[#F4F4F0]'
            }`}
          >
            🟢 Authentic Exec
          </button>
          <button
            onClick={() => onSelectScenario('borderline')}
            className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
              currentScenario.type === 'borderline'
                ? 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] font-bold shadow-soft-sm'
                : 'text-[#71717A] hover:text-[#18181B] bg-[#F4F4F0]'
            }`}
          >
            🟡 Borderline Jitter
          </button>
        </div>
      </div>

      {/* 3-Column Flagship SOC Console Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column (Cols 1-4): Risk Speedometer & Vector Decomposition */}
        <div className="lg:col-span-4 flex flex-col">
          <RiskSpeedometer
            score={currentScenario.overallRiskScore}
            tier={currentScenario.riskTier}
            compoundingMultiplier={currentScenario.compoundingMultiplier}
            factors={currentScenario.factors}
            verdict={currentScenario.threatVerdict}
          />
        </div>

        {/* Center Column (Cols 5-8): Waveform & Time-Synced ASR Transcript */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <AudioPlayerWaveform
            duration={currentScenario.audioDuration}
            currentTime={currentTime}
            onSeek={(t) => setCurrentTime(t)}
            segments={currentScenario.segments}
            filename={currentScenario.filename}
            sampleRate={currentScenario.sampleRate}
            codec={currentScenario.codec}
            channelMode={currentScenario.channelMode}
          />

          <TranscriptPanel
            transcript={currentScenario.transcript}
            currentTime={currentTime}
            onSeek={(t) => setCurrentTime(t)}
          />
        </div>

        {/* Right Column (Cols 9-12): Enrolled Biometrics & Autonomous Policy Locks */}
        <div className="lg:col-span-3 flex flex-col">
          <BiometricLockdownPanel
            biometric={currentScenario.biometric}
            lockedActions={currentScenario.lockedActions}
            forensicHash={currentScenario.forensicSha256}
          />
        </div>
      </div>
    </div>
  );
};
