# TrueVoice Frontend UI/UX Audit (Pre-Redesign)

Date: 2026-09-19  
Scope: Entire `frontend/` application. No backend algorithms, models, risk formula, policy engine, trust state machine, audit hashing, schema, or migrations were changed for this audit.

---

## 1. Current information architecture

The product is a **single-page tab switcher**, not a routed application.

**Mental model today:** “Forensics console with demo scenarios,” not “real-time voice security platform.”

| Area | What the UI actually is |
|---|---|
| Primary workspace | Forensics Console: file dropzone + three canned scenarios + dense 3-column investigation board |
| Live monitoring | A toolbar (`AudioStreamController`) **above every tab**, not a dedicated destination |
| Sessions | “Incident Sessions” table mixing mock rows with backend sessions (plus invented biometric/hash fields) |
| Speakers | “Biometrics Vault” with mock executives and synthetic enrollment audio |
| Audit | Mock Merkle-style ledger unless a live session ID exists |
| Policy | Threshold sliders presented as a first-class nav item |
| Auth | Modal overlay with “real login” **and** persona simulation |

There is **no Overview**. Health, alerts, and “what needs attention” are not first-class.

The live WebSocket pipeline (session → ticket → PCM → telemetry) is real, but it is **visually subordinated** to mock forensics (speedometer, waveform, fake SHA-256, Unsplash avatars).

---

## 2. Current routes

There is **no router** (`react-router` is not installed). `main.tsx` mounts `App` only.

| Mechanism | Destinations |
|---|---|
| React `activeTab` state | `console` \| `sessions` \| `speakers` \| `audit` \| `policies` |
| URL | Always `/` (hash unused) |
| Deep links | None — refresh returns to Forensics Console |
| Auth route | None — app is usable without JWT; login is optional modal |

Backend API paths the client already knows (`/v1/auth/login`, `/v1/sessions`, `/v1/stream/{id}`, `/v1/risk/{id}/*`, `/v1/verification/*`, `/v1/audit/{id}/*`, `/v1/speakers`, `/v1/policies`, `/health`) are **not mirrored in the UI structure**.

---

## 3. Current navigation

`Header.tsx` is a **sticky top bar** containing:

1. Brand + always-on “File Ingestion (Active)” chip (incorrect when live WS is running)
2. Five equal-weight tabs (Forensics, Incident Sessions, Biometrics Vault, Audit Ledger, Policy Tuning)
3. **Scenario presets** with hardcoded scores: Escrow Attack (88%), Authentic (12%), Borderline (54%)
4. Persona pill that opens AuthModal

Problems:

- Every feature is primary navigation.
- Demo scenario switches sit next to product identity.
- No Overview, no Live Monitor item, no Settings/Help grouping.
- Active tab styling is subtle (white pill on warm gray).
- No keyboard landmarks (`nav` exists, but tabs are unlabeled for screen readers; no `aria-current`).
- Stream controls persist on **all** pages, crowding every destination.

Duplicate headers exist (`components/Header.tsx` vs `components/common/Header.tsx`). Unused SOC CSS (`App.css`) and unused `LoginModal` compete with the warm Tailwind shell.

---

## 4. Current user journeys

### Intended (product)

LOGIN → OVERVIEW → CREATE/SELECT SESSION → LIVE MONITORING → RISK DETECTED → INVESTIGATE → VERIFY → INCIDENT/HISTORY → AUDIT

### Actual (today)

1. Open app (already “in” without login).
2. Land on **Forensics Console** with **Attack scenario already loaded** (risk 88.4, critical copy).
3. Optionally switch canned scenarios in the header.
4. Optionally start a real session from the dark SOC toolbar (visually disconnected from the warm console).
5. Live telemetry is **mapped into the mock ForensicCallScenario**, including `Math.random()` forensic hashes and Unsplash avatars.
6. File upload invents scores (68.2 VERIFY) without backend analysis.
7. “Inspect session” maps backend rows back onto **canned scenarios**, not session detail APIs.
8. Verification exists (`ChallengeModal`) but close currently re-dispatches a challenge.
9. Audit/policy/speakers can show backend data **or silently fall back to mocks**.

The jury journey is: “click red scenario → look at busy dashboard,” not “monitor a live voice session.”

---

## 5. UI problems

- Warm cream/terracotta “consumer” palette vs leftover dark SOC CSS — two products in one.
- Information hierarchy is flat: banners, dropzones, scenario chips, speedometer, waveform, transcript, lockdown panel all compete.
- Excessive borders, rounded-2xl cards nested in cards.
- All-caps mono labels, emoji in titles (`🎙️ LIVE INGESTION`), marketing copy (“Zero-Trust Forensic Enclave”).
- Risk shown as verbose strings (`Current Risk Score: 72.000000` pattern in live mapping; high precision, low scanability).
- File ingestion dropzone occupies the top of the “most important” screen.
- Footer claims “Encrypted Cluster Node: US-East-1A” with no backend source.
- Inconsistent type scale (10px–18px mixed without a system).
- Icons duplicated as inline SVGs instead of a component set (`lucide-react` is installed but barely used in the shell).

---

## 6. UX problems

- No guided flow; presenter must know to start the mic toolbar.
- Scenario toggles **override** live understanding of the system.
- Sessions list invents biometric match 92% / MATCH and random hashes when mapping API data.
- Clicking a session loads a **demo scenario**, not `GET /v1/sessions/{id}` + timeline.
- Policy Tuning is a top-level “admin CRUD” page.
- Auth allows skipping real login via persona simulation.
- Errors are raw (`Failed to initiate session: ...`) in a tiny banner.
- Close on ChallengeModal calls `dispatchVerification()` (new challenge) instead of dismissing.
- File upload claims analysis that never hits the backend.
- Speaker enrollment generates a **synthetic sine-wave WAV**.

---

## 7. Accessibility problems

- Color-only cues on scenario dots and biometric match dots.
- Many buttons lack accessible names (icon-only close buttons inconsistently labeled).
- Modals: no focus trap, no `role="dialog"`, no `aria-modal`, no restore-focus.
- Auth persona rows are clickable `div`s, not buttons.
- Contrast: terracotta on white is acceptable; 10px `#A1A1AA` metadata is weak.
- Pulse/ping animations on brand mark and “live” chips with no `prefers-reduced-motion`.
- Tables: sessions table is mouse-row-click without keyboard row activation.
- Form labels exist in some places; stream ANI is labeled. Challenge input is labeled.
- Skip link / main landmark: `<main>` exists; sidebar/nav structure does not.

---

## 8. Responsive problems

- Header stacks poorly: brand + five tabs + three scenarios + persona overflow on laptop widths.
- `xl:flex-row` still cramped at 1280px.
- Forensics 12-column grid collapses to a long vertical scroll of equal-weight cards.
- Sessions table forces horizontal scroll; many columns (including invented ones).
- Stream controller uses `App.css` dark theme that does not share Tailwind breakpoints.
- No dedicated mobile nav; tabs wrap into a second row.
- Drawers (`max-w-xl`) OK on tablet; backdrop click-to-close missing.

---

## 9. Component duplication

| Concern | Copies |
|---|---|
| Header | `Header.tsx`, `common/Header.tsx` |
| Login | `LoginModal.tsx`, `AuthModal.tsx` |
| Risk visualization | `RiskGauge.tsx`, `forensics/RiskSpeedometer.tsx` |
| Transcript | `ThreatBadges.tsx` snippet, `forensics/TranscriptPanel.tsx` |
| Audit | `AuditViewer.tsx` (real API), `AuditLedgerView.tsx` (mock-first) |
| Status | `StatusBadge.tsx` (includes non-backend tiers CAUTION/VERIFY) |
| Buttons | Tailwind one-offs vs `.btn` in `App.css` |
| Types | UI `types/index.ts` (demo) vs `types/api.ts` + `types/telemetry.ts` (contract) |

---

## 10. Visual consistency problems

- Light warm Inter UI vs dark cyan SOC toolbar/modals.
- Risk colors: terracotta everywhere vs semantic green/amber/red in gauges.
- Radius: 2xl vs 6–10px SOC.
- Typography: Inter vs system stack in `App.css`.
- Shadows: `shadow-soft` vs heavy black SOC shadows.
- “Enterprise v2.4” badge is decorative versioning.

---

## 11. Dashboard information overload

The Forensics Console simultaneously shows:

1. Dual-channel file ingestion dropzone and pipeline marketing copy  
2. Upload toast claiming Mel spectrograms / ECAPA  
3. Active investigation title  
4. Three scenario buttons (again)  
5. Risk speedometer + compounding multiplier + five weighted factors  
6. Fake waveform player + codec/sample-rate metadata  
7. Full transcript panel  
8. Biometric lockdown panel (avatar, hash, locked treasury actions)  
9. Persistent stream toolbar (ANI, VU meter, challenge, override, audit)  
10. Header scenario presets  
11. Footer cluster claims  

Live risk is easy to miss. Nothing answers calmly: “Is the system healthy? Are we monitoring? What needs attention?”

---

## 12. Recommended new information architecture

**Product framing:** Real-Time Voice Security & Trust Platform.

**Application shell:** persistent dark sidebar + light canvas + compact top bar (search, alerts, user).

```
LOGIN (full page, required)
  └── APP SHELL
        MONITOR
          Overview      #/overview
          Live Monitor  #/monitor     ← flagship
        INVESTIGATE
          Sessions      #/sessions
          Session       #/sessions/:id
          Incidents     #/incidents
          Incident      #/incidents/:id
        SECURITY
          Verification  #/verification
          Audit         #/audit
        SYSTEM
          Settings      #/settings    (policy + voiceprints)
          Help          #/help
```

**Primary nav only:** Overview, Live Monitor, Sessions, Incidents, Verification, Audit.  
**Secondary:** Settings, Help.

**Data rule:** Backend is source of truth. Unavailable → “Unavailable”. No canned scenarios, no persona RBAC, no invented hashes/scores on production paths.

**Live Monitor hierarchy:** session/status → large risk + tier → trust + security action → compact factor bars → collapsible conversation → analyst controls.

**Overview hierarchy:** health / active sessions / alerts → risk snapshot → recent events → recent sessions/incidents / model-health (from `/health` only).

This IA is the implementation target for the redesign that follows this audit.
