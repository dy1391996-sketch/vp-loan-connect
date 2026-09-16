"""Local neural diffusion provider.

Never pretends to run when this machine cannot support it.
Optional: used only if a GPU / Apple Silicon path is actually viable.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from ..errors import ModelUnavailableError
from ..hardware import detect_hardware
from .base import GenerateRequest, ProgressCb, VideoProvider


class LocalDiffusionProvider(VideoProvider):
    id = "local_diffusion"
    name = "Local open-source diffusion (free, GPU required)"
    paid = False

    def _unavailable(self) -> ModelUnavailableError:
        hw = detect_hardware()
        return ModelUnavailableError(
            "Local neural image-to-video is not available on this machine. "
            + hw["reason"],
            details={
                "gpu": hw.get("gpu"),
                "apple_silicon": hw.get("apple_silicon"),
                "ram_gb": hw.get("ram_gb"),
                "recommended_engine": hw.get("recommended_engine"),
            },
        )

    def validate(self, request: GenerateRequest) -> dict[str, Any]:
        hw = detect_hardware()
        if not hw.get("neural_i2v_viable"):
            raise self._unavailable()
        raise ModelUnavailableError(
            "A GPU/Apple Silicon path was detected, but no local diffusion weights "
            "are installed in this project. The agent will not download multi-GB "
            "models unless you add them yourself. Use the free FFmpeg engine, or "
            "install a local model on a capable machine.",
            details={"recommended_engine": "local_ffmpeg"},
        )

    def generate_from_text(self, request: GenerateRequest, dest: Path, progress: ProgressCb | None = None) -> Path:
        raise self._unavailable()

    def generate_from_image(self, request: GenerateRequest, dest: Path, progress: ProgressCb | None = None) -> Path:
        raise self._unavailable()

    def get_status(self) -> dict[str, Any]:
        hw = detect_hardware()
        return {
            "id": self.id,
            "name": self.name,
            "paid": False,
            "usable": False,
            "image_to_video": False,
            "text_to_video": False,
            "portrait_9_16": True,
            "neural": True,
            "detail": hw["reason"],
        }
