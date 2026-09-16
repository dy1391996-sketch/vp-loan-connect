"""Resolve AUTO / LOCAL AI / FFMPEG MOTION without changing paid-cloud policy."""

from __future__ import annotations

from typing import Any

from .errors import ModelUnavailableError, VideoAgentError
from .providers import get_provider
from .providers.base import VideoProvider
from .providers.local_ffmpeg import LocalFFmpegProvider
from .providers.local_neural import LocalNeuralVideoProvider

ENGINE_AUTO = "auto"
ENGINE_LOCAL_AI = "local_ai"
ENGINE_FFMPEG = "ffmpeg_motion"

ENGINE_LABELS = {
    ENGINE_LOCAL_AI: "Local AI (LTX-Video)",
    ENGINE_FFMPEG: "FFmpeg motion (not AI generated)",
}


def normalize_engine(value: str | None) -> str:
    raw = (value or ENGINE_AUTO).strip().lower().replace("-", "_")
    aliases = {
        "auto": ENGINE_AUTO,
        "local_ai": ENGINE_LOCAL_AI,
        "localai": ENGINE_LOCAL_AI,
        "neural": ENGINE_LOCAL_AI,
        "local_neural": ENGINE_LOCAL_AI,
        "ffmpeg": ENGINE_FFMPEG,
        "ffmpeg_motion": ENGINE_FFMPEG,
        "local_ffmpeg": ENGINE_FFMPEG,
    }
    if raw not in aliases:
        raise VideoAgentError(f"Unknown engine '{value}'. Use auto, local_ai, or ffmpeg_motion.")
    return aliases[raw]


def resolve_engine(
    requested: str | None,
    *,
    provider_id: str | None = None,
    recommended_engine: str = "local_ffmpeg",
) -> tuple[str, VideoProvider, str]:
    """Return (engine_id, provider, reason)."""
    if provider_id == LocalFFmpegProvider.id and not requested:
        return ENGINE_FFMPEG, LocalFFmpegProvider(), "Explicit FFmpeg provider."
    if provider_id == LocalNeuralVideoProvider.id and not requested:
        requested = ENGINE_LOCAL_AI
    engine = normalize_engine(requested)
    neural = LocalNeuralVideoProvider()
    status = neural.get_status()
    if engine == ENGINE_FFMPEG:
        return ENGINE_FFMPEG, LocalFFmpegProvider(), ENGINE_LABELS[ENGINE_FFMPEG]
    if engine == ENGINE_LOCAL_AI:
        if not status.get("usable"):
            raise ModelUnavailableError(
                "LOCAL AI was selected, but it is not available. " + str(status.get("detail") or ""),
                details=status,
            )
        return ENGINE_LOCAL_AI, neural, ENGINE_LABELS[ENGINE_LOCAL_AI]
    # AUTO
    if status.get("usable"):
        return ENGINE_LOCAL_AI, neural, "AUTO chose Local AI because the neural backend is available."
    ffmpeg = get_provider(LocalFFmpegProvider.id, recommended_engine)
    return ENGINE_FFMPEG, ffmpeg, "AUTO chose FFmpeg motion because Local AI is not available."


def engine_public_status() -> dict[str, Any]:
    neural = LocalNeuralVideoProvider().get_status()
    return {
        "local_ai": {
            "available": bool(neural.get("usable")),
            "label": neural.get("ui_label") or ("AVAILABLE" if neural.get("usable") else "NOT AVAILABLE"),
            "reason": neural.get("detail"),
            "model": neural.get("model"),
        },
        "ffmpeg_motion": {"available": True, "label": ENGINE_LABELS[ENGINE_FFMPEG]},
        "auto_would_choose": ENGINE_LOCAL_AI if neural.get("usable") else ENGINE_FFMPEG,
    }
