"""Typed, user-readable errors for the video agent."""

from __future__ import annotations


class VideoAgentError(Exception):
    code = "video_agent_error"
    http_status = 400

    def __init__(self, message: str, *, details: dict | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}

    def to_dict(self) -> dict:
        return {
            "error": self.code,
            "message": self.message,
            "details": self.details,
        }


class UnsupportedImageError(VideoAgentError):
    code = "unsupported_image"


class MissingImageError(VideoAgentError):
    code = "missing_image"


class CorruptImageError(VideoAgentError):
    code = "corrupt_image"


class WrongAspectRatioError(VideoAgentError):
    code = "wrong_aspect_ratio"


class ModelUnavailableError(VideoAgentError):
    code = "model_unavailable"
    http_status = 503


class ModelLoadFailureError(VideoAgentError):
    code = "model_load_failure"
    http_status = 503


class OutOfMemoryError(VideoAgentError):
    code = "out_of_memory"
    http_status = 507


class FFmpegUnavailableError(VideoAgentError):
    code = "ffmpeg_unavailable"
    http_status = 503


class GenerationFailureError(VideoAgentError):
    code = "generation_failure"
    http_status = 500


class InterruptedGenerationError(VideoAgentError):
    code = "interrupted_generation"
    http_status = 499


class DiskFullError(VideoAgentError):
    code = "disk_full"
    http_status = 507


class InvalidOutputError(VideoAgentError):
    code = "invalid_output"
    http_status = 500


class JobNotFoundError(VideoAgentError):
    code = "job_not_found"
    http_status = 404


class CancelledError(InterruptedGenerationError):
    code = "cancelled"
    http_status = 409
