"""
Conversational Intent & Social Engineering Threat Analyzer.
Scans sliding ASR transcripts for executive authority claims, urgent wire requests,
credential solicitation, and out-of-band communication suppression.
Produces conversational threat score S_conv in [0.0, 1.0].
"""

import re
from typing import List, Tuple
import numpy as np


class IntentAnalyzer:
    """Deterministic rule-based conversational threat evaluator."""

    INTENT_CATEGORIES = {
        "AUTHORITY_CLAIM": [
            re.compile(r"(?i)\b(ceo|director|managing director|cfo|executive|president|chairman)\b"),
            re.compile(r"(?i)\b(special directive|board request|strictly confidential|priority order)\b"),
        ],
        "FINANCIAL_URGENCY": [
            re.compile(r"(?i)\b(wire transfer|rtgs|neft|immediate transfer|send money|funds release)\b"),
            re.compile(r"(?i)\b(before banking closes|urgent payment|invoice clearance|today itself)\b"),
            re.compile(r"(?i)\b(penalty|vendor will cancel|deal will fail)\b"),
        ],
        "CREDENTIAL_REQUEST": [
            re.compile(r"(?i)\b(one-time password|otp|password|security pin|mfa code|verification code)\b"),
            re.compile(r"(?i)\b(login credentials|bypass security|override authentication)\b"),
        ],
        "CHANNEL_SUPPRESSION": [
            re.compile(r"(?i)\b(do not call me back|my phone is discharging|do not disturb|keep this between us)\b"),
            re.compile(r"(?i)\b(do not inform anyone|bypass standard protocol)\b"),
        ],
    }

    # Threat weights per detected intent category
    CATEGORY_WEIGHTS = {
        "AUTHORITY_CLAIM": 0.25,
        "FINANCIAL_URGENCY": 0.35,
        "CREDENTIAL_REQUEST": 0.40,
        "CHANNEL_SUPPRESSION": 0.30,
    }

    def evaluate(self, transcript: str) -> Tuple[float, List[str]]:
        """
        Scan transcript and return (S_conv: float in [0.0, 1.0], detected_flags: List[str]).
        """
        if not transcript or not transcript.strip():
            return 0.0, []

        detected_flags: List[str] = []
        accumulated_score = 0.0

        for category, regex_list in self.INTENT_CATEGORIES.items():
            for pattern in regex_list:
                if pattern.search(transcript):
                    if category not in detected_flags:
                        detected_flags.append(category)
                        accumulated_score += self.CATEGORY_WEIGHTS.get(category, 0.20)
                    break  # Count category at most once

        # Bound score to [0.0, 1.0]
        s_conv = float(np.clip(accumulated_score, 0.0, 1.0))
        return round(s_conv, 3), detected_flags
