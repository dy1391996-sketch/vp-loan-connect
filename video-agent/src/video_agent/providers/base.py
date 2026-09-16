"""Provider abstraction. The rest of the app talks to this layer only."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Literal

Mode = Literal["text_to_video", "image_to_video"]
ProgressCb = Callable[[str, int, str], None]


@dataclass
class GenerateRequest:
    prompt: str
    mode: Mode
    image_path: Path | None = None
    negative_prompt: str = ""
    aspect_ratio: str = "9:16"
    duration: float = 6.0
    quality: str = "720p"
    dry_run: bool = False
    identity_lock: bool = False
    extra: dict[str, Any] = field(default_factory=dict)


class VideoProvider(ABC):
    id: str
    name: str
    paid: bool = False

    @abstractmethod
    def validate(self, request: GenerateRequest) -> dict[str, Any]:
        """Validate inputs and local dependencies. Must not generate."""

    @abstractmethod
    def generate_from_text(self, request: GenerateRequest, dest: Path, progress: ProgressCb | None = None) -> Path:
        """TEXT → VIDEO."""

    @abstractmethod
    def generate_from_image(self, request: GenerateRequest, dest: Path, progress: ProgressCb | None = None) -> Path:
        """IMAGE + PROMPT → VIDEO."""

    @abstractmethod
    def get_status(self) -> dict[str, Any]:
        """Provider availability, not a job poll."""

    def cancel(self, job_id: str) -> None:
        """Optional. Default is cooperative cancel via the job runner."""
        return None

    def cancel_generation(self, job_id: str) -> None:
        return self.cancel(job_id)

    def check_environment(self) -> dict[str, Any]:
        return self.get_status()

    def estimate_requirements(self) -> dict[str, Any]:
        return {"paid": self.paid}
