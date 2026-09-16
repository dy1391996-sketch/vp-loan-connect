"""Filesystem layout for the isolated video agent."""

from __future__ import annotations

from pathlib import Path

AGENT_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = AGENT_ROOT.parent
MAYA_ROOT = REPO_ROOT / "maya-video-pipeline"
DATA_ROOT = AGENT_ROOT / "data"
UPLOADS = DATA_ROOT / "uploads"
OUTPUTS = DATA_ROOT / "outputs"
JOBS = DATA_ROOT / "jobs"
TMP = DATA_ROOT / "tmp"
WEB_ROOT = AGENT_ROOT / "web"


def ensure_dirs() -> None:
    for path in (UPLOADS, OUTPUTS, JOBS, TMP):
        path.mkdir(parents=True, exist_ok=True)
