from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from pngutil import write_png  # noqa: E402

from video_agent.errors import GenerationFailureError  # noqa: E402
from video_agent.ffmpeg_tools import concat_clips, still_to_motion, text_to_motion, validate_mp4  # noqa: E402


class FFmpegPipelineTests(unittest.TestCase):
    def test_image_to_video_9_16(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            src = write_png(Path(tmp) / "still.png", 360, 640, (30, 80, 120))
            dest = Path(tmp) / "out.mp4"
            still_to_motion(src, dest, width=720, height=1280, duration=1, dry_run=True)
            info = validate_mp4(dest, expect_w=720, expect_h=1280, min_duration=0.4)
            self.assertEqual(info["aspect"], "9:16")
            self.assertEqual(info["codec"], "h264")

    def test_text_to_video_9_16(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / "text.mp4"
            text_to_motion("hello vertical video", dest, width=720, height=1280, duration=1, dry_run=True)
            info = validate_mp4(dest, expect_w=720, expect_h=1280, min_duration=0.4)
            self.assertEqual(info["width"], 720)
            self.assertEqual(info["height"], 1280)

    def test_concat_two_clips(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            src = write_png(Path(tmp) / "still.png", 720, 1280)
            a = Path(tmp) / "a.mp4"
            b = Path(tmp) / "b.mp4"
            still_to_motion(src, a, width=720, height=1280, duration=1, dry_run=True)
            still_to_motion(src, b, width=720, height=1280, duration=1, dry_run=True)
            joined = Path(tmp) / "join.mp4"
            concat_clips([a, b], joined, width=720, height=1280)
            info = validate_mp4(joined, expect_w=720, expect_h=1280, min_duration=1.0)
            self.assertGreaterEqual(info["duration"], 1.0)

    def test_concat_requires_two(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(GenerationFailureError):
                concat_clips([Path(tmp) / "only.mp4"], Path(tmp) / "x.mp4", width=720, height=1280)


if __name__ == "__main__":
    unittest.main()
