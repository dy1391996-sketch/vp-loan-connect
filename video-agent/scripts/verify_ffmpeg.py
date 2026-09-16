#!/usr/bin/env python3
"""Confirm FFmpeg can write a 9:16 H.264 MP4."""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from video_agent.ffmpeg_tools import still_to_motion, validate_mp4  # noqa: E402
from video_agent.maya import require_maya_source  # noqa: E402


def main() -> int:
    maya = require_maya_source()
    with tempfile.TemporaryDirectory() as tmp:
        dest = Path(tmp) / "probe.mp4"
        still_to_motion(
            Path(maya["source"]),
            dest,
            width=720,
            height=1280,
            duration=1,
            dry_run=True,
        )
        info = validate_mp4(dest, expect_w=720, expect_h=1280, min_duration=0.4)
        print("9:16 H.264 probe:", info)
    print("FFmpeg path OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
