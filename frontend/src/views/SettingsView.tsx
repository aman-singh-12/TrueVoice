import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { PolicyResponse, SpeakerResponse } from '../types/api';
import { Button, EmptyState, ErrorState, PageHeader, Panel, SectionTitle, Skeleton } from '../components/ui/primitives';
import { formatTimestamp } from '../lib/format';

export function SettingsView() {
  const [policy, setPolicy] = useState<PolicyResponse | null>(null);
  const [speakers, setSpeakers] = useState<SpeakerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    policy_name: 'Default policy',
    caution_threshold: 35,
    verify_threshold: 65,
    block_threshold: 85,
    enforce_transaction_lock: true,
  });
  const [enrollName, setEnrollName] = useState('');
  const [enrollTitle, setEnrollTitle] = useState('');
  const [enrollFile, setEnrollFile] = useState<File | null>(null);

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
      setSaveMsg('Policy saved.');
    } catch (err) {
      setSaveMsg((err as Error).message);
    }
  };

  const enroll = async () => {
    if (!enrollFile || !enrollName.trim()) {
      setSaveMsg('Display name and an enrollment audio file are required.');
      return;
    }
    try {
      const data = new FormData();
      data.append('display_name', enrollName.trim());
      data.append('designation', enrollTitle.trim() || 'Analyst');
      data.append('audio_files', enrollFile, enrollFile.name);
      await api.enrollSpeaker(data);
      setEnrollName('');
      setEnrollTitle('');
      setEnrollFile(null);
      setSaveMsg('Speaker enrolled.');
      const s = await api.listSpeakers();
      setSpeakers(s);
    } catch (err) {
      setSaveMsg((err as Error).message);
    }
  };

  return (
    <div>
      <PageHeader title="Settings" description="Policy thresholds and enrolled voiceprints from the backend." />
      {saveMsg ? <p className="mb-4 text-sm text-mute">{saveMsg}</p> : null}
      {error ? <ErrorState title="Unable to load settings" body={error} onRetry={load} /> : null}
      {loading ? <Skeleton className="h-48 w-full" /> : null}

      {!loading ? (
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <SectionTitle title="Policy" />
            <Panel className="space-y-3">
              <Field label="Name">
                <input
                  className="h-9 w-full rounded-md border border-line px-3 text-sm"
                  value={form.policy_name}
                  onChange={(e) => setForm({ ...form, policy_name: e.target.value })}
                />
              </Field>
              <Field label="Caution threshold">
                <input
                  type="number"
                  className="h-9 w-full rounded-md border border-line px-3 text-sm"
                  value={form.caution_threshold}
                  onChange={(e) => setForm({ ...form, caution_threshold: Number(e.target.value) })}
                />
              </Field>
              <Field label="Verify threshold">
                <input
                  type="number"
                  className="h-9 w-full rounded-md border border-line px-3 text-sm"
                  value={form.verify_threshold}
                  onChange={(e) => setForm({ ...form, verify_threshold: Number(e.target.value) })}
                />
              </Field>
              <Field label="Block threshold">
                <input
                  type="number"
                  className="h-9 w-full rounded-md border border-line px-3 text-sm"
                  value={form.block_threshold}
                  onChange={(e) => setForm({ ...form, block_threshold: Number(e.target.value) })}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.enforce_transaction_lock}
                  onChange={(e) => setForm({ ...form, enforce_transaction_lock: e.target.checked })}
                />
                Enforce transaction lock
              </label>
              <Button variant="primary" onClick={() => void savePolicy()}>
                Save policy
              </Button>
            </Panel>
          </div>

          <div>
            <SectionTitle title="Voiceprints" />
            {speakers.length === 0 ? (
              <EmptyState title="No enrolled speakers" body="Enroll a speaker with a real audio sample." />
            ) : (
              <ul className="mb-4 rounded-lg border border-line bg-white">
                {speakers.map((sp) => (
                  <li key={sp.id} className="flex items-center justify-between border-b border-line px-4 py-3 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{sp.display_name}</p>
                      <p className="text-xs text-mute">{sp.designation}</p>
                    </div>
                    <span className="text-xs text-mute">
                      {sp.has_enrolled_voiceprint ? 'Enrolled' : 'No voiceprint'} · {formatTimestamp(sp.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Panel className="space-y-3">
              <p className="text-sm font-medium">Enroll speaker</p>
              <input
                placeholder="Display name"
                className="h-9 w-full rounded-md border border-line px-3 text-sm"
                value={enrollName}
                onChange={(e) => setEnrollName(e.target.value)}
              />
              <input
                placeholder="Designation"
                className="h-9 w-full rounded-md border border-line px-3 text-sm"
                value={enrollTitle}
                onChange={(e) => setEnrollTitle(e.target.value)}
              />
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => setEnrollFile(e.target.files?.[0] || null)}
              />
              <Button onClick={() => void enroll()}>Enroll</Button>
            </Panel>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-mute">{label}</span>
      {children}
    </label>
  );
}
