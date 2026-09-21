"""Inspect local neural venv / device / weights without importing torch in the agent."""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any

from .execution import classify_execution
from .neural_spec import (
    DISK_GB,
    DOWNLOAD_GB,
    HF_HOME,
    MODEL_ID,
    MODEL_NAME,
    RAM_GB_MINIMUM,
    RAM_GB_RECOMMENDED,
    VENV_DIR,
    estimate_requirements,
)
from .worker_client import probe_worker


def _venv_python() -> Path | None:
    if os.name == "nt":
        candidate = VENV_DIR / "Scripts" / "python.exe"
    else:
        candidate = VENV_DIR / "bin" / "python"
    return candidate if candidate.is_file() else None


def _probe_torch(python: Path) -> dict[str, Any]:
    code = r"""
import json, platform
info = {
  "import_ok": False,
  "torch": None,
  "mps_built": False,
  "mps_available": False,
  "cuda": False,
  "cuda_name": None,
  "error": None,
}
try:
    import torch
    info["import_ok"] = True
    info["torch"] = torch.__version__
    mps = getattr(torch.backends, "mps", None)
    info["mps_built"] = bool(mps and mps.is_built())
    info["mps_available"] = bool(mps and mps.is_available())
    info["cuda"] = bool(torch.cuda.is_available())
    if info["cuda"]:
        info["cuda_name"] = torch.cuda.get_device_name(0)
except Exception as exc:
    info["error"] = f"{type(exc).__name__}: {exc}"
print(json.dumps(info))
"""
    try:
        proc = subprocess.run(
            [str(python), "-c", code],
            capture_output=True,
            text=True,
            timeout=20,
            env={**os.environ, "HF_HOME": str(HF_HOME)},
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {"import_ok": False, "error": str(exc)}
    if proc.returncode != 0:
        return {"import_ok": False, "error": (proc.stderr or proc.stdout)[-400:]}
    try:
        return json.loads(proc.stdout.strip().splitlines()[-1])
    except json.JSONDecodeError:
        return {"import_ok": False, "error": proc.stdout[-400:]}


def weights_present() -> bool:
    if not HF_HOME.is_dir():
        return False
    for path in HF_HOME.rglob("*"):
        if path.is_file() and path.suffix.lower() in {".safetensors", ".bin"} and path.stat().st_size > 50_000_000:
            return True
    return False


def check_neural_environment() -> dict[str, Any]:
    from .hardware import detect_hardware

    hw = detect_hardware()
    exe = classify_execution()
    worker = probe_worker()
    python = _venv_python()
    torch_info = _probe_torch(python) if python else {"import_ok": False, "error": "neural venv not installed"}
    local_device = None
    if torch_info.get("mps_available"):
        local_device = "mps"
    elif torch_info.get("cuda"):
        local_device = "cuda"
    weights = weights_present()
    local_ready = bool(python and torch_info.get("import_ok") and local_device and weights)
    worker_ready = bool(worker.get("neural_available"))
    available = local_ready or worker_ready
    if local_ready:
        reason = f"Local AI ready on this process ({local_device}, {MODEL_NAME})."
    elif worker_ready:
        reason = f"Local AI worker ready at {worker.get('url')}."
    elif exe.get("cursor_cloud"):
        reason = (
            "LOCAL AI VIDEO NOT AVAILABLE in this Cursor Cloud Linux container "
            "(CPU-only, no MPS/CUDA). Start the worker on Deepak's MacBook Air: "
            "video-agent/scripts/install-neural.sh && video-agent/scripts/start-local-video-worker.sh"
        )
    elif not python:
        reason = "Neural venv is not installed. On Apple Silicon / NVIDIA, run scripts/install-neural.sh."
    elif not torch_info.get("import_ok"):
        reason = f"PyTorch is not importable in the neural venv: {torch_info.get('error')}"
    elif not local_device:
        reason = (
            "No MPS and no CUDA in the neural venv. CPU neural I2V is not enabled. "
            "Use an Apple Silicon Mac or an NVIDIA GPU worker."
        )
    elif not weights:
        reason = (
            f"{MODEL_NAME} weights are not downloaded yet "
            f"(~{DOWNLOAD_GB} GB download, ~{DISK_GB} GB disk, {RAM_GB_RECOMMENDED} GB RAM recommended). "
            "Run scripts/install-neural.sh on a capable machine."
        )
    else:
        reason = "Local AI video is not available."
    if hw.get("ram_gb") and hw["ram_gb"] < RAM_GB_MINIMUM and local_device == "mps":
        reason += f" Warning: {hw['ram_gb']} GB RAM is below the {RAM_GB_MINIMUM} GB practical minimum."
    return {
        "available": available,
        "reason": reason,
        "local_ready": local_ready,
        "worker_ready": worker_ready,
        "local_device": local_device,
        "venv_python": str(python) if python else None,
        "weights_present": weights,
        "torch": torch_info,
        "worker": worker,
        "execution": exe,
        "model": estimate_requirements(),
        "ui_label": "AVAILABLE" if available else "NOT AVAILABLE",
    }
