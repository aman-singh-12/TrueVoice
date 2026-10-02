import { useState, useRef, type ChangeEvent, type DragEvent } from 'react';
import { api, ApiError } from '../services/api';
import { hrefFor } from '../lib/routing';
import { cn } from '../lib/cn';
import { PageHeader, Panel, Button, ErrorState } from '../components/ui/primitives';
import { RiskBadge, TrustBadge } from '../components/ui/badges';
import type { AudioAnalysisResponse, SignalAvailability } from '../types/api';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileAudio,
  Layers,
  MessageSquare,
  Radio,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Volume2,
  Zap,
} from 'lucide-react';

interface SelectedFileState {
  file: File;
  previewUrl: string;
}

const STAGES = [
  { id: 'uploading', label: '1. Uploading Audio Files', desc: 'Secure payload transmission to TrueVoice engine' },
  { id: 'audio_preprocessing', label: '2. Preprocessing & Normalization', desc: 'Polyphase resampling to 16 kHz Mono float32' },
  { id: 'deepfake_detection', label: '3. Deepfake Artifact Detection', desc: 'Evaluating resident neural synthetic artifact detector' },
  { id: 'speaker_verification', label: '4. Speaker Biometric Verification', desc: 'Extracting ECAPA-TDNN embeddings & computing cosine similarity' },
  { id: 'acoustic_forensics', label: '5. DSP Acoustic Forensics', desc: 'Measuring F0 contour, jitter, shimmer, HNR & spectral dynamics' },
  { id: 'asr_transcription', label: '6. Speech Recognition (ASR)', desc: 'Transcribing speech & analyzing social-engineering intent' },
  { id: 'multi_signal_risk_fusion', label: '7. Multi-Signal Risk Fusion', desc: 'Dynamic weight renormalization & compounding risk fusion' },
  { id: 'policy_evaluation', label: '8. Declarative Policy Evaluation', desc: 'Zero-Trust rule matching & authoritative verdict derivation' },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function renderAvailability(status: SignalAvailability) {
  switch (status) {
    case 'AVAILABLE':
      return <span className="text-[11px] font-mono text-emerald-400">Available</span>;
    case 'LOW_CONFIDENCE':
      return <span className="text-[11px] font-mono text-amber-400">Low Confidence</span>;
    default:
      return <span className="text-[11px] font-mono text-slate-500">Unavailable</span>;
  }
}

export function AnalyzeView() {
  const [referenceFile, setReferenceFile] = useState<SelectedFileState | null>(null);
  const [suspectedFile, setSuspectedFile] = useState<SelectedFileState | null>(null);
  const [contextMetadata, setContextMetadata] = useState('');
  const [showAdvancedContext, setShowAdvancedContext] = useState(false);

  const [analyzing, setAnalyzing] = useState(false);
  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AudioAnalysisResponse | null>(null);

  const [showTranscript, setShowTranscript] = useState(false);
  const [showForensics, setShowForensics] = useState(false);

  const refInputRef = useRef<HTMLInputElement | null>(null);
  const suspInputRef = useRef<HTMLInputElement | null>(null);

  const [refDragging, setRefDragging] = useState(false);
  const [suspDragging, setSuspDragging] = useState(false);

  const handleFileSelection = (file: File, type: 'ref' | 'susp') => {
    setError(null);
    if (!file) return;

    if (file.size === 0) {
      setError(`File "${file.name}" is empty (0 bytes). Please upload a valid audio recording.`);
      return;
    }

    if (file.size > 30 * 1024 * 1024) {
      setError(`File "${file.name}" exceeds the maximum allowed size of 30MB.`);
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    if (type === 'ref') {
      if (referenceFile?.previewUrl) URL.revokeObjectURL(referenceFile.previewUrl);
      setReferenceFile({ file, previewUrl });
    } else {
      if (suspectedFile?.previewUrl) URL.revokeObjectURL(suspectedFile.previewUrl);
      setSuspectedFile({ file, previewUrl });
    }
  };

  const removeFile = (type: 'ref' | 'susp') => {
    if (type === 'ref') {
      if (referenceFile?.previewUrl) URL.revokeObjectURL(referenceFile.previewUrl);
      setReferenceFile(null);
      if (refInputRef.current) refInputRef.current.value = '';
    } else {
      if (suspectedFile?.previewUrl) URL.revokeObjectURL(suspectedFile.previewUrl);
      setSuspectedFile(null);
      if (suspInputRef.current) suspInputRef.current.value = '';
    }
  };

  const resetAll = () => {
    removeFile('ref');
    removeFile('susp');
    setResult(null);
    setError(null);
    setCurrentStageIdx(0);
    setContextMetadata('');
  };

  const executeAnalysis = async () => {
    if (!referenceFile || !suspectedFile) {
      setError('Both a genuine reference voice recording and a suspected voice recording are required.');
      return;
    }

    if (
      referenceFile.file.name === suspectedFile.file.name &&
      referenceFile.file.size === suspectedFile.file.size &&
      referenceFile.file.lastModified === suspectedFile.file.lastModified
    ) {
      setError('Please provide two distinct audio files for reference and suspected recordings.');
      return;
    }

    setError(null);
    setAnalyzing(true);
    setCurrentStageIdx(0);
    setResult(null);

    // Progressive stage animation timer
    const stageInterval = window.setInterval(() => {
      setCurrentStageIdx((prev) => {
        if (prev < STAGES.length - 1) return prev + 1;
        return prev;
      });
    }, 450);

    try {
      const formData = new FormData();
      formData.append('reference_audio', referenceFile.file, referenceFile.file.name);
      formData.append('suspected_audio', suspectedFile.file, suspectedFile.file.name);
      if (contextMetadata.trim()) {
        formData.append('context_metadata', contextMetadata.trim());
      }

      const response = await api.analyzeAudio(formData);
      clearInterval(stageInterval);
      setCurrentStageIdx(STAGES.length - 1);
      setResult(response);
    } catch (err) {
      clearInterval(stageInterval);
      if (err instanceof ApiError) {
        setError(`Backend Analysis Error (HTTP ${err.status}): ${err.message}`);
      } else if (err instanceof Error) {
        setError(`Network / Execution Error: ${err.message}`);
      } else {
        setError('An unexpected error occurred during audio file analysis.');
      }
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <PageHeader
        title="Voice Forensic Analysis"
        description="Authoritative dual-recording voice analysis. Compare a genuine reference voice sample against a suspected audio recording to evaluate deepfakes, speaker biometrics, acoustic anomalies, and intent."
        badge={
          <span className="flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-950/40 px-3 py-1 text-xs font-mono font-medium text-sky-400">
            <ShieldCheck className="h-3.5 w-3.5 text-sky-400" />
            Authoritative File Engine
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <a
              href={hrefFor('monitor')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-mono text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <Radio className="h-3.5 w-3.5 text-slate-400" />
              Switch to Live Monitor
            </a>
            {result ? (
              <Button size="sm" variant="secondary" onClick={resetAll}>
                <RotateCcw className="h-3.5 w-3.5" />
                New Analysis
              </Button>
            ) : null}
          </div>
        }
      />

      {error ? <ErrorState title="Analysis Failed" body={error} onRetry={() => setError(null)} /> : null}

      {/* Main Upload / Execution Interface (Hidden when completed result is shown unless user wants to re-upload) */}
      {!result ? (
        <div className="space-y-6">
          {/* Dual Upload Columns */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* STEP 1: Reference Audio */}
            <Panel className="flex flex-col justify-between border-slate-800 bg-slate-900/90 shadow-soc-card">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/20 text-sky-400 font-mono text-xs font-bold border border-sky-500/30">
                      1
                    </span>
                    <div>
                      <h2 className="text-sm font-bold text-slate-100">Reference Voice Sample</h2>
                      <p className="text-[11px] text-slate-400">Original / genuine voice recording of target individual</p>
                    </div>
                  </div>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-400 border border-slate-700">
                    Ground Truth
                  </span>
                </div>

                {!referenceFile ? (
                  <div
                    onDragOver={(e: DragEvent<HTMLDivElement>) => {
                      e.preventDefault();
                      setRefDragging(true);
                    }}
                    onDragLeave={() => setRefDragging(false)}
                    onDrop={(e: DragEvent<HTMLDivElement>) => {
                      e.preventDefault();
                      setRefDragging(false);
                      if (e.dataTransfer.files?.[0]) handleFileSelection(e.dataTransfer.files[0], 'ref');
                    }}
                    onClick={() => refInputRef.current?.click()}
                    className={cn(
                      'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200',
                      refDragging
                        ? 'border-sky-400 bg-sky-950/30 shadow-[0_0_20px_rgba(56,189,248,0.2)]'
                        : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/60'
                    )}
                  >
                    <input
                      ref={refInputRef}
                      type="file"
                      accept="audio/*,.wav,.mp3,.flac,.ogg,.m4a"
                      className="hidden"
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        if (e.target.files?.[0]) handleFileSelection(e.target.files[0], 'ref');
                      }}
                    />
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-500/10 text-sky-400 mb-3 border border-sky-500/20">
                      <UploadCloud className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-200">Drag & drop genuine voice file</p>
                    <p className="mt-1 text-xs text-slate-400">or click to browse local storage</p>
                    <p className="mt-3 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                      WAV · MP3 · FLAC · OGG · max 30MB
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/40">
                          <FileAudio className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-slate-100">{referenceFile.file.name}</p>
                          <p className="text-[11px] font-mono text-slate-400">
                            {formatBytes(referenceFile.file.size)} · {referenceFile.file.type || 'audio/wav'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile('ref')}
                        disabled={analyzing}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
                        title="Remove file"
                        aria-label="Remove reference audio file"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="rounded-lg bg-slate-950/60 p-2 border border-slate-800">
                      <audio controls src={referenceFile.previewUrl} className="w-full h-8" />
                    </div>
                  </div>
                )}
              </div>
            </Panel>

            {/* STEP 2: Suspected Audio */}
            <Panel className="flex flex-col justify-between border-slate-800 bg-slate-900/90 shadow-soc-card">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/20 text-rose-400 font-mono text-xs font-bold border border-rose-500/30">
                      2
                    </span>
                    <div>
                      <h2 className="text-sm font-bold text-slate-100">Suspected Voice Recording</h2>
                      <p className="text-[11px] text-slate-400">Intercepted voice recording to inspect for deepfakes & anomalies</p>
                    </div>
                  </div>
                  <span className="rounded bg-rose-950/60 px-2 py-0.5 text-[10px] font-mono text-rose-300 border border-rose-500/30">
                    Subject to Analysis
                  </span>
                </div>

                {!suspectedFile ? (
                  <div
                    onDragOver={(e: DragEvent<HTMLDivElement>) => {
                      e.preventDefault();
                      setSuspDragging(true);
                    }}
                    onDragLeave={() => setSuspDragging(false)}
                    onDrop={(e: DragEvent<HTMLDivElement>) => {
                      e.preventDefault();
                      setSuspDragging(false);
                      if (e.dataTransfer.files?.[0]) handleFileSelection(e.dataTransfer.files[0], 'susp');
                    }}
                    onClick={() => suspInputRef.current?.click()}
                    className={cn(
                      'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200',
                      suspDragging
                        ? 'border-rose-400 bg-rose-950/30 shadow-[0_0_20px_rgba(244,63,94,0.2)]'
                        : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/60'
                    )}
                  >
                    <input
                      ref={suspInputRef}
                      type="file"
                      accept="audio/*,.wav,.mp3,.flac,.ogg,.m4a"
                      className="hidden"
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        if (e.target.files?.[0]) handleFileSelection(e.target.files[0], 'susp');
                      }}
                    />
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-400 mb-3 border border-rose-500/20">
                      <UploadCloud className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-200">Drag & drop suspected recording</p>
                    <p className="mt-1 text-xs text-slate-400">or click to browse local storage</p>
                    <p className="mt-3 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                      WAV · MP3 · FLAC · OGG · max 30MB
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/40">
                          <FileAudio className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-slate-100">{suspectedFile.file.name}</p>
                          <p className="text-[11px] font-mono text-slate-400">
                            {formatBytes(suspectedFile.file.size)} · {suspectedFile.file.type || 'audio/wav'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile('susp')}
                        disabled={analyzing}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
                        title="Remove file"
                        aria-label="Remove suspected audio file"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="rounded-lg bg-slate-950/60 p-2 border border-slate-800">
                      <audio controls src={suspectedFile.previewUrl} className="w-full h-8" />
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          </div>

          {/* Optional Context Controls */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <button
              type="button"
              onClick={() => setShowAdvancedContext(!showAdvancedContext)}
              className="flex w-full items-center justify-between text-xs font-mono text-slate-300 hover:text-white"
            >
              <span className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-sky-400" />
                Optional Channel & Transaction Metadata (JSON)
              </span>
              {showAdvancedContext ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showAdvancedContext ? (
              <div className="mt-3 space-y-2">
                <textarea
                  value={contextMetadata}
                  onChange={(e) => setContextMetadata(e.target.value)}
                  placeholder='e.g. {"transaction_amount": 150000.0, "channel": "sip_trunk", "caller_ani": "+919876543210"}'
                  rows={3}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-500">
                  Transmitted to TrueVoice Context Engine for compound risk weighting.
                </p>
              </div>
            ) : null}
          </div>

          {/* Action Trigger / Loading Progress Bar */}
          <Panel className="border-slate-800 bg-slate-900/90 text-center">
            {!analyzing ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-left">
                  <h3 className="text-sm font-bold text-slate-100">Ready to Analyze</h3>
                  <p className="text-xs text-slate-400">
                    Executes Deepfake Detection, ECAPA-TDNN Verification, Acoustic Forensics, Whisper ASR, and Policy Engine.
                  </p>
                </div>
                <Button
                  size="lg"
                  variant="primary"
                  disabled={!referenceFile || !suspectedFile || analyzing}
                  onClick={executeAnalysis}
                  className="w-full sm:w-auto px-8"
                >
                  <Zap className="h-4 w-4" />
                  Analyze Voice
                </Button>
              </div>
            ) : (
              <div className="space-y-4 py-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-sky-400 font-bold flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-sky-400 animate-ping" />
                    ANALYZING RECORDINGS...
                  </span>
                  <span className="text-slate-400">
                    Stage {currentStageIdx + 1} of {STAGES.length}
                  </span>
                </div>

                {/* Animated Progress Bar */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-950">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-400 transition-all duration-300 shadow-[0_0_12px_rgba(56,189,248,0.5)]"
                    style={{ width: `${((currentStageIdx + 1) / STAGES.length) * 100}%` }}
                  />
                </div>

                {/* Stage Indicator Steps */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-left">
                  {STAGES.map((st, idx) => {
                    const isDone = idx < currentStageIdx;
                    const isCurrent = idx === currentStageIdx;
                    return (
                      <div
                        key={st.id}
                        className={cn(
                          'rounded-lg p-2 border transition-all text-[11px]',
                          isDone
                            ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300'
                            : isCurrent
                            ? 'border-sky-500 bg-sky-950/40 text-sky-200 shadow-[0_0_10px_rgba(56,189,248,0.2)]'
                            : 'border-slate-800/60 bg-slate-950/30 text-slate-500'
                        )}
                      >
                        <div className="flex items-center gap-1.5 font-mono font-semibold">
                          {isDone ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                          ) : isCurrent ? (
                            <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse shrink-0" />
                          ) : (
                            <span className="h-2 w-2 rounded-full bg-slate-600 shrink-0" />
                          )}
                          <span className="truncate">{st.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Panel>
        </div>
      ) : null}

      {/* AUTHORITATIVE RESULT VIEW */}
      {result ? (
        <div className="space-y-6 animate-fadeIn">
          {/* File Metadata & Top Verdict Banner */}
          <Panel className="border-slate-800 bg-slate-900/90 shadow-soc-card">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800 pb-4 mb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-mono font-bold text-emerald-300 border border-emerald-500/40">
                    Analysis Complete
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Latency: {result.total_processing_time_ms} ms · ID: {result.analysis_id.slice(0, 8)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-300 font-mono">
                  <span className="flex items-center gap-1.5 text-sky-300">
                    <FileAudio className="h-3.5 w-3.5" />
                    Reference: {result.reference_audio.filename} ({result.reference_audio.duration_seconds}s)
                  </span>
                  <span className="text-slate-600">vs</span>
                  <span className="flex items-center gap-1.5 text-rose-300">
                    <FileAudio className="h-3.5 w-3.5" />
                    Analyzed: {result.suspected_audio.filename} ({result.suspected_audio.duration_seconds}s)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="secondary" onClick={resetAll}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Analyze Another Recording
                </Button>
              </div>
            </div>

            {/* 4 Prominent Verdict Pillars */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Risk Score */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">
                  Composite Risk Score
                </p>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-3xl font-bold font-mono tracking-tight text-white">
                    {result.risk_score.toFixed(1)}
                  </span>
                  <span className="text-xs font-mono text-slate-500">/ 100</span>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all duration-500',
                      result.risk_score >= 80
                        ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                        : result.risk_score >= 60
                        ? 'bg-orange-500'
                        : result.risk_score >= 30
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    )}
                    style={{ width: `${Math.min(100, Math.max(0, result.risk_score))}%` }}
                  />
                </div>
              </div>

              {/* Risk Tier */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">Risk Tier</p>
                <div className="mt-2">
                  <RiskBadge tier={result.risk_tier} size="lg" />
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  {result.risk_tier === 'CRITICAL' || result.risk_tier === 'HIGH'
                    ? 'Elevated threat severity detected'
                    : result.risk_tier === 'MODERATE'
                    ? 'Cautionary indicators present'
                    : 'Within nominal security parameters'}
                </p>
              </div>

              {/* Trust State */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">
                  Target Trust State
                </p>
                <div className="mt-2">
                  <TrustBadge state={result.trust_state} />
                </div>
                <p className="mt-2 text-[11px] text-slate-400">Zero-Trust state machine decision</p>
              </div>

              {/* Security Action */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">
                  Security Action
                </p>
                <div className="mt-2">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-mono font-bold tracking-wide uppercase border',
                      result.security_action === 'BLOCK'
                        ? 'border-rose-500/50 bg-rose-950/60 text-rose-300'
                        : result.security_action === 'REQUEST_VERIFICATION'
                        ? 'border-sky-500/50 bg-sky-950/60 text-sky-300'
                        : result.security_action === 'RESTRICT'
                        ? 'border-orange-500/50 bg-orange-950/60 text-orange-300'
                        : result.security_action === 'WARN'
                        ? 'border-amber-500/50 bg-amber-950/60 text-amber-300'
                        : 'border-emerald-500/50 bg-emerald-950/60 text-emerald-300'
                    )}
                  >
                    <Shield className="h-3.5 w-3.5" />
                    {result.security_action.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-slate-400 truncate" title={result.action_reason}>
                  {result.action_reason}
                </p>
              </div>
            </div>
          </Panel>

          {/* 5-Branch Signal Breakdown Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* 1. Deepfake Detection */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-soc-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Deepfake Detection</span>
                {renderAvailability(result.signals.deepfake.signal_availability)}
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-bold font-mono text-white">
                    {result.signals.deepfake.score.toFixed(1)}
                  </span>
                  <span className="text-xs font-mono text-slate-500"> / 100</span>
                </div>
                <span
                  className={cn(
                    'rounded px-2 py-0.5 text-xs font-mono font-bold border',
                    result.signals.deepfake.label === 'SYNTHETIC'
                      ? 'border-rose-500/40 bg-rose-950/50 text-rose-300'
                      : 'border-emerald-500/40 bg-emerald-950/50 text-emerald-300'
                  )}
                >
                  {result.signals.deepfake.label}
                </span>
              </div>
              <p className="mt-3 text-[11px] font-mono text-slate-400">
                Model: {result.signals.deepfake.model_name} · Latency: {result.signals.deepfake.inference_time_ms}ms
              </p>
            </div>

            {/* 2. Speaker Biometric Verification */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-soc-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Speaker Verification</span>
                {renderAvailability(result.signals.speaker.signal_availability)}
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-bold font-mono text-white">
                    {result.signals.speaker.similarity !== null
                      ? result.signals.speaker.similarity.toFixed(3)
                      : 'N/A'}
                  </span>
                  <span className="text-xs font-mono text-slate-500"> (Threshold: {result.signals.speaker.threshold.toFixed(2)})</span>
                </div>
                <span
                  className={cn(
                    'rounded px-2 py-0.5 text-xs font-mono font-bold border',
                    result.signals.speaker.is_match
                      ? 'border-emerald-500/40 bg-emerald-950/50 text-emerald-300'
                      : 'border-orange-500/40 bg-orange-950/50 text-orange-300'
                  )}
                >
                  {result.signals.speaker.is_match ? 'MATCH' : 'DIVERGENCE'}
                </span>
              </div>
              <p className="mt-3 text-[11px] font-mono text-slate-400">
                Model: {result.signals.speaker.model_name} · Latency: {result.signals.speaker.inference_time_ms}ms
              </p>
            </div>

            {/* 3. Acoustic Forensics */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-soc-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Acoustic Forensics</span>
                {renderAvailability(result.signals.forensics.signal_availability)}
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-bold font-mono text-white">
                    {result.signals.forensics.score.toFixed(1)}
                  </span>
                  <span className="text-xs font-mono text-slate-500"> / 100</span>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  {result.signals.forensics.anomalies_detected.length} Anomaly Flags
                </span>
              </div>
              <p className="mt-3 text-[11px] font-mono text-slate-400">
                DSP Engine: {result.signals.forensics.model_name} ({result.signals.forensics.model_version})
              </p>
            </div>

            {/* 4. Conversation Intelligence */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-soc-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Conversation Threat</span>
                {renderAvailability(result.signals.conversation.signal_availability)}
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-bold font-mono text-white">
                    {result.signals.conversation.threat_score.toFixed(2)}
                  </span>
                  <span className="text-xs font-mono text-slate-500"> / 1.0</span>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  {result.signals.conversation.detected_intents.length} Threat Intents
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {result.signals.conversation.detected_intents.length > 0 ? (
                  result.signals.conversation.detected_intents.map((flag) => (
                    <span
                      key={flag}
                      className="rounded bg-rose-950/60 px-1.5 py-0.5 text-[10px] font-mono text-rose-300 border border-rose-500/30"
                    >
                      {flag}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] font-mono text-slate-500">No threat keywords flagged</span>
                )}
              </div>
            </div>

            {/* 5. Context Engine */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-soc-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Context Risk</span>
                {renderAvailability(result.signals.context.signal_availability)}
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-bold font-mono text-white">
                    {result.signals.context.score.toFixed(2)}
                  </span>
                  <span className="text-xs font-mono text-slate-500"> / 1.0</span>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  {result.signals.context.risk_factors.length} Risk Factors
                </span>
              </div>
              <p className="mt-3 text-[11px] font-mono text-slate-400 truncate">
                {result.signals.context.risk_factors.length > 0
                  ? result.signals.context.risk_factors.join(', ')
                  : 'Nominal channel and session parameters'}
              </p>
            </div>

            {/* Model & Hardware Provenance Card */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-soc-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Model Provenance</span>
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase border',
                    result.provenance.ml_mode === 'live'
                      ? 'border-emerald-500/40 bg-emerald-950/50 text-emerald-300'
                      : 'border-amber-500/40 bg-amber-950/50 text-amber-300'
                  )}
                >
                  {result.provenance.ml_mode} MODE
                </span>
              </div>
              <div className="mt-3 space-y-1.5 text-xs font-mono text-slate-300">
                <p className="flex justify-between">
                  <span className="text-slate-500">Deepfake:</span>
                  <span className="text-slate-200">{result.provenance.deepfake_model}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-slate-500">Speaker:</span>
                  <span className="text-slate-200">{result.provenance.speaker_model}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-slate-500">ASR:</span>
                  <span className="text-slate-200">{result.provenance.asr_model}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-slate-500">Device:</span>
                  <span className="text-slate-200 uppercase">{result.provenance.ml_device}</span>
                </p>
              </div>
            </div>
          </div>

          {/* "Why This Result?" / Contributing Evidence */}
          <Panel className="border-slate-800 bg-slate-900/90 shadow-soc-card">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
              <ShieldAlert className="h-4 w-4 text-sky-400" />
              <h2 className="text-sm font-bold text-slate-100">Why This Result? — Authoritative Evidence</h2>
            </div>
            {result.evidence && result.evidence.length > 0 ? (
              <ul className="space-y-2">
                {result.evidence.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-200">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-400 shrink-0" />
                    <span className="font-sans leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400">No anomaly triggers recorded by the backend pipeline.</p>
            )}
          </Panel>

          {/* Expandable Section 1: Conversation Transcript */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-soc-card">
            <button
              type="button"
              onClick={() => setShowTranscript(!showTranscript)}
              className="flex w-full items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-sky-400" />
                <h3 className="text-sm font-bold text-slate-100">Speech Recognition & Transcript</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-500">
                  {showTranscript ? 'Hide' : 'Expand'}
                </span>
                {showTranscript ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </div>
            </button>

            {showTranscript ? (
              <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
                <div className="rounded-lg bg-slate-950 p-4 border border-slate-800 font-mono text-xs text-slate-200 leading-relaxed">
                  {result.signals.conversation.transcript ? (
                    `"${result.signals.conversation.transcript}"`
                  ) : (
                    <span className="text-slate-500 italic">Transcript unavailable.</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-slate-400">
                  <span>Language: {result.signals.conversation.language || 'en'}</span>
                  <span>Model: {result.signals.conversation.model_name}</span>
                  {result.signals.conversation.confidence !== null ? (
                    <span>Confidence: {(result.signals.conversation.confidence * 100).toFixed(1)}%</span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          {/* Expandable Section 2: Acoustic Forensics Details */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-soc-card">
            <button
              type="button"
              onClick={() => setShowForensics(!showForensics)}
              className="flex w-full items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-100">Acoustic Forensics & Physical DSP Measurements</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-500">
                  {showForensics ? 'Hide' : 'Expand'}
                </span>
                {showForensics ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </div>
            </button>

            {showForensics ? (
              <div className="mt-4 pt-4 border-t border-slate-800 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs font-mono">
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                    <p className="text-slate-500">Fundamental F0 Mean</p>
                    <p className="text-base font-bold text-slate-100 mt-1">
                      {result.signals.forensics.f0_mean !== null ? `${result.signals.forensics.f0_mean} Hz` : 'N/A'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                    <p className="text-slate-500">Max Pitch Jump</p>
                    <p className="text-base font-bold text-slate-100 mt-1">
                      {result.signals.forensics.f0_std !== null ? `${result.signals.forensics.f0_std} Hz` : 'N/A'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                    <p className="text-slate-500">Local Jitter</p>
                    <p className="text-base font-bold text-slate-100 mt-1">
                      {result.signals.forensics.jitter_local !== null ? result.signals.forensics.jitter_local.toFixed(4) : 'N/A'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                    <p className="text-slate-500">Local Shimmer</p>
                    <p className="text-base font-bold text-slate-100 mt-1">
                      {result.signals.forensics.shimmer_local !== null ? result.signals.forensics.shimmer_local.toFixed(4) : 'N/A'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                    <p className="text-slate-500">Harmonics-to-Noise (HNR)</p>
                    <p className="text-base font-bold text-slate-100 mt-1">
                      {result.signals.forensics.hnr_db !== null ? `${result.signals.forensics.hnr_db} dB` : 'N/A'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                    <p className="text-slate-500">Spectral Centroid</p>
                    <p className="text-base font-bold text-slate-100 mt-1">
                      {result.signals.forensics.spectral_centroid_mean !== null ? `${result.signals.forensics.spectral_centroid_mean} Hz` : 'N/A'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                    <p className="text-slate-500">Spectral Rolloff</p>
                    <p className="text-base font-bold text-slate-100 mt-1">
                      {result.signals.forensics.spectral_rolloff_mean !== null ? `${result.signals.forensics.spectral_rolloff_mean} Hz` : 'N/A'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                    <p className="text-slate-500">RMS Energy</p>
                    <p className="text-base font-bold text-slate-100 mt-1">
                      {result.signals.forensics.rms_energy_mean !== null ? result.signals.forensics.rms_energy_mean.toFixed(4) : 'N/A'}
                    </p>
                  </div>
                </div>

                {result.signals.forensics.anomalies_detected.length > 0 ? (
                  <div className="rounded-lg bg-amber-950/20 border border-amber-500/30 p-3">
                    <p className="text-xs font-semibold text-amber-300 mb-2">Detected Physical Anomaly Indicators:</p>
                    <ul className="space-y-1 text-xs text-amber-200">
                      {result.signals.forensics.anomalies_detected.map((anom, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                          <span>{anom}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default AnalyzeView;
