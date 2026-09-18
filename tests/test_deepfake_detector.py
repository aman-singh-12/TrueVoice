import unittest

import numpy as np

from truevoice.ml.deepfake_detector import DeepfakeDetector


class FakeValue:
    def __init__(self, value):
        self.value = value

    def item(self):
        return self.value


class FakeProbabilities:
    def __getitem__(self, index):
        return FakeValue((0.25, 0.75)[index])


class FakeBatch:
    def __getitem__(self, index):
        return FakeProbabilities()


class FakeTorch:
    class cuda:
        @staticmethod
        def is_available():
            return False

    class nn:
        class functional:
            @staticmethod
            def softmax(logits, dim=-1):
                return FakeBatch()

    @staticmethod
    def no_grad():
        class Context:
            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

        return Context()


class FakeTensor:
    def to(self, device):
        return self


class FakeExtractor:
    def __call__(self, waveform, **kwargs):
        self.waveform = waveform
        return {"input_values": FakeTensor()}


class FakeModel:
    def __init__(self):
        self.device = None
        self.was_evaluated = False

    def to(self, device):
        self.device = device
        return self

    def eval(self):
        self.was_evaluated = True

    def __call__(self, **inputs):
        return type("Output", (), {"logits": object()})()


class DeepfakeDetectorTests(unittest.TestCase):
    def setUp(self):
        self.model = FakeModel()
        self.extractor = FakeExtractor()
        self.detector = DeepfakeDetector(
            model_name="injected-model",
            model=self.model,
            feature_extractor=self.extractor,
            torch_module=FakeTorch,
            device="cpu",
        )

    def test_predict_maps_class_one_to_synthetic(self):
        result = self.detector.predict(np.zeros(16_000, dtype=np.float32))

        self.assertAlmostEqual(result.bonafide_probability, 0.25)
        self.assertAlmostEqual(result.synthetic_probability, 0.75)
        self.assertEqual(result.model_version, "injected-model")
        self.assertEqual(self.model.device, "cpu")
        self.assertTrue(self.model.was_evaluated)

    def test_rejects_non_mono_or_empty_audio(self):
        with self.assertRaises(ValueError):
            self.detector.predict(np.zeros((2, 10), dtype=np.float32))
        with self.assertRaises(ValueError):
            self.detector.predict(np.array([], dtype=np.float32))

    def test_model_components_must_be_injected_together(self):
        with self.assertRaises(ValueError):
            DeepfakeDetector(model=self.model, torch_module=FakeTorch)


if __name__ == "__main__":
    unittest.main()
