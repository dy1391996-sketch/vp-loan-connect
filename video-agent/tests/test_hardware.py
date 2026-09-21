from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from video_agent.hardware import detect_hardware  # noqa: E402


class HardwareTests(unittest.TestCase):
    def test_detects_this_machine(self) -> None:
        hw = detect_hardware(ROOT)
        self.assertIn(hw["os"], {"Linux", "Darwin", "Windows"})
        self.assertTrue(hw["cpu_count"] >= 1)
        self.assertIn("ffmpeg", hw)
        self.assertIn("recommended_engine", hw)
        self.assertIn("neural_i2v_viable", hw)
        self.assertTrue(hw["reason"])
        if not hw.get("gpu") and not hw.get("apple_silicon"):
            self.assertFalse(hw["neural_i2v_viable"])
            self.assertEqual(hw["recommended_engine"], "local_ffmpeg")


if __name__ == "__main__":
    unittest.main()
