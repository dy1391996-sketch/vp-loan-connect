#!/usr/bin/env python3
"""Verify Python, FFmpeg, disk, Maya source, and output directories."""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
sys.path.insert(0, str(SRC))

from video_agent.errors import FFmpegUnavailableError, MissingImageError, VideoAgentError  # noqa: E402
from video_agent.ffmpeg_tools import ffmpeg_version, require_ffmpeg  # noqa: E402
from video_agent.hardware import detect_hardware  # noqa: E402
from video_agent.maya import require_maya_source  # noqa: E402
from video_agent.paths import ensure_dirs  # noqa: E402


def main() -> int:
    hw = detect_hardware()
    print(f"OS: {hw['os']} {hw['arch']}")
    print(f"Python: {hw['python']}")
    print(f"Node: {hw['node']}")
    print(f"RAM: {hw['ram_gb']} GB")
    print(f"Disk free: {hw['disk_free_gb']} GB")
    try:
        require_ffmpeg()
        print(f"FFmpeg: {ffmpeg_version()}")
    except FFmpegUnavailableError as exc:
        print(exc.message, file=sys.stderr)
        return 2
    if not hw["ffmpeg"]["h264"]:
        print("FFmpeg is present but libx264 is missing. H.264 output will fail.", file=sys.stderr)
        return 2
    ensure_dirs()
    try:
        maya = require_maya_source()
        print(f"Maya identity lock: {maya['identity_lock']}")
        print(f"Maya SHA256: {maya['source_sha256']}")
    except (MissingImageError, VideoAgentError) as exc:
        print(f"Maya source: {exc}", file=sys.stderr)
        return 2
    if shutil.disk_usage(ROOT).free < 200 * 1024 * 1024:
        print("Need at least 200 MB free disk.", file=sys.stderr)
        return 2
    print("Dependencies OK. Paid APIs are not required.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
