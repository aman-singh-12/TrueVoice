import React from 'react';
import { TranscriptToken } from '../../types';

interface TranscriptPanelProps {
  transcript: TranscriptToken[];
  currentTime: number;
  onSeek: (time: number) => void;
}

export const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  transcript,
  currentTime,
  onSeek,
}) => {
  const formatOffset = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `+${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isLineActive = (index: number) => {
    const currentLine = transcript[index];
    const nextLine = transcript[index + 1];
    const start = currentLine.timeOffset;
    const end = nextLine ? nextLine.timeOffset : start + 6;
    return currentTime >= start && currentTime < end;
  };

  return (
    <div className="bg-white border border-[#EAEAE5] rounded-2xl p-5 shadow-soft flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#EAEAE5] pb-3 mb-4">
        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider text-[#52525B] font-semibold flex items-center gap-2">
            <svg className="w-4 h-4 text-[#EA580C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Forensic Speech-To-Text (ASR)
          </h3>
          <p className="text-[11px] text-[#71717A] font-mono mt-0.5">
            Faster-Whisper Large-v3 • Time-Synced Threat Extraction
          </p>
        </div>
        <span className="text-[10px] font-mono text-[#C2410C] bg-[#FFF7ED] border border-[#FED7AA] px-2 py-0.5 rounded-full font-semibold shadow-soft-sm">
          CLICK LINE TO JUMP
        </span>
      </div>

      {/* Transcript Items List */}
      <div className="flex-1 space-y-2.5 overflow-y-auto pr-1 custom-scrollbar max-h-[360px]">
        {transcript.map((token, index) => {
          const active = isLineActive(index);
          const isCaller = token.speaker.includes('Caller');
          const hasThreat = !!token.threatToken;

          return (
            <div
              key={token.id}
              onClick={() => onSeek(token.timeOffset)}
              className={`p-3 rounded-xl border transition-all cursor-pointer select-none relative shadow-soft-sm ${
                active
                  ? 'bg-white border-[#EA580C] ring-2 ring-[#EA580C]/20 shadow-soft'
                  : hasThreat
                  ? 'bg-[#FFF7ED] border-[#FED7AA] hover:border-[#FDBA74]'
                  : 'bg-[#F9F9F7] border-[#E4E4DF] hover:border-[#D4D4D0]'
              }`}
            >
              {/* Speaker Metadata Bar */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isCaller ? 'bg-[#BE123C]' : 'bg-[#0284C7]'
                    }`}
                  />
                  <span
                    className={`text-xs font-mono font-semibold ${
                      isCaller ? 'text-[#9F1239]' : 'text-[#0369A1]'
                    }`}
                  >
                    {token.speaker}
                  </span>
                  <span className="text-[11px] font-mono text-[#A1A1AA]">
                    {formatOffset(token.timeOffset)}
                  </span>
                </div>

                {/* Threat Category Pill */}
                {token.threatToken && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-[#FFEDD5] text-[#9A3412] border border-[#FDBA74]">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    {token.threatToken.threatClass.replace('_', ' ')}
                  </span>
                )}
              </div>

              {/* Text Body with Threat Highlighting */}
              <p className={`text-xs leading-relaxed font-sans ${hasThreat ? 'text-[#7C2D12]' : 'text-[#27272A]'}`}>
                {token.threatToken ? (
                  renderHighlightedText(token.text, token.threatToken.keyword)
                ) : (
                  token.text
                )}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Utility to wrap detected threat phrases in warm terracotta tags
function renderHighlightedText(fullText: string, keyword: string) {
  const parts = fullText.split(new RegExp(`(${keyword})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === keyword.toLowerCase() ? (
      <span
        key={i}
        className="bg-[#FFEDD5] text-[#9A3412] border-b-2 border-[#EA580C] font-semibold px-1 rounded-sm mx-0.5"
      >
        {part}
      </span>
    ) : (
      part
    )
  );
}
