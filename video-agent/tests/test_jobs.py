from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from pngutil import write_png  # noqa: E402

from video_agent.errors import MissingImageError, ModelUnavailableError  # noqa: E402
from video_agent.jobs import JOBS, new_job  # noqa: E402
from video_agent.pipeline import parse_request, run_job  # noqa: E402
from video_agent.providers.base import GenerateRequest  # noqa: E402
from video_agent.providers.local_diffusion import LocalDiffusionProvider  # noqa: E402
from video_agent.providers.local_ffmpeg import LocalFFmpegProvider  # noqa: E402
from video_agent.providers.optional_cloud import OptionalCloudProvider  # noqa: E402


class ProviderAndJobTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        JOBS.mkdir(parents=True, exist_ok=True)

    def test_local_ffmpeg_validate_requires_image(self) -> None:
        provider = LocalFFmpegProvider()
        req = GenerateRequest(prompt="move", mode="image_to_video", dry_run=True)
        with self.assertRaises(MissingImageError):
            provider.validate(req)

    def test_diffusion_refuses_without_gpu(self) -> None:
        provider = LocalDiffusionProvider()
        req = GenerateRequest(prompt="move", mode="text_to_video")
        with self.assertRaises(ModelUnavailableError):
            provider.validate(req)

    def test_optional_cloud_never_usable_in_ui(self) -> None:
        status = OptionalCloudProvider().get_status()
        self.assertTrue(status["paid"])
        self.assertFalse(status["usable"])
        with self.assertRaises(ModelUnavailableError):
            OptionalCloudProvider().validate(GenerateRequest(prompt="x", mode="text_to_video"))

    def test_job_lifecycle_dry_run(self) -> None:
        src = write_png(self.root / "ref.png", 720, 1280)
        job = new_job(
            {
                "prompt": "subtle handheld camera, keep identity",
                "mode": "image_to_video",
                "aspect_ratio": "9:16",
                "duration": 6,
                "quality": "720p",
                "dry_run": True,
                "maya": False,
                "image_path": str(src),
                "provider_id": "local_ffmpeg",
            }
        )
        with mock.patch("video_agent.pipeline.jobs.output_file", return_value=self.root / "out.mp4"):
            result = run_job(job["id"])
        self.assertEqual(result["status"], "COMPLETED")
        self.assertEqual(result["ui_status"], "completed")
        self.assertTrue(Path(result["output_path"]).is_file())

    def test_missing_image_fails_job(self) -> None:
        job = new_job(
            {
                "prompt": "anything",
                "mode": "image_to_video",
                "aspect_ratio": "9:16",
                "duration": 4,
                "quality": "720p",
                "dry_run": True,
                "maya": False,
                "image_path": None,
                "provider_id": "local_ffmpeg",
            }
        )
        result = run_job(job["id"])
        self.assertEqual(result["status"], "FAILED")
        self.assertEqual(result["error_code"], "missing_image")
        self.assertIn("reference image", result["error"].lower())

    def test_parse_rejects_bad_aspect(self) -> None:
        from video_agent.errors import WrongAspectRatioError

        with self.assertRaises(WrongAspectRatioError):
            parse_request({"prompt": "x", "mode": "text_to_video", "aspect_ratio": "16:9"}, None)


if __name__ == "__main__":
    unittest.main()
