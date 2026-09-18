"""Classify an audio file as real or AI-generated speech."""

from __future__ import annotations

import argparse

from truevoice.ml import DeepfakeDetector


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("audio", help="Path to a WAV, MP3, FLAC, or librosa-supported file")
    parser.add_argument("--device", default=None, help="Inference device, for example cpu or cuda")
    args = parser.parse_args()

    result = DeepfakeDetector(device=args.device).predict_file(args.audio)
    prediction = "fake" if result.synthetic_probability > 0.5 else "real"
    confidence = max(result.synthetic_probability, result.bonafide_probability)

    print(f"Prediction: {prediction}")
    print(f"Confidence: {confidence:.2%}")
    print(f"Real: {result.bonafide_probability:.2%}")
    print(f"AI-generated: {result.synthetic_probability:.2%}")
    print(f"Latency: {result.inference_latency_ms:.1f} ms")


if __name__ == "__main__":
    main()
