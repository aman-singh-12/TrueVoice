import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const OUTPUT_DIR = path.resolve('true voice prototype');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function findBrowserPath() {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('No compatible Chrome or Edge browser executable found on system.');
}

const MOCK_POLICY = {
  id: 'pol-production-v1',
  org_id: 'org-soc-truevoice',
  name: 'Global Enterprise Zero-Trust Defense Policy',
  description: 'Strict multi-engine synthetic speech detection and biometric verification policy.',
  caution_threshold: 30.0,
  verify_threshold: 60.0,
  block_threshold: 80.0,
  weight_deepfake: 0.35,
  weight_speaker: 0.25,
  weight_conversation: 0.15,
  weight_context: 0.15,
  weight_forensic: 0.10,
  gamma_multiplier: 1.35,
  ema_attack_alpha: 0.60,
  ema_decay_alpha: 0.20,
  sensitive_amount_threshold: 250000.0,
  is_active: true,
  created_at: '2026-09-15T08:00:00Z',
  updated_at: '2026-10-01T14:30:00Z',
};

const MOCK_SESSIONS = [
  {
    id: 'sess-deepfake-9842',
    org_id: 'org-soc-truevoice',
    caller_id: '+1 (555) 019-4821 [Claimed: CFO Robert Sterling]',
    recipient_id: '+1 (555) 830-2210 [Treasury Desk]',
    claimed_speaker_id: 'spk-cfo-robert-sterling',
    current_state: 'BLOCKED',
    current_risk_tier: 'CRITICAL',
    peak_risk_score: 94.8,
    final_disposition: 'BLOCKED_BY_POLICY',
    created_at: new Date(Date.now() - 12 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 60000).toISOString(),
  },
  {
    id: 'sess-susp-7712',
    org_id: 'org-soc-truevoice',
    caller_id: '+44 20 7946 0912 [Vendor Wire Support]',
    recipient_id: '+1 (555) 441-9988 [Accounts Payable]',
    claimed_speaker_id: 'spk-vendor-meridian',
    current_state: 'IN_CHALLENGE',
    current_risk_tier: 'HIGH',
    peak_risk_score: 76.4,
    final_disposition: 'PENDING_VERIFICATION',
    created_at: new Date(Date.now() - 24 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 60000).toISOString(),
  },
  {
    id: 'sess-caution-6401',
    org_id: 'org-soc-truevoice',
    caller_id: '+1 (555) 782-3104 [IT Support Desk]',
    recipient_id: '+1 (555) 129-8800 [Executive Assistant]',
    claimed_speaker_id: 'spk-it-alex-chen',
    current_state: 'MONITORING',
    current_risk_tier: 'MEDIUM',
    peak_risk_score: 44.1,
    final_disposition: null,
    created_at: new Date(Date.now() - 48 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 10 * 60000).toISOString(),
  },
  {
    id: 'sess-benign-1092',
    org_id: 'org-soc-truevoice',
    caller_id: '+1 (555) 234-5678 [VP Product Sarah Jenkins]',
    recipient_id: '+1 (555) 890-1122 [Internal All-Hands]',
    claimed_speaker_id: 'spk-sarah-jenkins',
    current_state: 'VERIFIED',
    current_risk_tier: 'LOW',
    peak_risk_score: 8.2,
    final_disposition: 'CLEARED_BENIGN',
    created_at: new Date(Date.now() - 75 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 40 * 60000).toISOString(),
  },
  {
    id: 'sess-benign-2144',
    org_id: 'org-soc-truevoice',
    caller_id: '+1 (555) 912-3456 [Customer Relations Lead]',
    recipient_id: '+1 (555) 654-3210 [Support Center]',
    claimed_speaker_id: 'spk-marcus-vance',
    current_state: 'VERIFIED',
    current_risk_tier: 'LOW',
    peak_risk_score: 11.5,
    final_disposition: 'CLEARED_BENIGN',
    created_at: new Date(Date.now() - 120 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 90 * 60000).toISOString(),
  }
];

const MOCK_SESSION_DETAIL = {
  id: 'sess-deepfake-9842',
  org_id: 'org-soc-truevoice',
  caller_id: '+1 (555) 019-4821 [Claimed: CFO Robert Sterling]',
  recipient_id: '+1 (555) 830-2210 [Treasury Desk]',
  claimed_speaker_id: 'spk-cfo-robert-sterling',
  current_state: 'BLOCKED',
  current_risk_tier: 'CRITICAL',
  peak_risk_score: 94.8,
  final_disposition: 'BLOCKED_BY_POLICY',
  created_at: new Date(Date.now() - 12 * 60000).toISOString(),
  updated_at: new Date(Date.now() - 2 * 60000).toISOString(),
  chunks_evaluated: 24,
  duration_seconds: 48.5,
  is_incident: true,
};

const MOCK_RISK_LATEST = {
  id: 'risk-eval-9842-24',
  session_id: 'sess-deepfake-9842',
  chunk_index: 24,
  timestamp: new Date(Date.now() - 2 * 60000).toISOString(),
  composite_score: 94.8,
  risk_tier: 'CRITICAL',
  state_transition: 'BLOCKED',
  synthetic_prob: 0.965,
  speaker_similarity: 0.284,
  forensic_score: 0.892,
  conversational_score: 0.815,
  evidence_provenance: {
    synthetic_artifacts: {
      model: 'Wav2Vec2-XLSR-Deepfake-V2',
      confidence: 0.98,
      latency_ms: 22.4,
      signal_availability: 'AVAILABLE',
      anomalies: ['Unnatural spectral phase discontinuities in 2-4kHz band', 'Robotic formant trajectory flattening']
    },
    speaker_verification: {
      model: 'ECAPA-TDNN-VoxCeleb',
      cosine_similarity: 0.284,
      threshold: 0.75,
      enrolled_speaker: 'Robert Sterling (CFO)',
      signal_availability: 'AVAILABLE'
    },
    forensic_dsp: {
      pitch_jitter: 0.0004,
      amplitude_shimmer: 0.0032,
      harmonic_to_noise_db: 38.4,
      f0_step_discontinuity_hz: 112.5,
      signal_availability: 'AVAILABLE'
    },
    conversational_threat: {
      nlp_intent: 'URGENT_WIRE_TRANSFER_AUTHORIZATION',
      urgency_level: 'HIGH',
      social_engineering_score: 0.815,
      target_amount: '$1,450,000 USD',
      signal_availability: 'AVAILABLE'
    },
    context_sensitivity: {
      caller_origin: 'VOIP_SPOOFED_GATEWAY (M247 Europe)',
      account_sensitivity_tier: 'TIER_1_EXECUTIVE_WIRE',
      signal_availability: 'AVAILABLE'
    }
  }
};

const MOCK_TIMELINE = Array.from({ length: 14 }).map((_, i) => {
  const progress = (i + 1) / 14;
  const score = i < 3 ? 14 + i * 5 : i < 7 ? 35 + i * 4 : 65 + Math.min(30, Math.pow(i - 6, 1.4) * 4);
  return {
    id: `risk-eval-9842-${i + 1}`,
    session_id: 'sess-deepfake-9842',
    chunk_index: i + 1,
    timestamp: new Date(Date.now() - (14 - i) * 30000).toISOString(),
    composite_score: Math.min(94.8, Math.round(score * 10) / 10),
    risk_tier: score > 80 ? 'CRITICAL' : score > 60 ? 'HIGH' : score > 30 ? 'MEDIUM' : 'LOW',
    state_transition: score > 80 ? 'BLOCKED' : score > 60 ? 'IN_CHALLENGE' : 'MONITORING',
    synthetic_prob: Math.min(0.965, 0.15 + progress * 0.82),
    speaker_similarity: Math.max(0.28, 0.65 - progress * 0.37),
    forensic_score: Math.min(0.89, 0.10 + progress * 0.79),
    conversational_score: Math.min(0.82, 0.05 + progress * 0.77),
    evidence_provenance: MOCK_RISK_LATEST.evidence_provenance,
  };
});

const MOCK_AUDIT_LOGS = [
  {
    id: 'log-001',
    session_id: 'sess-deepfake-9842',
    event_type: 'SESSION_CREATED',
    sequence_number: 1,
    current_hash: '0xa41fb9c2830e018d45f9e2b10a48b309e1d827fc30419e72810a9c8e192f4410',
    previous_hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    payload: { caller: '+1 (555) 019-4821', claimed: 'CFO Robert Sterling', ip: '198.51.100.24' },
    created_at: new Date(Date.now() - 12 * 60000).toISOString(),
  },
  {
    id: 'log-002',
    session_id: 'sess-deepfake-9842',
    event_type: 'ANALYSIS_CHUNK_EVALUATED',
    sequence_number: 2,
    current_hash: '0xb78e120f92419ec93810fbc281048b309e1d827fc30419e72810a9c8e192fab1',
    previous_hash: '0xa41fb9c2830e018d45f9e2b10a48b309e1d827fc30419e72810a9c8e192f4410',
    payload: { chunk_index: 8, synthetic_prob: 0.62, risk_score: 58.4, dsp_anomalies: 2 },
    created_at: new Date(Date.now() - 8 * 60000).toISOString(),
  },
  {
    id: 'log-003',
    session_id: 'sess-deepfake-9842',
    event_type: 'STATE_TRANSITION',
    sequence_number: 3,
    current_hash: '0xc920da1e410f92419ec93810fbc281048b309e1d827fc30419e72810a9c8e390',
    previous_hash: '0xb78e120f92419ec93810fbc281048b309e1d827fc30419e72810a9c8e192fab1',
    payload: { from: 'MONITORING', to: 'IN_CHALLENGE', reason: 'High synthetic speech likelihood (>60%)' },
    created_at: new Date(Date.now() - 6 * 60000).toISOString(),
  },
  {
    id: 'log-004',
    session_id: 'sess-deepfake-9842',
    event_type: 'CHALLENGE_DISPATCHED',
    sequence_number: 4,
    current_hash: '0xd048bc309e1d827fc30419e72810a9c8e192fab1a41fb9c2830e018d45f9e2b1',
    previous_hash: '0xc920da1e410f92419ec93810fbc281048b309e1d827fc30419e72810a9c8e390',
    payload: { method: 'OOB_PUSH_CRYPTOGRAPHIC_NONCE', target_device: 'Secured iPhone 15 Pro (Sterling)', ttl_sec: 30 },
    created_at: new Date(Date.now() - 5 * 60000).toISOString(),
  },
  {
    id: 'log-005',
    session_id: 'sess-deepfake-9842',
    event_type: 'POLICY_ENFORCED',
    sequence_number: 5,
    current_hash: '0xe5729ab810a9c8e192fab1a41fb9c2830e018d45f9e2b10a48b309e1d827fc30',
    previous_hash: '0xd048bc309e1d827fc30419e72810a9c8e192fab1a41fb9c2830e018d45f9e2b1',
    payload: { rule: 'CRITICAL_RISK_AUTO_TERMINATION', action: 'TERMINATE_CALL_AND_ALERT_SOC', composite_risk: 94.8 },
    created_at: new Date(Date.now() - 2 * 60000).toISOString(),
  }
];

const MOCK_SPEAKERS = [
  { id: 'spk-cfo-robert-sterling', name: 'Robert Sterling', department: 'Executive / C-Suite', enrolled_at: '2026-01-10' },
  { id: 'spk-vendor-meridian', name: 'Meridian Vendor Finance', department: 'External Treasury', enrolled_at: '2026-02-14' },
  { id: 'spk-sarah-jenkins', name: 'Sarah Jenkins', department: 'VP Product', enrolled_at: '2026-03-01' },
];

const MOCK_AUDIO_ANALYSIS_RESPONSE = {
  analysis_id: "ana-2026-9842-forensic",
  status: "COMPLETED",
  created_at: new Date().toISOString(),
  reference_audio: {
    filename: "cfo_enrolled_reference_16k.wav",
    size_bytes: 480000,
    duration_seconds: 15.0,
    sample_rate: 16000,
    channels: 1,
    format: "WAV / PCM 16-bit Mono",
  },
  suspected_audio: {
    filename: "incoming_wire_transfer_call_intercept.wav",
    size_bytes: 320000,
    duration_seconds: 10.0,
    sample_rate: 16000,
    channels: 1,
    format: "WAV / PCM 16-bit Mono",
  },
  risk_score: 93.4,
  risk_tier: "CRITICAL",
  trust_state: "BLOCKED",
  security_action: "TERMINATE_CALL",
  action_reason: "Critical composite threat detected: High probability neural synthetic clone voice (96.5%) with biometric mismatch and high-urgency wire diversion intent.",
  rule_matched: "POLICY_RULE_01_ZERO_TRUST_BLOCK",
  primary_factors: [
    "Wav2Vec2 Neural Synthetic Artifacts (96.5% probability)",
    "ECAPA-TDNN Speaker Mismatch (0.28 vs 0.75 threshold)",
    "DSP Pitch Jitter & Harmonic Inversion Anomaly",
    "High-Urgency Social Engineering Language Detected"
  ],
  evidence: [
    "Neural vocoder artifacts identified in 1.8kHz - 3.4kHz formant resonance transitions",
    "Phase-coherence discontinuities detected at frame offsets 14-22",
    "Speaker biometric distance confirms caller is NOT the enrolled CFO",
    "ASR transcript reveals pressure tactics demanding unauthorized international wire transfer"
  ],
  signals: {
    deepfake: {
      score: 0.965,
      label: "SYNTHETIC_DEEPFAKE_VOICE",
      confidence: 0.982,
      signal_availability: "AVAILABLE",
      model_name: "Wav2Vec2-XLSR-Deepfake",
      model_version: "2.1.0-production",
      inference_time_ms: 18.4,
    },
    speaker: {
      similarity: 0.284,
      threshold: 0.75,
      is_match: false,
      confidence: 0.941,
      signal_availability: "AVAILABLE",
      model_name: "ECAPA-TDNN",
      model_version: "1.4.0-voxceleb",
      inference_time_ms: 24.1,
    },
    forensics: {
      score: 0.892,
      signal_availability: "AVAILABLE",
      f0_mean: 142.6,
      f0_std: 12.3,
      jitter_local: 0.00021,
      shimmer_local: 0.0019,
      hnr_db: 39.4,
      spectral_centroid_mean: 2450.2,
      spectral_rolloff_mean: 4890.1,
      spectral_flux_mean: 0.124,
      rms_energy_mean: 0.048,
      anomalies_detected: [
        "Jitter 0.00021 is unnaturally low (< 0.002 natural human vocal baseline)",
        "Shimmer 0.0019 shows zero human involuntary micro-tremor",
        "Harmonic-to-Noise Ratio 39.4 dB exceeds studio microphone ceiling (vocoder artifact)"
      ],
      evidence: [
        "Robotic pitch tracking discontinuity at 2.41s timestamp",
        "Overly flattened spectral tilt in higher frequency bins"
      ],
      model_name: "DSP-Forensic-Acoustic-Analyzer",
      model_version: "3.0.1",
    },
    conversation: {
      threat_score: 0.815,
      detected_intents: [
        "URGENT_WIRE_TRANSFER_REQUEST",
        "OUT_OF_CHANNEL_BYPASS_AUTHORITY",
        "HIGH_PRESSURE_TIMELIMIT"
      ],
      transcript: "This is Robert Sterling from executive finance. We have an urgent offshore wire transfer requirement of $1,450,000 that needs immediate execution before market close. Please bypass the standard callback protocol and execute right now.",
      language: "en",
      confidence: 0.978,
      signal_availability: "AVAILABLE",
      model_name: "Faster-Whisper-Small + Threat-NLP",
      model_version: "1.2.0",
    },
    context: {
      score: 0.85,
      signal_availability: "AVAILABLE",
      risk_factors: [
        "Caller originating from unregistered overseas VoIP provider",
        "Target account sensitivity: Tier-1 Treasury Wire Portal",
        "Transaction amount ($1.45M) exceeds standard threshold ($250K)"
      ],
      features: {
        amount_usd: 1450000,
        gateway_reputation: "HIGH_RISK_PROXY",
        device_fingerprint_match: false
      }
    }
  },
  provenance: {
    deepfake_model: "Wav2Vec2-XLSR-Deepfake-V2.1",
    deepfake_model_version: "v2.1.0",
    speaker_model: "SpeechBrain ECAPA-TDNN",
    speaker_model_version: "v1.4.0",
    asr_model: "Faster-Whisper-Small",
    asr_model_version: "v2.0",
    ml_mode: "live_neural_engine",
    ml_device: "cuda:0 / cpu",
  },
  pipeline_stages_completed: [
    "audio_preprocessing",
    "deepfake_detection",
    "speaker_verification",
    "acoustic_forensics",
    "asr_transcription",
    "multi_signal_risk_fusion",
    "policy_evaluation"
  ],
  total_processing_time_ms: 362.8
};

const PORT = 4789;
const BASE_URL = `http://localhost:${PORT}`;

async function main() {
  console.log('--- Starting TrueVoice Prototype Screenshot Generator ---');
  
  // 1. Start Vite dev server on dedicated port
  console.log(`Launching Vite on port ${PORT}...`);
  const viteProcess = spawn('npx.cmd', ['vite', '--port', String(PORT), '--strictPort', 'true', '--clearScreen', 'false'], {
    cwd: path.resolve('frontend'),
    shell: true,
    stdio: 'pipe'
  });

  viteProcess.stdout.on('data', (d) => process.stdout.write(`[Vite] ${d}`));
  viteProcess.stderr.on('data', (d) => process.stderr.write(`[Vite ERR] ${d}`));

  await new Promise((resolve) => setTimeout(resolve, 3500));

  const browserPath = findBrowserPath();
  console.log(`Using browser executable: ${browserPath}`);

  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: 'new',
    defaultViewport: {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 2, // 2x retina sharpness
    },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });

  async function createConfiguredPage(authenticated = true) {
    const page = await browser.newPage();
    await page.setRequestInterception(true);

    page.on('request', (req) => {
      const url = req.url();

      if (url.includes('/health')) {
        return req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'HEALTHY',
            database: 'CONNECTED (PostgreSQL 16 + pgvector)',
            version: '1.2.0'
          })
        });
      }

      if (url.includes('/v1/policies/active')) {
        return req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_POLICY)
        });
      }

      if (url.includes('/v1/sessions/sess-deepfake-9842/risk/latest')) {
        return req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_RISK_LATEST)
        });
      }

      if (url.includes('/v1/sessions/sess-deepfake-9842/risk/timeline')) {
        return req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_TIMELINE)
        });
      }

      if (url.includes('/v1/sessions/sess-deepfake-9842/audit-logs') || url.includes('/v1/audit/logs')) {
        return req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_AUDIT_LOGS)
        });
      }

      if (url.includes('/v1/audit/validate-chain')) {
        return req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            is_valid: true,
            total_entries: 128,
            chain_head_hash: '0xe5729ab810a9c8e192fab1a41fb9c2830e018d45f9e2b10a48b309e1d827fc30',
            validated_at: new Date().toISOString()
          })
        });
      }

      if (url.includes('/v1/sessions/sess-deepfake-9842')) {
        return req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_SESSION_DETAIL)
        });
      }

      if (url.includes('/v1/sessions')) {
        return req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_SESSIONS)
        });
      }

      if (url.includes('/v1/speakers')) {
        return req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_SPEAKERS)
        });
      }

      if (url.includes('/v1/analysis/audio-file')) {
        return req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_AUDIO_ANALYSIS_RESPONSE)
        });
      }

      req.continue();
    });

    if (authenticated) {
      await page.evaluateOnNewDocument(() => {
        const userObj = {
          access_token: 'mock-auth-jwt-token-truevoice-2026',
          token_type: 'bearer',
          expires_in_minutes: 60,
          user_id: 'usr_sec_lead_77',
          org_id: 'org-soc-truevoice',
          role: 'SECURITY_ANALYST',
        };
        sessionStorage.setItem('tv_token', userObj.access_token);
        sessionStorage.setItem('tv_user', JSON.stringify(userObj));
      });
    }

    return page;
  }

  // Complete List of prototype screens
  const pagesToCapture = [
    {
      filename: '01_Login_Authentication.png',
      hash: '#/login',
      auth: false,
      title: 'Login & Enterprise Authentication',
      setup: async (page) => {
        await new Promise((r) => setTimeout(r, 600));
      }
    },
    {
      filename: '02_Registration_Role_Selection.png',
      hash: '#/login',
      auth: false,
      title: 'Registration & SOC Role Assignment',
      setup: async (page) => {
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const b = btns.find(x => x.textContent.includes('Create Account') || x.textContent.includes('Register'));
          if (b) b.click();
        });
        await new Promise((r) => setTimeout(r, 600));
      }
    },
    {
      filename: '03_Dashboard_Overview.png',
      hash: '#/overview',
      auth: true,
      title: 'SOC Command Center Overview',
      setup: async (page) => {
        await new Promise((r) => setTimeout(r, 1000));
      }
    },
    {
      filename: '04_Realtime_Live_Monitor.png',
      hash: '#/monitor',
      auth: true,
      title: 'Real-Time Voice Call Monitor & DSP Telemetry',
      setup: async (page) => {
        await new Promise((r) => setTimeout(r, 1000));
      }
    },
    {
      filename: '05_Deepfake_Audio_Analysis_Workspace.png',
      hash: '#/analyze',
      auth: true,
      title: 'Multi-Engine Audio Analysis Workspace',
      setup: async (page) => {
        await new Promise((r) => setTimeout(r, 800));
      }
    },
    {
      filename: '06_Deepfake_Audio_Analysis_Populated_Report.png',
      hash: '#/analyze',
      auth: true,
      title: 'Multi-Engine Deepfake Forensic Report & Telemetry',
      setup: async (page) => {
        await page.evaluate((mockResponse) => {
          // Simulate file drop / state injection
          const dtRef = new DataTransfer();
          const fileRef = new File([new Uint8Array(48000)], 'cfo_enrolled_reference_16k.wav', { type: 'audio/wav' });
          dtRef.items.add(fileRef);

          const dtSusp = new DataTransfer();
          const fileSusp = new File([new Uint8Array(32000)], 'incoming_wire_transfer_call_intercept.wav', { type: 'audio/wav' });
          dtSusp.items.add(fileSusp);

          const inputs = document.querySelectorAll('input[type="file"]');
          if (inputs.length >= 2) {
            inputs[0].files = dtRef.files;
            inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
            inputs[1].files = dtSusp.files;
            inputs[1].dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, MOCK_AUDIO_ANALYSIS_RESPONSE);

        await new Promise((r) => setTimeout(r, 500));

        // Click Analyze button
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const analyzeBtn = btns.find(b => b.textContent.includes('Run Multi-Engine Analysis') || b.textContent.includes('Analyze Audio'));
          if (analyzeBtn) analyzeBtn.click();
        });

        // Wait for analysis to complete and render
        await new Promise((r) => setTimeout(r, 4500));

        // Expand transcript and forensics sections
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          btns.forEach(b => {
            if (b.textContent.includes('Speech-to-Text') || b.textContent.includes('DSP Acoustic Forensics')) {
              b.click();
            }
          });
        });
        await new Promise((r) => setTimeout(r, 600));
      }
    },
    {
      filename: '07_Sessions_Triage_Explorer.png',
      hash: '#/sessions',
      auth: true,
      title: 'Call Session Records & Risk Triage',
      setup: async (page) => {
        await new Promise((r) => setTimeout(r, 800));
      }
    },
    {
      filename: '08_Security_Incidents_View.png',
      hash: '#/incidents',
      auth: true,
      title: 'Security Incidents & High-Risk Triage',
      setup: async (page) => {
        await new Promise((r) => setTimeout(r, 800));
      }
    },
    {
      filename: '09_Forensic_Investigation_Detail.png',
      hash: '#/session/sess-deepfake-9842',
      auth: true,
      title: 'Forensic Deepfake Investigation & Evidence Dossier',
      setup: async (page) => {
        await new Promise((r) => setTimeout(r, 1200));
      }
    },
    {
      filename: '10_Incident_Forensic_Case_Dossier.png',
      hash: '#/incident/sess-deepfake-9842',
      auth: true,
      title: 'Incident Forensic Case View',
      setup: async (page) => {
        await new Promise((r) => setTimeout(r, 1200));
      }
    },
    {
      filename: '11_Out_of_Band_Verification.png',
      hash: '#/verification',
      auth: true,
      title: 'Out-of-Band Secondary Biometric Verification',
      setup: async (page) => {
        await new Promise((r) => setTimeout(r, 800));
      }
    },
    {
      filename: '12_Cryptographic_Audit_Trail.png',
      hash: '#/audit',
      auth: true,
      title: 'SHA-256 Tamper-Proof Cryptographic Audit Ledger',
      setup: async (page) => {
        await new Promise((r) => setTimeout(r, 800));
      }
    },
    {
      filename: '13_Policy_Configuration_Settings.png',
      hash: '#/settings',
      auth: true,
      title: 'Policy Configuration & Detector Sensitivity Tuning',
      setup: async (page) => {
        await new Promise((r) => setTimeout(r, 800));
      }
    },
    {
      filename: '14_SOC_Analyst_Help_Center.png',
      hash: '#/help',
      auth: true,
      title: 'SOC Analyst Documentation & Threat Playbooks',
      setup: async (page) => {
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  ];

  for (const item of pagesToCapture) {
    console.log(`\n📸 Capturing: [${item.filename}] - ${item.title}`);
    
    const page = await createConfiguredPage(item.auth);
    await page.goto(`${BASE_URL}/${item.hash}`, { waitUntil: 'networkidle0', timeout: 20000 });
    
    if (item.setup) {
      await item.setup(page);
    }

    await new Promise((r) => setTimeout(r, 600));

    const outputPath = path.join(OUTPUT_DIR, item.filename);
    await page.screenshot({
      path: outputPath,
      fullPage: true,
    });

    console.log(`Saved screenshot: ${outputPath}`);
    await page.close();
  }

  await browser.close();
  try {
    viteProcess.kill();
  } catch {}
  console.log('\n Successfully generated all prototype screenshots in: true voice prototype/');
}

main().catch((err) => {
  console.error('Fatal error during capture:', err);
  process.exit(1);
});
