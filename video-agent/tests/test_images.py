from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from pngutil import write_png  # noqa: E402

from video_agent.errors import CorruptImageError, MissingImageError, UnsupportedImageError, WrongAspectRatioError  # noqa: E402
from video_agent.images import aspect_warning_or_error, describe_image, require_image, sniff_image  # noqa: E402


class ImageValidationTests(unittest.TestCase):
    def test_png_dimensions(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = write_png(Path(tmp) / "ok.png", 720, 1280)
            mime, w, h = sniff_image(path)
            self.assertEqual(mime, "image/png")
            self.assertEqual((w, h), (720, 1280))
            info = describe_image(path)
            self.assertTrue(info["is_9_16"])

    def test_missing_image(self) -> None:
        with self.assertRaises(MissingImageError):
            require_image(None, mode="image_to_video")

    def test_corrupt_png(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "bad.png"
            path.write_bytes(b"\x89PNG\r\n\x1a\nnot-a-png")
            with self.assertRaises(CorruptImageError):
                sniff_image(path)

    def test_unsupported_extension(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "x.gif"
            path.write_bytes(b"GIF89a" + b"\x00" * 40)
            with self.assertRaises(UnsupportedImageError):
                sniff_image(path)

    def test_wrong_aspect_warns_or_errors(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = write_png(Path(tmp) / "wide.png", 1280, 720)
            info = describe_image(path)
            self.assertFalse(info["is_9_16"])
            warning = aspect_warning_or_error(info, strict=False)
            self.assertIn("not 9:16", warning or "")
            with self.assertRaises(WrongAspectRatioError):
                aspect_warning_or_error(info, strict=True)


if __name__ == "__main__":
    unittest.main()
