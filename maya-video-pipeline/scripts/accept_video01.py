#!/usr/bin/env python3
"""Accept or reject Maya Video #1 after human QC.

Usage:
  python scripts/accept_video01.py PASS
  python scripts/accept_video01.py REJECT

A rejected clip never triggers another generation.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path


PIPELINE_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = PIPELINE_ROOT / "generations" / "video01"
VIDEO_PATH = OUTPUT_DIR / "video01.mp4"
META_PATH = OUTPUT_DIR / "metadata.json"
ACCEPTED_PATH = OUTPUT_DIR / "ACCEPTED.json"
REJECTED_PATH = OUTPUT_DIR / "REJECTED.json"


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def main(argv: list[str]) -> int:
    if len(argv) != 2 or argv[1] not in {"PASS", "REJECT"}:
        print("Usage:", file=sys.stderr)
        print("  python scripts/accept_video01.py PASS", file=sys.stderr)
        print("  python scripts/accept_video01.py REJECT", file=sys.stderr)
        return 2

    decision = argv[1]
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    if decision == "PASS" and not VIDEO_PATH.is_file():
        print("PASS refused: generations/video01/video01.mp4 does not exist.", file=sys.stderr)
        return 2

    payload = {
        "clip": "VIDEO01",
        "decision": decision,
        "decided_at": utc_now(),
        "video_present": VIDEO_PATH.is_file(),
        "metadata_present": META_PATH.is_file(),
        "triggers_another_generation": False,
    }

    if decision == "PASS":
        if REJECTED_PATH.exists():
            REJECTED_PATH.unlink()
        ACCEPTED_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        print("WROTE", ACCEPTED_PATH)
        return 0

    if ACCEPTED_PATH.exists():
        ACCEPTED_PATH.unlink()
    REJECTED_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print("WROTE", REJECTED_PATH)
    print("Rejected clip will not trigger another generation.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
