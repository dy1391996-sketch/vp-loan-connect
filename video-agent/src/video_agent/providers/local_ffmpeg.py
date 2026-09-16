"""Free local engine: FFmpeg identity-preserving motion. Always preferred on CPU hosts."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from ..errors import MissingImageError, ModelUnavailableError
from ..ffmpeg_tools import RESOLUTIONS, still_to_motion, text_to_motion
from ..images import require_image
from .base import GenerateRequest, ProgressCb, VideoProvider


class LocalFFmpegProvider(VideoProvider):
    id = "local_ffmpeg"
    name = "Local FFmpeg motion (free)"
    paid = False

    def validate(self, request: GenerateRequest) -> dict[str, Any]:
        from ..ffmpeg_tools import ffmpeg_version, require_ffmpeg

        require_ffmpeg()
        image = require_image(request.image_path, mode=request.mode)
        width, height = RESOLUTIONS.get(request.quality, RESOLUTIONS["720p"])
        return {
            "provider": self.id,
            "paid": False,
            "ffmpeg": ffmpeg_version(),
            "image": image,
            "width": width,
            "height": height,
            "duration": 1.0 if request.dry_run else request.duration,
            "neural": False,
            "identity_preserving": request.mode == "image_to_video",
            "notes": [
                "This engine animates the supplied still with a slow camera move.",
                "It does not redesign the face, body, or outfit.",
                "It cannot invent new expressions or poses; those need a neural model + GPU.",
            ],
        }

    def generate_from_text(
        self,
        request: GenerateRequest,
        dest: Path,
        progress: ProgressCb | None = None,
    ) -> Path:
        width, height = RESOLUTIONS.get(request.quality, RESOLUTIONS["720p"])
        if progress:
            progress("generating", 45, "Encoding local text motion graphic (not a neural T2V model).")
        return text_to_motion(
            request.prompt,
            dest,
            width=width,
            height=height,
            duration=request.duration,
            dry_run=request.dry_run,
        )

    def generate_from_image(
        self,
        request: GenerateRequest,
        dest: Path,
        progress: ProgressCb | None = None,
    ) -> Path:
        if request.image_path is None:
            raise MissingImageError("Image-to-video requires a reference image.")
        width, height = RESOLUTIONS.get(request.quality, RESOLUTIONS["720p"])
        if progress:
            progress("generating", 45, "Encoding identity-preserving 9:16 motion from the source still.")
        return still_to_motion(
            request.image_path,
            dest,
            width=width,
            height=height,
            duration=request.duration,
            dry_run=request.dry_run,
        )

    def get_status(self) -> dict[str, Any]:
        from ..ffmpeg_tools import ffmpeg_version, require_ffmpeg
        from ..errors import FFmpegUnavailableError

        try:
            require_ffmpeg()
            usable = True
            detail = ffmpeg_version()
        except FFmpegUnavailableError as exc:
            usable = False
            detail = exc.message
        return {
            "id": self.id,
            "name": self.name,
            "paid": False,
            "usable": usable,
            "image_to_video": usable,
            "text_to_video": usable,
            "portrait_9_16": True,
            "neural": False,
            "detail": detail,
        }


def require_local_ffmpeg() -> LocalFFmpegProvider:
    status = LocalFFmpegProvider().get_status()
    if not status["usable"]:
        raise ModelUnavailableError(status["detail"])
    return LocalFFmpegProvider()
