import { PageHeader, Panel } from '../components/ui/primitives';
import { hrefFor } from '../lib/routing';
import { Cpu, Zap } from 'lucide-react';

export function HelpView() {
  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="SOC Operator Guide & Architecture"
        description="Operational guide for Smart India Hackathon jury review and enterprise voice security analysts."
        badge={
          <span className="rounded-full border border-sky-500/30 bg-sky-950/40 px-3 py-1 font-mono text-xs text-sky-400">
            TrueVoice Architecture Manual
          </span>
        }
      />

      <Panel className="space-y-4 leading-relaxed">
        <h2 className="text-lg font-bold text-slate-100 font-sans">Core Purpose & Value Proposition</h2>
        <p className="text-sm text-slate-300">
          TrueVoice is an enterprise-grade <strong>Real-Time Voice Security & Trust Platform</strong> designed to
          protect call centers, high-value financial transactions, and secure voice channels against AI-generated
          deepfakes, voice clones, and social engineering attacks.
        </p>
        <p className="text-sm text-slate-400">
          Unlike post-call forensic tools, TrueVoice operates in real time during live voice interactions. It continuously
          evaluates acoustic frames, checks claimed speaker biometrics against enrolled voiceprints, monitors conversational
          threats, and deterministically drives an authoritative <strong>Trust State Machine</strong>.
        </p>
      </Panel>

      <div className="grid gap-6 md:grid-cols-2">
        <Panel className="space-y-3">
          <div className="flex items-center gap-2 text-sky-400 font-mono text-xs font-bold uppercase">
            <Zap className="h-4 w-4" />
            <span>Operational User Journey</span>
          </div>
          <ol className="list-decimal space-y-2 pl-4 text-xs font-mono text-slate-300">
            <li>
              <a className="text-sky-400 hover:underline font-bold" href={hrefFor('overview')}>
                Overview Dashboard
              </a>{' '}
              — Monitor platform health, active streams, and queued incidents.
            </li>
            <li>
              <a className="text-sky-400 hover:underline font-bold" href={hrefFor('monitor')}>
                Live Voice Monitor
              </a>{' '}
              — Flagship screen streaming 16kHz PCM audio with live composite risk score.
            </li>
            <li>
              <a className="text-sky-400 hover:underline font-bold" href={hrefFor('sessions')}>
                Sessions & Incidents
              </a>{' '}
              — Search, filter, and inspect historical call investigations.
            </li>
            <li>
              <a className="text-sky-400 hover:underline font-bold" href={hrefFor('verification')}>
                OOB Verification
              </a>{' '}
              — Dispatch cryptographic nonce challenges to restore trust when elevated risk is detected.
            </li>
            <li>
              <a className="text-sky-400 hover:underline font-bold" href={hrefFor('audit')}>
                Cryptographic Audit Ledger
              </a>{' '}
              — Verify immutable SHA-256 event hash chains for forensic legal compliance.
            </li>
          </ol>
        </Panel>

        <Panel className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold uppercase">
            <Cpu className="h-4 w-4" />
            <span>AI Signal Weights & Models</span>
          </div>
          <ul className="space-y-2 text-xs font-mono text-slate-300">
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold">1.</span>
              <div>
                <strong className="text-white">RawNet2 / Wav2Vec2:</strong> Evaluates spectral anomalies, phase incoherence, and synthetic artifact likelihood.
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold">2.</span>
              <div>
                <strong className="text-white">ECAPA-TDNN:</strong> Extracts 192-d speaker embeddings and measures cosine similarity against authorized voiceprints.
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold">3.</span>
              <div>
                <strong className="text-white">DSP Spectral Flux:</strong> Analyzes background acoustic continuity, room impulse response, and unnatural silence.
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold">4.</span>
              <div>
                <strong className="text-white">Whisper + NLP Threats:</strong> Transcribes speech live to detect social-engineering patterns (MFA theft, wire requests).
              </div>
            </li>
          </ul>
        </Panel>
      </div>

      <Panel className="space-y-2 border-slate-800 bg-slate-900/60 font-mono text-xs text-slate-400">
        <p className="text-slate-200 font-bold uppercase text-[11px] tracking-wider">
          Enterprise Data & Integrity Rule:
        </p>
        <p>
          All risk scores, trust states, signal availabilities, and verification results originate exclusively from the
          TrueVoice backend REST and WebSocket APIs. Signals that are not available (e.g. unenrolled speaker) are rendered
          explicitly as <strong className="text-slate-200">Unavailable</strong> — never faked or converted to zero.
        </p>
      </Panel>
    </div>
  );
}
