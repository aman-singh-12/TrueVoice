import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { PolicyResponse, SpeakerResponse } from '../types/api';
import { Button, ErrorState, PageHeader, Panel, SectionTitle, Skeleton } from '../components/ui/primitives';
import { formatTimestamp } from '../lib/format';
import {
  CheckCircle2,
  Save,
  Shield,
  Upload,
} from 'lucide-react';

export function SettingsView() {
  const [policy, setPolicy] = useState<PolicyResponse | null>(null);
  const [speakers, setSpeakers] = useState<SpeakerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);
  const [form, setForm] = useState({
    policy_name: 'Default Enterprise Policy',
    caution_threshold: 35,
    verify_threshold: 65,
    block_threshold: 85,
    enforce_transaction_lock: true,
  });
  const [enrollName, setEnrollName] = useState('');
  const [enrollTitle, setEnrollTitle] = useState('');
  const [enrollFile, setEnrollFile] = useState<File | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [p, s] = await Promise.all([api.getActivePolicy(), api.listSpeakers()]);
      setPolicy(p);
      setSpeakers(s);
      if (p) {
        setForm({
          policy_name: p.policy_name,
          caution_threshold: p.caution_threshold,
          verify_threshold: p.verify_threshold,
          block_threshold: p.block_threshold,
          enforce_transaction_lock: p.enforce_transaction_lock ?? true,
        });
      }
    } catch (err) {
      setError((err as Error).message || 'Unable to load settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const savePolicy = async () => {
    try {
      setSaveMsg(null);
      const saved = await api.createOrUpdatePolicy({
        ...form,
        version: policy?.version || '1.0.0',
      });
      setPolicy(saved);
      setSaveMsg({ text: 'Policy thresholds successfully updated on backend.', type: 'ok' });
    } catch (err) {
      setSaveMsg({ text: (err as Error).message, type: 'err' });
    }
  };

  const enroll = async () => {
    if (!enrollFile || !enrollName.trim()) {
      setSaveMsg({ text: 'Speaker display name and an enrollment audio file are required.', type: 'err' });
      return;
    }
    try {
      setIsEnrolling(true);
      setSaveMsg(null);
      const data = new FormData();
      data.append('display_name', enrollName.trim());
      data.append('designation', enrollTitle.trim() || 'Authorized Analyst');
      data.append('audio_files', enrollFile, enrollFile.name);
      await api.enrollSpeaker(data);
      setEnrollName('');
      setEnrollTitle('');
      setEnrollFile(null);
      setSaveMsg({ text: `Voiceprint for "${enrollName.trim()}" enrolled into ECAPA-TDNN vault.`, type: 'ok' });
      const s = await api.listSpeakers();
      setSpeakers(s);
    } catch (err) {
      setSaveMsg({ text: (err as Error).message, type: 'err' });
    } finally {
      setIsEnrolling(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security Policy & Biometrics Vault"
        description="Configure dynamic risk decision thresholds and manage authorized speaker voiceprints for ECAPA-TDNN biometric verification."
        badge={
          <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 font-mono text-xs text-slate-300">
            Defense Engine Configuration
          </span>
        }
      />

      {saveMsg ? (
        <div
          className={`flex items-center gap-2.5 rounded-xl border p-3.5 text-xs font-mono animate-fadeIn ${
            saveMsg.type === 'ok'
              ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200'
              : 'border-rose-500/40 bg-rose-950/40 text-rose-200'
          }`}
        >
          {saveMsg.type === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
          <span>{saveMsg.text}</span>
        </div>
      ) : null}

      {error ? <ErrorState title="Unable to retrieve policy configuration" body={error} onRetry={load} /> : null}
      {loading ? <Skeleton className="h-72 w-full" /> : null}

      {!loading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Policy Threshold Engine */}
          <div className="space-y-4">
            <SectionTitle
              title="Risk Engine Policy"
              description="Calibrated numerical score boundaries triggering automated defense states."
            />
            <Panel className="space-y-5">
              <div>
                <label htmlFor="policy-name" className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">
                  Policy Name
                </label>
                <input
                  id="policy-name"
                  className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 font-mono focus:border-sky-500 focus:outline-none"
                  value={form.policy_name}
                  onChange={(e) => setForm({ ...form, policy_name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="caution-threshold" className="block text-xs font-mono text-amber-400 uppercase mb-1">
                    Caution (≥)
                  </label>
                  <input
                    id="caution-threshold"
                    type="number"
                    className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 font-mono text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                    value={form.caution_threshold}
                    onChange={(e) => setForm({ ...form, caution_threshold: Number(e.target.value) })}
                  />
                  <span className="text-[10px] font-mono text-slate-400 mt-1 block">Advisory trigger</span>
                </div>

                <div>
                  <label htmlFor="verify-threshold" className="block text-xs font-mono text-orange-400 uppercase mb-1">
                    Verify (≥)
                  </label>
                  <input
                    id="verify-threshold"
                    type="number"
                    className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 font-mono text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                    value={form.verify_threshold}
                    onChange={(e) => setForm({ ...form, verify_threshold: Number(e.target.value) })}
                  />
                  <span className="text-[10px] font-mono text-slate-400 mt-1 block">OOB challenge</span>
                </div>

                <div>
                  <label htmlFor="block-threshold" className="block text-xs font-mono text-rose-400 uppercase mb-1">
                    Block (≥)
                  </label>
                  <input
                    id="block-threshold"
                    type="number"
                    className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 font-mono text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                    value={form.block_threshold}
                    onChange={(e) => setForm({ ...form, block_threshold: Number(e.target.value) })}
                  />
                  <span className="text-[10px] font-mono text-slate-400 mt-1 block">Session lock</span>
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-200 block">Enforce Transaction Lockdown</span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Restrict financial & administrative operations when risk exceeds verify threshold.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={form.enforce_transaction_lock}
                  onChange={(e) => setForm({ ...form, enforce_transaction_lock: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-sky-600 focus:ring-sky-500"
                />
              </div>

              <Button variant="primary" className="w-full gap-1.5" onClick={() => void savePolicy()}>
                <Save className="h-4 w-4" />
                Save Policy Configuration
              </Button>
            </Panel>
          </div>

          {/* Voiceprint Biometrics Vault */}
          <div className="space-y-4">
            <SectionTitle
              title="Voice Biometrics Vault"
              description="Enrolled acoustic profiles used by ECAPA-TDNN for speaker identity verification."
            />

            {/* Enrolled Speakers List */}
            <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-soc-card">
              <div className="border-b border-slate-800 bg-slate-950 px-4 py-2.5 text-xs font-mono text-slate-400 uppercase">
                Enrolled Personas ({speakers.length})
              </div>
              {speakers.length === 0 ? (
                <p className="p-4 text-xs font-mono text-slate-400 text-center">
                  No voiceprints enrolled. Enroll a speaker below.
                </p>
              ) : (
                <ul className="divide-y divide-slate-800/80 max-h-48 overflow-y-auto">
                  {speakers.map((sp) => (
                    <li key={sp.id} className="flex items-center justify-between px-4 py-2.5 text-xs">
                      <div>
                        <p className="font-bold text-slate-200">{sp.display_name}</p>
                        <p className="font-mono text-[10px] text-slate-400">{sp.designation}</p>
                      </div>
                      <div className="text-right font-mono">
                        <span className="inline-flex items-center gap-1 text-emerald-400 text-[10px]">
                          <CheckCircle2 className="h-3 w-3" />
                          {sp.has_enrolled_voiceprint ? 'Enrolled Profile' : 'Pending Samples'}
                        </span>
                        <span className="block text-[9px] text-slate-400">{formatTimestamp(sp.created_at)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Speaker Enrollment Form */}
            <Panel className="space-y-3">
              <span className="text-xs font-bold font-mono uppercase tracking-wide text-slate-200 block">
                Enroll New Speaker Voiceprint
              </span>

              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="Full Name (e.g. John Doe)"
                  className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-slate-100 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
                  value={enrollName}
                  onChange={(e) => setEnrollName(e.target.value)}
                />
                <input
                  placeholder="Designation (e.g. Treasury Ops)"
                  className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-slate-100 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
                  value={enrollTitle}
                  onChange={(e) => setEnrollTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  Upload Clean Audio Sample (WAV/FLAC/MP3):
                </label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setEnrollFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-sky-300 hover:file:bg-slate-700"
                />
              </div>

              <Button
                variant="secondary"
                className="w-full gap-1.5 font-mono text-xs"
                disabled={isEnrolling || !enrollName.trim() || !enrollFile}
                onClick={() => void enroll()}
              >
                <Upload className="h-3.5 w-3.5" />
                {isEnrolling ? 'Extracting ECAPA-TDNN Embedding…' : 'Enroll Biometric Voiceprint'}
              </Button>
            </Panel>
          </div>
        </div>
      ) : null}
    </div>
  );
}
