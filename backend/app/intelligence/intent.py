"""
Conversational Intent & Social Engineering Threat Intelligence.
Scans sliding ASR transcripts for structured threat categories:
- AUTHORITY_IMPERSONATION: Claims of C-suite, board, regulatory or law enforcement status
- FINANCIAL_URGENCY: Demands for immediate fund transfer, deadline pressures, penalty threats
- CREDENTIAL_SOLICITATION: Requests for passwords, PINs, master keys, passphrases
- MFA_OTP_SOLICITATION: Demands for one-time passwords, SMS 2FA codes, push token approvals
- SECURITY_BYPASS: Instructions to skip validation, override security policy or dual control
- SECRECY_REQUEST: Strict confidentiality demands, discouraging checking with colleagues
- CALLBACK_SUPPRESSION: Discouraging callback verification, claims of unreachable phone
- COERCION_PRESSURE: Threats of legal action, account termination, personal liability
- UNUSUAL_PAYMENT_INSTRUCTION: Demands for gift cards, cryptocurrency, or non-corporate accounts

Does NOT trigger on isolated single keywords (e.g. 'OTP' mentioned defensively).
Combines multi-indicator phrase patterns and context.
Produces conversational threat score S_conv in [0.0, 1.0] and verifiable evidence.
"""

import re
from typing import Any, Dict, List, Optional, Tuple
import numpy as np


class IntentResult:
    """Structured evaluation output from conversational threat analyzer."""

    def __init__(
        self,
        score: float,
        flags: List[str],
        evidence: List[str],
        category_scores: Optional[Dict[str, float]] = None,
        available: bool = True,
    ):
        self.score = score  # 0.0 to 1.0
        self.flags = flags  # List of matched threat categories
        self.evidence = evidence  # Human-readable explanation strings
        self.category_scores = category_scores if category_scores is not None else {}
        self.available = available

    @property
    def threat_score(self) -> float:
        return self.score

    @property
    def threat_categories(self) -> List[str]:
        return self.flags


class IntentAnalyzer:
    """Deterministic, resilient multi-indicator conversational threat evaluator."""

    # Defensive phrases that negate false-positive threat triggers
    DEFENSIVE_PATTERNS = [
        re.compile(r"(?i)\b(never (share|give|disclose)|do not share|don't share|keep your (otp|password) safe)\b"),
        re.compile(r"(?i)\b(bank will never ask|we will never ask for your (otp|password|pin))\b"),
        re.compile(r"(?i)\b(beware of fraud|scam alert|fraud warning)\b"),
    ]

    # Structured threat categories and their contextual phrase patterns
    THREAT_DEFINITIONS: Dict[str, Dict[str, Any]] = {
        "AUTHORITY_IMPERSONATION": {
            "weight": 0.25,
            "evidence_desc": "Caller claims institutional executive or regulatory authority",
            "patterns": [
                re.compile(r"(?i)\b(i am|this is)\s+(the\s+)?(ceo|cfo|coo|cto|director|executive director|managing director|president|chairman|board member)\b"),
                re.compile(r"(?i)\b(i am|this is)\s+(from\s+)?(the\s+)?(it department|it support|helpdesk|executive security|security team|cyber team|compliance team)\b"),
                re.compile(r"(?i)\b(calling on behalf of|under direct orders from)\s+(the\s+)?(ceo|director|board|management)\b"),
                re.compile(r"(?i)\b(regulatory directive|law enforcement|rbi auditor|tax department|police inspector)\b"),
                re.compile(r"(?i)\b(strictly confidential executive|executive override|special board directive)\b"),
            ],
        },
        "FINANCIAL_URGENCY": {
            "weight": 0.30,
            "evidence_desc": "Urgent financial transfer demanded under tight deadline pressure",
            "patterns": [
                re.compile(r"(?i)\b(wire\s+(transfer|the funds|funds|money)|rtgs|neft|immediate transfer|send money|release funds)\b"),
                re.compile(r"(?i)\b(before (banking|market) closes|clear (the|this) invoice today|immediate payment required)\b"),
                re.compile(r"(?i)\b(deal will (fail|collapse)|vendor will cancel|severe financial penalty)\b"),
                re.compile(r"(?i)\b(do it (right now|immediately|without delay)|urgent wire)\b"),
            ],
        },
        "CREDENTIAL_SOLICITATION": {
            "weight": 0.35,
            "evidence_desc": "Solicitation of confidential passwords, PINs, or credentials",
            "patterns": [
                re.compile(r"(?i)\b(provide|give me|tell me|confirm|read out|enter|asking for|need|requesting)\s+(your\s+)?(password|security pin|login credentials|passphrase)\b"),
                re.compile(r"(?i)\b(reset your password to|what is your (password|pin)|verify your login details)\b"),
                re.compile(r"(?i)\b(corporate login credentials|admin access details)\b"),
            ],
        },
        "MFA_OTP_SOLICITATION": {
            "weight": 0.40,
            "evidence_desc": "Solicitation of secondary authentication OTP or 2FA verification codes",
            "patterns": [
                re.compile(r"(?i)\b(read(\s+out|\s+me)?|share|give|tell|send\s+me|what\s+is)\s+(the\s+)?(6[- ]digit\s+)?(one[- ]time\s+(passcode|password)|otp|verification code|sms code|2fa code|security code)\b"),
                re.compile(r"(?i)\b(you just received a (code|pin|otp)|approve the push (prompt|notification)|6[- ]digit code)\b"),
                re.compile(r"(?i)\b(read (out\s+)?the code sent to your (phone|device|mobile))\b"),
            ],
        },
        "SECURITY_BYPASS": {
            "weight": 0.30,
            "evidence_desc": "Instructions to bypass standard verification protocols or dual control",
            "patterns": [
                re.compile(r"(?i)\b(bypass|skip|override|waive)\s+(standard\s+)?(dual\s+(control|approval|authorization)\s+)?(security|verification|protocol|procedure|dual control|dual approval|authorization|checks)\b"),
                re.compile(r"(?i)\b(bypass|skip|override|waive)\b.*\b(security|verification|protocol|procedure|dual control|dual approval|authorization)\b"),
                re.compile(r"(?i)\b(no need for approval|ignore the (warning|prompt|policy)|exception approved by me)\b"),
                re.compile(r"(?i)\b(emergency override|disable security)\b"),
            ],
        },
        "SECRECY_REQUEST": {
            "weight": 0.25,
            "evidence_desc": "Insistence on secrecy or concealing communication from internal colleagues",
            "patterns": [
                re.compile(r"(?i)\b(keep this (between us|strictly confidential|secret|quiet)|do not (tell|inform|mention to) anyone)\b"),
                re.compile(r"(?i)\b(do not discuss with (your team|colleagues|manager)|off the record)\b"),
                re.compile(r"(?i)\b(highly sensitive acquisition|clandestine project)\b"),
            ],
        },
        "CALLBACK_SUPPRESSION": {
            "weight": 0.30,
            "evidence_desc": "Caller discourages independent out-of-band verification callback",
            "patterns": [
                re.compile(r"(?i)\b(do not call (me\s+)?back|cannot take incoming calls|my phone is (discharging|dying|broken))\b"),
                re.compile(r"(?i)\b(do not verify with the office|i am in a meeting and cannot answer)\b"),
                re.compile(r"(?i)\b(stay on this line|do not disconnect)\b"),
            ],
        },
        "COERCION_PRESSURE": {
            "weight": 0.30,
            "evidence_desc": "Coercion through threats of account termination, legal action, or personal liability",
            "patterns": [
                re.compile(r"(?i)\b(account will be(\s+\w+)?\s+(suspended|blocked|frozen|terminated)|facing immediate (arrest|legal action))\b"),
                re.compile(r"(?i)\b(do not comply|refuse to comply|face severe consequences)\b"),
                re.compile(r"(?i)\b(you will be held (personally\s+)?liable|you will be fired|disciplinary action)\b"),
                re.compile(r"(?i)\b(police complaint filed|court warrant issued)\b"),
            ],
        },
        "UNUSUAL_PAYMENT_INSTRUCTION": {
            "weight": 0.35,
            "evidence_desc": "Unorthodox settlement instructions via cryptocurrency, gift cards, or personal accounts",
            "patterns": [
                re.compile(r"(?i)\b(transfer to (a|this)\s+(personal|unregistered|temporary|offshore) account)\b"),
                re.compile(r"(?i)\b(pay (via|with|in)\s+(gift cards?|crypto|bitcoin|usdt|digital vouchers?)|purchase gift card)\b"),
                re.compile(r"(?i)\b(escrow bypass|alternate routing number|new escrow routing|routing account|unusual payment rail)\b"),
            ],
        },
    }

    # Aliases for backward compatibility with existing tests and clients
    CATEGORY_ALIASES = {
        "AUTHORITY_CLAIM": "AUTHORITY_IMPERSONATION",
        "CREDENTIAL_REQUEST": "CREDENTIAL_SOLICITATION",
        "CHANNEL_SUPPRESSION": "CALLBACK_SUPPRESSION",
    }

    def analyze(self, transcript: str) -> IntentResult:
        """
        Full semantic analysis returning structured IntentResult.
        Resilient against single-word false positives and defensive speech.
        """
        if not transcript or not transcript.strip():
            return IntentResult(score=0.0, flags=[], evidence=[], available=False)

        clean_text = transcript.strip()

        # Check defensive patterns: if entire utterance is an educational/defensive reminder, suppress false-positive flags
        is_defensive = any(def_pattern.search(clean_text) for def_pattern in self.DEFENSIVE_PATTERNS)

        detected_flags: List[str] = []
        evidence_list: List[str] = []
        category_scores: Dict[str, float] = {}
        accumulated_score = 0.0

        for category, config in self.THREAT_DEFINITIONS.items():
            patterns = config["patterns"]
            weight = config["weight"]
            evidence_desc = config["evidence_desc"]

            matched_in_category = 0
            for pattern in patterns:
                if pattern.search(clean_text):
                    matched_in_category += 1

            if matched_in_category > 0:
                detected_flags.append(category)
                evidence_list.append(evidence_desc)
                # Diminishing returns within same category
                cat_score = min(weight * (1.0 + 0.2 * (matched_in_category - 1)), weight * 1.5)
                category_scores[category] = round(cat_score, 3)
                accumulated_score += cat_score

        # If speaking defensively (e.g. security awareness advisory), suppress the threat score
        if is_defensive and len(detected_flags) <= 2:
            accumulated_score = 0.0
            detected_flags = []
            evidence_list = []
            category_scores = {}

        # Multi-category synergy multiplier (e.g. Authority + Financial Urgency + OTP = compounding risk)
        if len(detected_flags) >= 3:
            accumulated_score *= 1.25
        elif len(detected_flags) == 2:
            accumulated_score *= 1.10

        s_conv = float(np.clip(accumulated_score, 0.0, 1.0))
        return IntentResult(
            score=round(s_conv, 3),
            flags=detected_flags,
            evidence=evidence_list,
            category_scores=category_scores,
            available=True,
        )

    def evaluate(self, transcript: str) -> Tuple[float, List[str]]:
        """
        Backward-compatible evaluation interface returning (S_conv: float in [0.0, 1.0], detected_flags: List[str]).
        Includes both canonical category names and legacy aliases for compatibility.
        """
        result = self.analyze(transcript)
        # Expand legacy flags so existing tests expecting 'AUTHORITY_CLAIM' or 'CREDENTIAL_REQUEST' pass seamlessly
        expanded_flags = list(result.flags)
        for legacy_name, canonical_name in self.CATEGORY_ALIASES.items():
            if canonical_name in result.flags and legacy_name not in expanded_flags:
                expanded_flags.append(legacy_name)

        return result.score, expanded_flags
