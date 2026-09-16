"""JSON job store + cooperative lifecycle."""

from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .errors import JobNotFoundError
from .paths import JOBS, OUTPUTS, ensure_dirs

STATUSES = (
    "QUEUED",
    "PREPARING",
    "VALIDATING",
    "LOADING_MODEL",
    "RUNNING",
    "POST_PROCESSING",
    "COMPLETED",
    "FAILED",
    "CANCELLED",
)

UI_STATUS = {
    "QUEUED": "preparing",
    "PREPARING": "preparing",
    "VALIDATING": "validating",
    "LOADING_MODEL": "loading model",
    "RUNNING": "generating",
    "POST_PROCESSING": "processing",
    "COMPLETED": "completed",
    "FAILED": "failed",
    "CANCELLED": "failed",
}

_lock = threading.Lock()


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _job_path(job_id: str) -> Path:
    return JOBS / f"{job_id}.json"


def new_job(payload: dict[str, Any]) -> dict[str, Any]:
    ensure_dirs()
    job_id = uuid.uuid4().hex
    job = {
        "id": job_id,
        "status": "QUEUED",
        "ui_status": UI_STATUS["QUEUED"],
        "progress": 1,
        "message": "Job queued.",
        "created_at": utc_now(),
        "updated_at": utc_now(),
        "error": None,
        "error_code": None,
        "output_path": None,
        "output_url": f"/api/jobs/{job_id}/video",
        "cancel_requested": False,
        **payload,
    }
    save_job(job)
    return job


def save_job(job: dict[str, Any]) -> dict[str, Any]:
    ensure_dirs()
    job["updated_at"] = utc_now()
    job["ui_status"] = UI_STATUS.get(job.get("status", ""), job.get("ui_status") or "preparing")
    path = _job_path(job["id"])
    tmp = path.with_suffix(".tmp")
    with _lock:
        tmp.write_text(json.dumps(job, indent=2) + "\n", encoding="utf-8")
        tmp.replace(path)
    return job


def load_job(job_id: str) -> dict[str, Any]:
    path = _job_path(job_id)
    if not path.is_file():
        raise JobNotFoundError(f"Job {job_id} was not found.")
    return json.loads(path.read_text(encoding="utf-8"))


def list_jobs(limit: int = 40) -> list[dict[str, Any]]:
    ensure_dirs()
    files = sorted(JOBS.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    jobs = []
    for path in files[:limit]:
        try:
            jobs.append(json.loads(path.read_text(encoding="utf-8")))
        except json.JSONDecodeError:
            continue
    return jobs


def update_job(job_id: str, **fields: Any) -> dict[str, Any]:
    job = load_job(job_id)
    job.update(fields)
    return save_job(job)


def request_cancel(job_id: str) -> dict[str, Any]:
    job = load_job(job_id)
    if job["status"] in {"COMPLETED", "FAILED", "CANCELLED"}:
        return job
    job["cancel_requested"] = True
    if job["status"] == "QUEUED":
        job["status"] = "CANCELLED"
        job["message"] = "Cancelled before generation started."
        job["progress"] = 0
    return save_job(job)


def is_cancelled(job_id: str) -> bool:
    try:
        job = load_job(job_id)
    except JobNotFoundError:
        return True
    return bool(job.get("cancel_requested") or job.get("status") == "CANCELLED")


def output_file(job_id: str) -> Path:
    return OUTPUTS / f"{job_id}.mp4"
