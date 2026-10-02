# TrueVoice Frontend UI/UX Comprehensive Audit

**Date:** 2026-09-19  
**Product:** TrueVoice — Real-Time Voice Security & Trust Platform  
**Target Audience:** Final Smart India Hackathon (SIH) Jury & Enterprise SOC Operators  
**Scope:** Complete frontend architecture, styling, components, views, navigation, accessibility, and real data verification.  
**Constraint Verification:** Backend source of truth preserved (zero changes to models, risk formulas, policy weights, ML pipelines, database schema, or migrations).

---

### 1. Current Information Architecture

The current frontend is in a transitional state: an initial hash router (`#/overview`, `#/monitor`, `#/sessions`, `#/incidents`, `#/verification`, `#/audit`, `#/settings`, `#/help`) was introduced in `App.tsx`, wrapped in an `AppShell.tsx`, but the internal views and underlying design tokens still suffer from severe fragmentation, dead legacy code, and weak visual prioritization:

- **Overview Dashboard (`OverviewView.tsx`)**: Displays 3 top metric cards (System Health, Monitoring status, Alerts count), a two-column middle section with "Current risk" (empty placeholder when idle) and "Needs attention", and a bottom two-column section with "Recent sessions" and "System status". It fails to provide a cohesive SOC "Mission Control" feel and leaves vast empty gaps when no live call is streaming.
- **Live Monitor (`LiveMonitorView.tsx`)**: The core product screen. Currently presents a crowded, vertically-stacked arrangement of bordered white cards: Session Info bar, Risk Gauge, Trust State, Security Action, Signal Radar (Risk factors), Risk over time SVG graph, Conversation Intelligence (detected intents & collapsible transcript), and Analyst Controls with an expandable override form. The visual hierarchy is flat: all cards have identical white backgrounds and thin borders with no dominant focal point.
- **Sessions & Incidents (`SessionsView.tsx`)**: Reused for both general session history (`/sessions`) and incident triage (`/incidents`). It presents a generic data table with basic dropdown filters. When filtered for incidents, it only filters trust states without providing an incident-specific triage workflow.
- **Investigation Detail (`InvestigateView.tsx`)**: Shared for both single sessions (`/sessions/:id`) and incidents (`/incidents/:id`). Dumps 4 metadata blocks, a plain timeline list, a signal radar, a text blurb for conversation intelligence, and an audit log with raw JSON stringified blocks.
- **Verification Workflow (`VerificationView.tsx`)**: An underdeveloped 50-line stub that merely displays the current security action title and directs users to a floating `ChallengeModal` dialog. There is no focused, multi-step verification console.
- **Audit Trail (`AuditView.tsx`)**: Dropdown session picker with a "Verify chain" button and a table that dumps raw JSON payloads on row expansion. Lacks tamper-evident visual verification badges and cryptographic proof formatting.
- **Settings & Policy (`SettingsView.tsx`)**: Developer-centric forms for editing threshold numbers and uploading speaker audio without SOC guardrails or guidance.
- **Authentication (`LoginView.tsx`)**: Standalone full-page login with basic email/password fields.
- **Dead Legacy Code**: A 1,124-line `App.css` file with legacy dark classes, duplicate headers (`components/Header.tsx`, `components/common/Header.tsx`), unreferenced views (`ForensicsConsoleView.tsx`, `AuditLedgerView.tsx`, `VoiceBiometricsVaultView.tsx`, `IncidentSessionsView.tsx`, `PolicyTuningView.tsx`, `AuthModal.tsx`), and an unreferenced 25KB `mockScenarios.ts` file remain in the codebase.

---

### 2. Current Routes

The active routing uses window hash navigation via `src/hooks/useHashRoute.ts` and `src/lib/routing.ts`:

| Route Hash | View Component | Status & Role |
|---|---|---|
| `#/overview` | `OverviewView` | Primary landing dashboard. Shows system health & active alerts. |
| `#/monitor` | `LiveMonitorView` | Core live streaming & telemetry monitoring console. |
| `#/sessions` | `SessionsView` | Tabular list of all historical and active voice sessions. |
| `#/sessions/:id` | `InvestigateView` (variant='session') | Detailed deep-dive for a specific session ID. |
| `#/incidents` | `SessionsView` (incidentOnly=true) | Filtered view of sessions in non-trusted trust states. |
| `#/incidents/:id` | `InvestigateView` (variant='incident') | Deep-dive incident analysis. |
| `#/verification` | `VerificationView` | Secondary verification view (currently an incomplete stub). |
| `#/audit` | `AuditView` | Cryptographic audit ledger with session selector. |
| `#/audit/:id` | `AuditView` | Audit ledger pre-selected to specific session ID. |
| `#/settings` | `SettingsView` | Policy threshold configuration & voiceprint biometrics enrollment. |
| `#/help` | `HelpView` | Static product documentation and user guide. |

---

### 3. Current Navigation

The navigation is managed in `src/layout/AppShell.tsx`:
- **Sidebar**: Fixed dark sidebar (`bg-slate-950`) with three grouped sections:
  - `Monitor`: Overview (`LayoutDashboard`), Live Monitor (`Radio`)
  - `Investigate`: Sessions (`Activity`), Incidents (`ShieldAlert`)
  - `Security`: Verification (`ShieldCheck`), Audit (`ScrollText`)
  - Footer items: Settings (`Settings`), Help (`HelpCircle`)
- **Top Header Bar**: Sticky white bar (`bg-white/90`) containing mobile hamburger toggle, global session search input, live connection status dot, Alerts pill button with badge counter, user role badge, and Sign Out button.

**Navigation Shortcomings:**
1. Active nav items are barely differentiated (just `bg-white/10 text-white`).
2. No breadcrumb navigation when drilling down into `#/sessions/:id` or `#/incidents/:id`.
3. Search bar submits form and navigates to `#/sessions?q=...` abruptly with no quick search dropdown.
4. Alerts button routes to `#/incidents`, but doesn't indicate whether alerts are new or critical.
5. No quick-switch or status pill in header to jump directly into the active live session if the user navigates away to Audit or Sessions during an active call.

---

### 4. Current User Journeys

#### Intended Enterprise SOC Journey:
```
LOGIN
  ↓
OVERVIEW (System Health, Active Streams, Incident Count)
  ↓
CREATE / SELECT SESSION (Enter Caller ANI or select active queue)
  ↓
LIVE MONITORING (Real-time risk scoring, spectral/biometric signals)
  ↓
RISK DETECTED (Visual elevation to HIGH/CRITICAL, action triggered)
  ↓
INVESTIGATE (Inspect factor breakdowns, intent keywords, voiceprint match)
  ↓
VERIFY / TAKE ACTION (Dispatch OOB Challenge / Analyst Override)
  ↓
INCIDENT / HISTORY (Logged session in incident repository)
  ↓
AUDIT (Tamper-evident SHA-256 hash chain verification)
```

#### Actual Observed Flaws in Journey:
- **No Guided Handoff**: If high risk occurs on `LiveMonitorView`, the analyst sees "Verification required", but clicking verification triggers a floating modal or navigates to `/verification` where the state is disconnected.
- **Drilldown Dead Ends**: Navigating from Live Monitor to "Open investigation" leaves the live stream running in background with no visible banner to return.
- **Incident vs Session Confusion**: Incidents view is merely the session list with a pre-applied filter; there is no triage or investigation lifecycle (e.g., status tags like Under Review, Contained, Closed).
- **Audit Disconnection**: In `InvestigateView`, audit entries show raw JSON blocks without a direct link to the full ledger verification screen.

---

### 5. UI Problems

1. **Weak Visual Hierarchy**:
   - Every card on the dashboard and live monitor uses the same flat white background, 1px border (`border-line`), and rounded corners.
   - The Risk Score does not command immediate authority. The SVG arc gauge has a thin stroke, muted tick marks, and lacks strong contrast.
2. **Cluttered Information Density**:
   - The Live Monitor packs 7 separate panels onto one screen without clear grouping or primary/secondary visual zones.
   - Conversation intelligence and transcript snippets occupy equal visual weight with primary biometric deepfake signals.
3. **Inconsistent Component Styling**:
   - Some components use dark slate classes, others use warm beige/gray tokens, and others use tailwind slate.
   - Text sizes range randomly from `text-[11px]` to `text-5xl` without adhering to a disciplined typography hierarchy.
4. **Unformatted Raw Payloads**:
   - Audit logs and evidence provenance display raw JSON strings (`JSON.stringify(payload, null, 2)`) inside `<pre>` tags, looking like an unfinished developer debug tool.
5. **No Dynamic Visual Elevation on Threat**:
   - When risk reaches CRITICAL (e.g. 88+), only a small badge changes color; the rest of the UI remains calm and static, failing to convey urgent operational risk to an SOC operator.

---

### 6. UX Problems

1. **Disjointed Verification Workflow**:
   - `ChallengeModal.tsx` opens as a popup, but `VerificationView.tsx` exists as a separate route that does nothing but display a static paragraph.
   - When an out-of-band verification challenge is dispatched, the timer countdown is small and lacks clear state progression (Dispatched → Waiting for Response → Verifying Nonce Signature → Confirmed by Backend).
2. **Missing In-Flight Session Persistent Indicator**:
   - When monitoring is active and the user clicks on Sessions or Audit, the header merely displays a tiny green dot labeled "Monitoring" without a persistent floating control bar to mute, view live score, or return to monitor.
3. **Table Usability & Search**:
   - Search input only operates on the Enter key and redirects to a full page query reload.
   - Sorting in tables requires clicking plain column headers with no clear sort indicator icons (▲/▼).
4. **Analyst Override Friction**:
   - The override panel opens as an unstyled sub-panel with three small buttons ("Approve", "Restrict", "Block") and an unstructured text input for reason.

---

### 7. Accessibility Problems

1. **Color-Dependent State Communication**:
   - Risk tiers rely heavily on background tint (`bg-emerald-50`, `bg-amber-50`, `bg-orange-50`, `bg-rose-50`), which has low contrast in bright ambient environments and is difficult for color-blind users.
2. **Missing ARIA Live Regions**:
   - Real-time risk telemetry broadcasts arrive 2 times per second over WebSocket, but there is no `aria-live="polite"` or `aria-atomic="true"` container for assistive technology.
3. **Form & Dialog Accessibility**:
   - Several inputs lack explicit `<label>` connections (`htmlFor` mismatches).
   - Modal dialogs lack keyboard focus trapping (`Tab` escapes out of modal into background).
   - Missing `aria-expanded` and `aria-controls` on expandable table rows.

---

### 8. Responsive Problems

1. **Table Overflow on Laptops & Tablets**:
   - Sessions and Audit tables have fixed `min-w-[720px]` and `min-w-[800px]`, forcing horizontal scroll bars on typical 13-inch laptop displays (1280x800) and tablets.
2. **Grid Collapse Disasters**:
   - The `lg:grid-cols-12` layout on Live Monitor stacks awkwardly on tablet screens (768px–1024px), generating extreme page lengths where the user must scroll 3 full screens to reach the mic control and verification button.
3. **Header Element Crowding**:
   - On medium viewports, search bar, alerts pill, user badge, and sign-out button collide with the sidebar toggle.

---

### 9. Component Duplication & Dead Code

An exhaustive scan reveals substantial duplicate and zombie code from earlier prototypes:

| File Path | Status | Recommendation |
|---|---|---|
| `src/App.css` (1,124 lines) | Dead legacy SOC CSS | Remove or replace with clean, tailored utility classes |
| `src/components/Header.tsx` | Unused duplicate header | Remove |
| `src/components/common/Header.tsx` | Unused duplicate header | Remove |
| `src/components/LoginModal.tsx` | Duplicate auth modal | Consolidate into clean auth |
| `src/components/views/*` (6 files, ~75KB) | Unreferenced legacy views (`ForensicsConsoleView`, `VoiceBiometricsVaultView`, `IncidentSessionsView`, `PolicyTuningView`, `AuditLedgerView`, `AuthModal`) | Clean up / prune to prevent confusion |
| `src/data/mockScenarios.ts` (25KB) | Unreferenced mock data with hardcoded scores | Remove completely to adhere to Real Data Rule |
| `src/components/ThreatBadges.tsx` | Unused legacy component | Remove |
| `src/components/AuditViewer.tsx` | Unused legacy audit viewer | Consolidate into `views/AuditView.tsx` |
| `src/components/AudioStreamController.tsx` | Unused legacy toolbar | Remove |

---

### 10. Visual Consistency Problems

- **Palette Clash**: Tailwind configuration defines warm palette tokens (`warm.canvas`, `terracotta`) alongside legacy slate and cyan tokens, resulting in mixed styling across pages.
- **Shadows and Borders**: Some cards use `border-line` (`#e2e6ee`), others use `border-slate-200`, and others use no border with subtle shadows.
- **Button Inconsistencies**: Primary buttons in `primitives.tsx` use `bg-cyan-700`, while other buttons use inline styles or secondary borders.
- **Typography Scale**: No established font scale tokens; font weights jump between `font-medium` (500) and `font-semibold` (600) arbitrarily.

---

### 11. Dashboard Information Overload vs. Underload

- **When Idle (No Active Call)**:
  - The Overview shows empty statistics and a blank placeholder ("No live telemetry. Start monitoring to see risk").
  - The Live Monitor shows an empty state with an input field for "Caller ID", giving no hint of system readiness, enrolled biometric models, or security policy status.
- **When Active (Streaming Voice)**:
  - The Live Monitor dumps every signal simultaneously without grouping them into Primary Verdict vs Contributing Factors.
  - The jury cannot quickly answer the 5 core SOC questions:
    1. *Is the session authentic or spoofed?*
    2. *What is the numerical composite risk score?*
    3. *Which specific AI model flagged the voice (Wav2Vec2 synthetic probability vs ECAPA voiceprint mismatch)?*
    4. *What action is TrueVoice actively enforcing (Allow, Warn, Restrict, Block)?*
    5. *Is the audit ledger cryptographically sealed?*

---

### 12. Recommended New Information Architecture & Design System

#### Visual Design Theme: "TrueVoice SOC Precision"
A modern, dark-themed SOC (Security Operations Center) visual aesthetic:
- **Canvas / Background**: Deep space slate (`#090d16` / `#0f172a`), deep panel layers (`#131b2e` / `#1e293b`), crisp border contours (`#334155` / `rgba(255, 255, 255, 0.08)`).
- **Semantic Risk Tokens**:
  - `LOW` (0–29): Emerald `#10b981` (Calm, verified authentic)
  - `MODERATE` (30–59): Amber `#f59e0b` (Elevated caution, monitoring)
  - `HIGH` (60–79): Orange `#f97316` (High risk, verification mandatory)
  - `CRITICAL` (80–100): Rose/Red `#ef4444` (Synthetic deepfake attack detected, restricted/blocked)
- **Typography**: Inter / JetBrains Mono for cryptographic hashes, sequence numbers, and latency timings.
- **Dominant Threat Center**:
  - Prominent circular Risk Gauge with illuminated semantic arc and bold score display (`72 HIGH`).
  - Active Trust State machine pill (`TRUSTED`, `CAUTION`, `RESTRICTED`, `BLOCKED`).
  - Highly visible Security Action Banner with direct 1-click execution (`Dispatch Verification`, `Analyst Override`).
- **Structured Signal Breakdown**:
  - High-precision signal meters for Deepfake (RawNet2/AASIST/Wav2Vec2), Speaker Similarity (ECAPA-TDNN), Forensics, Conversation Threat, and Context Sensitivity.
  - Clear label "Unavailable" for signals not provided by backend — zero fake default numbers.
- **Focused Verification Console**:
  - Interactive multi-step verification view with countdown bar, challenge nonce display, copyable token, OTP input, and backend validation feedback.
- **Tamper-Evident Audit Ledger**:
  - Formatted event cards with expandable metadata, actor badges, SHA-256 hash comparison, and 1-click cryptographic chain validation.
- **Real Data Compliance**: Complete removal of unused mock scenarios, random hashes, and placeholder data.
