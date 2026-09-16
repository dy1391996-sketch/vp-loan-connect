"""Classify where THIS Python process is running. Do not assume it is the user's Mac."""

from __future__ import annotations

import os
import platform
from pathlib import Path
from typing import Any


def classify_execution() -> dict[str, Any]:
    docker = Path("/.dockerenv").exists()
    cgroup = ""
    cgroup_path = Path("/proc/1/cgroup")
    if cgroup_path.is_file():
        cgroup = cgroup_path.read_text(encoding="utf-8", errors="replace")[:400]
    hypervisor = False
    cpuinfo = Path("/proc/cpuinfo")
    if cpuinfo.is_file():
        hypervisor = "hypervisor" in cpuinfo.read_text(encoding="utf-8", errors="replace")
    cursor_agent = bool(os.environ.get("CURSOR_AGENT"))
    hostname = platform.node()
    system = platform.system()
    machine = platform.machine()
    if (cursor_agent or hostname == "cursor") and (docker or hypervisor):
        kind = "cursor_cloud_container"
        physical_host = False
        summary = (
            "This process is a Cursor Cloud Agent Linux container (KVM), "
            "not the physical Mac. Neural I2V must run on a local worker "
            "(Apple Silicon / NVIDIA), not inside this VM."
        )
    elif system == "Darwin":
        kind = "macos_host"
        physical_host = True
        summary = "This process is running on macOS (the machine that launched Python)."
    elif docker:
        kind = "linux_container"
        physical_host = False
        summary = "This process is a Linux container."
    else:
        kind = "linux_or_other_host"
        physical_host = True
        summary = f"This process is running on {system} {machine}."
    return {
        "kind": kind,
        "physical_host": physical_host,
        "cursor_cloud": kind == "cursor_cloud_container",
        "docker": docker,
        "hypervisor": hypervisor,
        "hostname": hostname,
        "system": system,
        "arch": machine,
        "user": os.environ.get("USER") or "",
        "pwd": str(Path.cwd()),
        "home": os.environ.get("HOME") or "",
        "cgroup_preview": cgroup.strip().splitlines()[:3],
        "summary": summary,
    }
