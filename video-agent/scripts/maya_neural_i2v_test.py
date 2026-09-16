#!/usr/bin/env python3
"""One real Maya neural I2V attempt. Not a dry-run. Does not modify the source PNG."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from video_agent.jobs import new_job, save_job  # noqa: E402
from video_agent.maya import require_maya_source  # noqa: E402
from video_agent.neural_spec import MAYA_NEURAL_NEGATIVE, MAYA_NEURAL_PROMPT, OUTPUT_DIR  # noqa: E402
from video_agent.pipeline import run_job  # noqa: E402

OUT = OUTPUT_DIR / "maya_neural_i2v_test_01.mp4"
REPORT = OUTPUT_DIR / "maya_neural_i2v_test_01.json"


def ffprobe(path: Path) -> dict:
    proc = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            str(path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    return json.loads(proc.stdout or "{}")


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    maya = require_maya_source()
    started = time.time()
    job = new_job(
        {
            "prompt": MAYA_NEURAL_PROMPT,
            "negative_prompt": MAYA_NEURAL_NEGATIVE,
            "mode": "image_to_video",
            "aspect_ratio": "9:16",
            "duration": 3,
            "quality": "720p",
            "dry_run": False,
            "maya": True,
            "image_path": maya["source"],
            "engine": "local_ai",
            "seed": 42,
        }
    )
    save_job(job)
    result = run_job(job["id"])
    elapsed = round(time.time() - started, 2)
    probe = {}
    copied = None
    if result.get("status") == "COMPLETED" and result.get("output_path"):
        src = Path(result["output_path"])
        shutil.copy2(src, OUT)
        copied = str(OUT)
        probe = ffprobe(OUT)
    report = {
        "pass": result.get("status") == "COMPLETED",
        "job_status": result.get("status"),
        "error": result.get("error"),
        "error_code": result.get("error_code"),
        "engine": result.get("engine"),
        "engine_label": result.get("engine_label"),
        "ai_generated": result.get("ai_generated"),
        "source_sha256": result.get("source_sha256") or maya["source_sha256"],
        "identity_lock": maya["identity_lock"],
        "generation_seconds": elapsed,
        "output": copied,
        "ffprobe": probe,
        "job_id": job["id"],
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0 if report["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
