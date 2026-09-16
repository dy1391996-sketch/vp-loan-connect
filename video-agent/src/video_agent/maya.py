"""Maya Video #1 workflow adapter. Does not replace the approved start frame."""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

from .errors import CorruptImageError, MissingImageError, VideoAgentError
from .paths import MAYA_ROOT

SOURCE = MAYA_ROOT / "sources" / "video01-approved-start.png"
SOURCE_SHA = MAYA_ROOT / "sources" / "video01-approved-start.sha256"
PROMPT = MAYA_ROOT / "prompts" / "video01-final.txt"
NEGATIVE = MAYA_ROOT / "prompts" / "video01-negative.txt"
GENERATOR = MAYA_ROOT / "scripts" / "generate_video01.py"
ACCEPT = MAYA_ROOT / "scripts" / "accept_video01.py"


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_expected_sha() -> str:
    if not SOURCE_SHA.is_file():
        raise MissingImageError(f"Maya SHA256 lock file is missing: {SOURCE_SHA}")
    text = SOURCE_SHA.read_text(encoding="utf-8").split()[0].strip().lower()
    if len(text) != 64:
        raise CorruptImageError(f"Invalid Maya SHA256 lock file: {SOURCE_SHA}")
    return text


def maya_status() -> dict[str, Any]:
    present = SOURCE.is_file()
    sha = file_sha256(SOURCE) if present else None
    expected = load_expected_sha() if SOURCE_SHA.is_file() else None
    locked = bool(sha and expected and sha == expected)
    prompt = PROMPT.read_text(encoding="utf-8").strip() if PROMPT.is_file() else ""
    negative = NEGATIVE.read_text(encoding="utf-8").strip() if NEGATIVE.is_file() else ""
    return {
        "clip": "VIDEO01",
        "source": str(SOURCE),
        "source_present": present,
        "source_sha256": sha,
        "expected_sha256": expected,
        "identity_lock": locked,
        "prompt_ready": bool(prompt),
        "negative_ready": bool(negative),
        "prompt": prompt,
        "negative_prompt": negative,
        "generator": str(GENERATOR),
        "accept_script": str(ACCEPT),
        "paid_cli": "python3 scripts/generate_video01.py --execute --confirm VIDEO01",
        "dry_run_cli": "python3 scripts/generate_video01.py",
    }


def require_maya_source() -> dict[str, Any]:
    status = maya_status()
    if not status["source_present"]:
        raise MissingImageError(
            "Maya Video #1 approved start frame is missing. "
            "It was registered at maya-video-pipeline/sources/video01-approved-start.png "
            "and must not be replaced."
        )
    if not status["identity_lock"]:
        raise VideoAgentError(
            "Maya Video #1 source SHA256 does not match the registered lock. "
            "Refusing to continue so the approved identity is not replaced.",
            details={
                "computed": status["source_sha256"],
                "expected": status["expected_sha256"],
            },
        )
    return status
