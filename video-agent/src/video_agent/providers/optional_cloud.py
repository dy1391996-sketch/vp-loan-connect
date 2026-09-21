"""Optional paid cloud probes — never the default engine.

Reuses the Maya Video #1 probe functions. The agent UI cannot spend credits.
Paid execute remains CLI-only: generate_video01.py --execute --confirm VIDEO01
"""

from __future__ import annotations

import importlib.util
from typing import Any

from ..errors import ModelUnavailableError
from ..paths import MAYA_ROOT
from .base import GenerateRequest, ProgressCb, VideoProvider

MAYA_SCRIPT = MAYA_ROOT / "scripts" / "generate_video01.py"


def _load_maya_module():
    if not MAYA_SCRIPT.is_file():
        return None
    spec = importlib.util.spec_from_file_location("maya_generate_video01", MAYA_SCRIPT)
    if spec is None or spec.loader is None:
        return None
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def probe_optional_cloud() -> list[dict[str, Any]]:
    mod = _load_maya_module()
    if mod is None:
        return []
    probes = []
    for fn_name in ("probe_google", "probe_runway", "probe_fal", "probe_replicate", "probe_luma"):
        fn = getattr(mod, fn_name, None)
        if callable(fn):
            probes.append(fn())
    return probes


class OptionalCloudProvider(VideoProvider):
    id = "optional_cloud"
    name = "Optional paid cloud (disabled in the agent UI)"
    paid = True

    def validate(self, request: GenerateRequest) -> dict[str, Any]:
        raise ModelUnavailableError(
            "Paid cloud providers are not used by the Video Agent UI. "
            "They stay optional and isolated. For Maya Video #1 paid generation, run "
            "maya-video-pipeline/scripts/generate_video01.py --execute --confirm VIDEO01 "
            "after a usable account is confirmed."
        )

    def generate_from_text(self, request: GenerateRequest, dest: Path, progress: ProgressCb | None = None) -> Path:
        raise self.validate(request)

    def generate_from_image(self, request: GenerateRequest, dest: Path, progress: ProgressCb | None = None) -> Path:
        raise self.validate(request)

    def get_status(self) -> dict[str, Any]:
        probes = probe_optional_cloud()
        usable_paid = [p for p in probes if p.get("usable")]
        return {
            "id": self.id,
            "name": self.name,
            "paid": True,
            "usable": False,
            "image_to_video": False,
            "text_to_video": False,
            "portrait_9_16": True,
            "neural": True,
            "detail": (
                "UI will not submit paid requests. "
                + (
                    f"{len(usable_paid)} paid probe(s) look authenticated; still not selected."
                    if usable_paid
                    else "No usable paid provider in this environment."
                )
            ),
            "probes": [
                {
                    "id": p.get("id"),
                    "name": p.get("name"),
                    "configured": p.get("configured"),
                    "auth": p.get("auth"),
                    "usable": p.get("usable"),
                    "balance": p.get("balance"),
                }
                for p in probes
            ],
        }
