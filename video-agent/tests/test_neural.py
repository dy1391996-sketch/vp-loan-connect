from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from pngutil import write_png  # noqa: E402

from video_agent.engine import ENGINE_FFMPEG, ENGINE_LOCAL_AI, resolve_engine  # noqa: E402
from video_agent.errors import ModelUnavailableError  # noqa: E402
from video_agent.execution import classify_execution  # noqa: E402
from video_agent.ffmpeg_tools import still_to_motion, transcode_vertical_h264  # noqa: E402
from video_agent.jobs import new_job  # noqa: E402
from video_agent.maya import require_maya_source  # noqa: E402
from video_agent.neural_spec import MODEL_ID, estimate_requirements  # noqa: E402
from video_agent.pipeline import run_job  # noqa: E402
from video_agent.providers.local_neural import LocalNeuralVideoProvider  # noqa: E402


class NeuralProviderTests(unittest.TestCase):
    def test_execution_is_classified(self) -> None:
        exe = classify_execution()
        self.assertIn(exe["kind"], {
            "cursor_cloud_container",
            "macos_host",
            "linux_container",
            "linux_or_other_host",
        })
        self.assertTrue(exe["summary"])

    def test_model_spec_is_2b_not_14b(self) -> None:
        spec = estimate_requirements()
        self.assertEqual(spec["model_id"], MODEL_ID)
        self.assertLess(spec["download_gb"], 15)
        self.assertIn("2B", spec["model_name"])
        self.assertFalse(spec["paid"])

    def test_auto_uses_ffmpeg_when_neural_unavailable(self) -> None:
        engine, provider, reason = resolve_engine("auto")
        status = LocalNeuralVideoProvider().get_status()
        if status["usable"]:
            self.assertEqual(engine, ENGINE_LOCAL_AI)
            self.assertEqual(provider.id, "local_neural")
        else:
            self.assertEqual(engine, ENGINE_FFMPEG)
            self.assertEqual(provider.id, "local_ffmpeg")
            self.assertIn("FFmpeg", reason)

    def test_explicit_local_ai_fails_clearly_without_backend(self) -> None:
        status = LocalNeuralVideoProvider().get_status()
        if status["usable"]:
            engine, provider, _reason = resolve_engine("local_ai")
            self.assertEqual(engine, ENGINE_LOCAL_AI)
            self.assertEqual(provider.id, "local_neural")
            return
        with self.assertRaises(ModelUnavailableError) as ctx:
            resolve_engine("local_ai")
        self.assertIn("LOCAL AI", str(ctx.exception.message))

    def test_neural_status_flags(self) -> None:
        status = LocalNeuralVideoProvider().get_status()
        self.assertTrue(status["neural"])
        self.assertFalse(status["paid"])
        self.assertIn(status["ui_label"], {"AVAILABLE", "NOT AVAILABLE"})
        if not status["usable"]:
            self.assertEqual(status["ui_label"], "NOT AVAILABLE")

    def test_maya_checksum_unchanged(self) -> None:
        maya = require_maya_source()
        self.assertEqual(
            maya["source_sha256"],
            "a357abc29cfbed4de941eef2053d7d69c98ce5fc444f6f69534d1ef5ec862aeb",
        )

    def test_explicit_local_ai_job_fails_without_backend(self) -> None:
        if LocalNeuralVideoProvider().get_status()["usable"]:
            self.skipTest("Neural backend is available on this machine.")
        src = require_maya_source()["source"]
        job = new_job(
            {
                "prompt": "same woman, natural breathing",
                "mode": "image_to_video",
                "aspect_ratio": "9:16",
                "duration": 3,
                "quality": "720p",
                "dry_run": False,
                "maya": True,
                "image_path": src,
                "engine": "local_ai",
            }
        )
        result = run_job(job["id"])
        self.assertEqual(result["status"], "FAILED")
        self.assertEqual(result["error_code"], "model_unavailable")

    def test_ffmpeg_motion_engine_still_works(self) -> None:
        src = require_maya_source()["source"]
        job = new_job(
            {
                "prompt": "keep the same woman, tiny camera drift",
                "mode": "image_to_video",
                "aspect_ratio": "9:16",
                "duration": 3,
                "quality": "720p",
                "dry_run": True,
                "maya": True,
                "image_path": src,
                "engine": "ffmpeg_motion",
            }
        )
        result = run_job(job["id"])
        self.assertEqual(result["status"], "COMPLETED", result)
        self.assertEqual(result["engine"], ENGINE_FFMPEG)
        self.assertFalse(result.get("ai_generated"))
        self.assertTrue(Path(result["output_path"]).is_file())

    def test_worker_refuses_public_bind(self) -> None:
        from video_agent.worker import serve

        with self.assertRaises(SystemExit):
            serve(host="0.0.0.0", port=17991)

    def test_transcode_vertical_h264(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            png = write_png(Path(tmp) / "a.png", 320, 240, (10, 20, 30))
            raw = Path(tmp) / "raw.mp4"
            dest = Path(tmp) / "out.mp4"
            still_to_motion(png, raw, width=480, height=854, duration=1, dry_run=True)
            info = transcode_vertical_h264(raw, dest, width=720, height=1280, min_duration=0.4)
            self.assertEqual(info["width"], 720)
            self.assertEqual(info["height"], 1280)
            self.assertEqual(info["codec"], "h264")


if __name__ == "__main__":
    unittest.main()
