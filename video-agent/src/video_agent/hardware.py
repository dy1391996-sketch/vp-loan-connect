"""Detect the actual machine before choosing a generation engine."""

from __future__ import annotations

import os
import platform
import shutil
import subprocess
from pathlib import Path
from typing import Any


def _run(cmd: list[str], timeout: int = 8) -> str:
    try:
        proc = subprocess.run(
            cmd,
            check=False,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except (OSError, subprocess.TimeoutExpired):
        return ""
    return (proc.stdout or proc.stderr or "").strip()


def _first_line(text: str) -> str:
    return text.splitlines()[0].strip() if text else ""


def _cpu_model() -> str:
    if platform.system() == "Darwin":
        return _run(["sysctl", "-n", "machdep.cpu.brand_string"]) or platform.processor()
    cpuinfo = Path("/proc/cpuinfo")
    if cpuinfo.is_file():
        for line in cpuinfo.read_text(encoding="utf-8", errors="replace").splitlines():
            if line.lower().startswith("model name"):
                return line.split(":", 1)[-1].strip()
    return platform.processor() or "unknown"


def _ram_gb() -> float:
    if hasattr(os, "sysconf"):
        try:
            pages = os.sysconf("SC_PHYS_PAGES")
            page_size = os.sysconf("SC_PAGE_SIZE")
            if pages and page_size:
                return round((pages * page_size) / (1024**3), 2)
        except (ValueError, OSError):
            pass
    return 0.0


def _disk_free_gb(path: Path) -> float:
    usage = shutil.disk_usage(path)
    return round(usage.free / (1024**3), 2)


def _nvidia() -> dict[str, Any] | None:
    text = _run(["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader"])
    if not text:
        return None
    line = _first_line(text)
    name, _, memory = line.partition(",")
    return {"vendor": "nvidia", "name": name.strip(), "memory": memory.strip()}


def _apple_silicon() -> bool:
    return platform.system() == "Darwin" and platform.machine().lower() in {"arm64", "aarch64"}


def _ffmpeg_info() -> dict[str, Any]:
    version_line = _first_line(_run(["ffmpeg", "-version"]))
    probe_line = _first_line(_run(["ffprobe", "-version"]))
    encoders = _run(["ffmpeg", "-hide_banner", "-encoders"], timeout=12)
    return {
        "present": version_line.lower().startswith("ffmpeg version"),
        "ffprobe": probe_line.lower().startswith("ffprobe version"),
        "version": version_line or "MISSING",
        "h264": "libx264" in encoders,
        "aac": "aac" in encoders,
    }


def detect_hardware(data_root: Path | None = None) -> dict[str, Any]:
    """Return a JSON-serialisable snapshot of this machine."""
    root = data_root or Path.cwd()
    ffmpeg = _ffmpeg_info()
    gpu = _nvidia()
    apple = _apple_silicon()
    ram_gb = _ram_gb()
    disk_gb = _disk_free_gb(root)
    cpu_count = os.cpu_count() or 1
    neural_viable = bool(gpu) or (apple and ram_gb >= 16)
    if neural_viable and gpu:
        engine = "local_diffusion"
        reason = f"NVIDIA GPU detected ({gpu['name']}). Local neural image-to-video may be attempted."
    elif neural_viable and apple:
        engine = "local_diffusion"
        reason = "Apple Silicon with enough RAM detected. A Metal-backed local model may be attempted on this Mac."
    else:
        engine = "local_ffmpeg"
        if not gpu and not apple:
            reason = (
                "No GPU and not Apple Silicon. Neural image-to-video is not realistic here. "
                "The free local engine is FFmpeg identity-preserving motion from a still (camera move, not face redesign)."
            )
        else:
            reason = (
                "Hardware is borderline for local diffusion. "
                "Defaulting to the free FFmpeg motion engine."
            )
    return {
        "os": platform.system(),
        "os_release": platform.release(),
        "arch": platform.machine(),
        "cpu": _cpu_model(),
        "cpu_count": cpu_count,
        "ram_gb": ram_gb,
        "gpu": gpu,
        "apple_silicon": apple,
        "metal": apple,
        "python": platform.python_version(),
        "node": _first_line(_run(["node", "-v"])) or "MISSING",
        "ffmpeg": ffmpeg,
        "disk_free_gb": disk_gb,
        "recommended_engine": engine,
        "neural_i2v_viable": neural_viable,
        "reason": reason,
    }
