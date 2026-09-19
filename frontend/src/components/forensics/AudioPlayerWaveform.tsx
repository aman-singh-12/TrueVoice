import React, { useState, useEffect, useRef } from 'react';
import { AudioSegment } from '../../types';

interface AudioPlayerWaveformProps {
  duration: number; // total duration in seconds
  currentTime: number;
  onSeek: (time: number) => void;
  segments: AudioSegment[];
  filename: string;
  sampleRate: string;
  codec: string;
  channelMode: string;
}

export const AudioPlayerWaveform: React.FC<AudioPlayerWaveformProps> = ({
  duration,
  currentTime,
  onSeek,
  segments,
  filename,
  sampleRate,
  codec,
  channelMode,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const waveformRef = useRef<HTMLDivElement>(null);

  // Playback timer simulation
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        const next = currentTime + 0.1 * playbackRate;
        if (next >= duration) {
          setIsPlaying(false);
          onSeek(0);
        } else {
          onSeek(next);
        }
      }, 100);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackRate, duration, onSeek, currentTime]);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const jump = (delta: number) => {
    const next = Math.max(0, Math.min(duration, currentTime + delta));
    onSeek(next);
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!waveformRef.current) return;
    const rect = waveformRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(ratio * duration);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  // Find active segment for the current timestamp
  const activeSegment = segments.find(
    (s) => currentTime >= s.startTime && currentTime <= s.endTime
  );

  // Generate 72 waveform bars for the visual display
  const totalBars = 72;
  const bars = Array.from({ length: totalBars }, (_, index) => {
    const barTime = (index / totalBars) * duration;
    const segment = segments.find(
      (s) => barTime >= s.startTime && barTime <= s.endTime
    );
    const isSynthetic = segment && segment.syntheticScore > 0.6;
    const isPlayed = barTime <= currentTime;

    // Pseudo-random deterministic height
    const baseHeight = ((Math.sin(index * 0.45) * 0.4 + 0.5) * 70 + 20);
    const height = isSynthetic
      ? Math.min(96, baseHeight * 1.2)
      : Math.max(18, baseHeight * 0.85);

    return {
      index,
      barTime,
      height,
      isSynthetic,
      isPlayed,
      syntheticScore: segment ? segment.syntheticScore : 0.1,
    };
  });

  return (
    <div className="bg-white border border-[#EAEAE5] rounded-2xl p-5 shadow-soft flex flex-col justify-between">
      {/* Waveform Header & Telemetry Specs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAEAE5] pb-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#FFF7ED] border border-[#FFEDD5] text-[#EA580C] shadow-soft-sm">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 10v3" />
              <path d="M6 6v11" />
              <path d="M10 3v18" />
              <path d="M14 8v7" />
              <path d="M18 5v13" />
              <path d="M22 10v3" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[#18181B] truncate max-w-sm">
                {filename}
              </h3>
              <span className="text-[10px] font-mono uppercase bg-[#F4F4F0] text-[#52525B] px-2 py-0.5 rounded border border-[#E4E4DF]">
                {channelMode}
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-[11px] font-mono text-[#71717A] mt-0.5">
              <span>{sampleRate}</span>
              <span>•</span>
              <span>{codec}</span>
            </div>
          </div>
        </div>

        {/* Live Segment Threat Indicator Pill */}
        {activeSegment && (
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border font-mono text-xs shadow-soft-sm ${
            activeSegment.syntheticScore > 0.6
              ? 'bg-[#FFF1F2] border-[#FECDD3] text-[#BE123C]'
              : 'bg-[#ECFDF5] border-[#A7F3D0] text-[#047857]'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              activeSegment.syntheticScore > 0.6 ? 'bg-[#BE123C] animate-pulse' : 'bg-[#047857]'
            }`} />
            <span>
              {activeSegment.syntheticScore > 0.6
                ? `SYNTHETIC BURST: ${(activeSegment.syntheticScore * 100).toFixed(0)}% PROB`
                : 'CLEAN BIOMETRIC HARMONICS'}
            </span>
          </div>
        )}
      </div>

      {/* Scrubbable Interactive Waveform Canvas */}
      <div
        ref={waveformRef}
        onClick={handleWaveformClick}
        className="relative h-28 bg-[#F9F9F7] border border-[#EAEAE5] rounded-xl p-3 cursor-pointer group select-none flex items-center justify-between gap-1 overflow-hidden shadow-inner"
      >
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-[radial-gradient(#E2E2DC_1px,transparent_1px)] [background-size:16px_16px] opacity-60 pointer-events-none" />

        {/* Shaded Synthetic Burst Regions */}
        {segments.map((seg) => {
          if (seg.syntheticScore <= 0.5) return null;
          const leftPercent = (seg.startTime / duration) * 100;
          const widthPercent = ((seg.endTime - seg.startTime) / duration) * 100;
          return (
            <div
              key={seg.id}
              className="absolute top-0 bottom-0 bg-[#FFF1F2]/80 border-x border-[#FECDD3] pointer-events-none transition-all flex flex-col justify-between py-1 px-1.5"
              style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
            >
              <span className="text-[9px] font-mono text-[#BE123C] font-semibold tracking-wider uppercase">
                Synth Zone
              </span>
              <span className="text-[8px] font-mono text-[#9F1239]">
                {(seg.syntheticScore * 100).toFixed(0)}% Anomaly
              </span>
            </div>
          );
        })}

        {/* Waveform Bars */}
        {bars.map((bar) => {
          let barBg = '#D4D4D0'; // Light warm gray
          if (bar.isSynthetic) {
            barBg = bar.isPlayed ? '#F43F5E' : '#FDA4AF';
          } else {
            barBg = bar.isPlayed ? '#F97316' : '#D4D4D0';
          }

          return (
            <div
              key={bar.index}
              className="relative flex-1 flex items-center justify-center h-full z-10"
            >
              <div
                className="w-full max-w-[4px] rounded-full transition-all duration-75"
                style={{ height: `${bar.height}%`, backgroundColor: barBg }}
              />
            </div>
          );
        })}

        {/* Scrub Playhead Scrubber */}
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-[#EA580C] z-20 pointer-events-none transition-all duration-100 ease-linear shadow-soft"
          style={{ left: `${(currentTime / duration) * 100}%` }}
        >
          <div className="absolute -top-1 -left-1.5 w-3.5 h-3.5 bg-white rounded-full border-2 border-[#EA580C] shadow-soft" />
        </div>
      </div>

      {/* Scrub Controls & Audio Player Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-2">
        {/* Left: Playback Controls */}
        <div className="flex items-center gap-2">
          {/* Jump -5s */}
          <button
            onClick={() => jump(-5)}
            className="p-2 rounded-xl bg-white hover:bg-[#F4F4F0] text-[#27272A] border border-[#E4E4DF] transition-colors shadow-soft-sm"
            title="Rewind 5 seconds"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
            </svg>
          </button>

          {/* Play / Pause Primary Button */}
          <button
            onClick={togglePlay}
            className={`px-4 py-2 rounded-xl font-mono text-xs font-semibold flex items-center gap-2 transition-all shadow-soft ${
              isPlaying
                ? 'bg-[#B45309] text-white hover:bg-[#92400E]'
                : 'bg-[#EA580C] text-white hover:bg-[#C2410C]'
            }`}
          >
            {isPlaying ? (
              <>
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
                PAUSE
              </>
            ) : (
              <>
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                PLAY FORENSICS
              </>
            )}
          </button>

          {/* Jump +5s */}
          <button
            onClick={() => jump(5)}
            className="p-2 rounded-xl bg-white hover:bg-[#F4F4F0] text-[#27272A] border border-[#E4E4DF] transition-colors shadow-soft-sm"
            title="Fast forward 5 seconds"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 17l5-5-5-5M6 17l5-5-5-5" />
            </svg>
          </button>
        </div>

        {/* Center: Timestamp Readout */}
        <div className="flex items-center gap-2 font-mono text-sm">
          <span className="text-[#EA580C] font-bold">{formatTime(currentTime)}</span>
          <span className="text-[#A1A1AA]">/</span>
          <span className="text-[#52525B]">{formatTime(duration)}</span>
        </div>

        {/* Right: Playback Speed Selector */}
        <div className="flex items-center gap-1 bg-[#F4F4F0] border border-[#EAEAE5] rounded-xl p-1 text-[11px] font-mono">
          {[1.0, 1.25, 1.5].map((rate) => (
            <button
              key={rate}
              onClick={() => setPlaybackRate(rate)}
              className={`px-2 py-0.5 rounded-lg transition-colors ${
                playbackRate === rate
                  ? 'bg-white text-[#EA580C] font-semibold shadow-soft-sm'
                  : 'text-[#71717A] hover:text-[#18181B]'
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
