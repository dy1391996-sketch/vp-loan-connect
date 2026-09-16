from __future__ import annotations

import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
MAYA = REPO / "maya-video-pipeline"
sys.path.insert(0, str(ROOT / "src"))

from video_agent.maya import require_maya_source  # noqa: E402
from video_agent.pipeline import dry_run_report  # noqa: E402


class MayaWorkflowTests(unittest.TestCase):
    def test_identity_lock_matches_registered_sha(self) -> None:
        status = require_maya_source()
        self.assertTrue(status["identity_lock"])
        self.assertEqual(
            status["source_sha256"],
            "a357abc29cfbed4de941eef2053d7d69c98ce5fc444f6f69534d1ef5ec862aeb",
        )
        self.assertTrue(status["prompt_ready"])
        self.assertTrue(Path(status["source"]).is_file())

    def test_pipeline_dry_run(self) -> None:
        report = dry_run_report()
        self.assertTrue(report["ok"])
        self.assertEqual(report["paid_generations"], 0)
        self.assertTrue(report["maya"]["identity_lock"])
        self.assertTrue(report["portrait_9_16"])
        self.assertGreater(report["sample_mp4_bytes"], 1000)

    def test_existing_video01_generator_dry_run(self) -> None:
        proc = subprocess.run(
            [sys.executable, str(MAYA / "scripts" / "generate_video01.py")],
            cwd=str(MAYA),
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        self.assertIn("DRY RUN COMPLETE", proc.stdout)
        self.assertIn("PAID GENERATIONS MADE: 0", proc.stdout)
        self.assertIn("9:16", proc.stdout)

    def test_execute_without_confirm_does_not_submit(self) -> None:
        proc = subprocess.run(
            [sys.executable, str(MAYA / "scripts" / "generate_video01.py"), "--execute"],
            cwd=str(MAYA),
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(proc.returncode, 2, proc.stdout + proc.stderr)
        self.assertIn("EXECUTE REFUSED", proc.stdout)

    def test_maya_local_dry_run_job(self) -> None:
        from video_agent.jobs import new_job
        from video_agent.pipeline import run_job

        maya = require_maya_source()
        job = new_job(
            {
                "prompt": maya["prompt"],
                "negative_prompt": maya["negative_prompt"],
                "mode": "image_to_video",
                "aspect_ratio": "9:16",
                "duration": 6,
                "quality": "720p",
                "dry_run": True,
                "maya": True,
                "image_path": None,
                "provider_id": "local_ffmpeg",
            }
        )
        result = run_job(job["id"])
        self.assertEqual(result["status"], "COMPLETED", result)
        self.assertTrue(result.get("identity_lock"))
        self.assertEqual(
            result.get("source_sha256"),
            "a357abc29cfbed4de941eef2053d7d69c98ce5fc444f6f69534d1ef5ec862aeb",
        )
        self.assertTrue(Path(result["output_path"]).is_file())

    def test_accept_pass_without_video(self) -> None:
        proc = subprocess.run(
            [sys.executable, str(MAYA / "scripts" / "accept_video01.py"), "PASS"],
            cwd=str(MAYA),
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(proc.returncode, 2)
        self.assertIn("does not exist", proc.stderr)


if __name__ == "__main__":
    unittest.main()
