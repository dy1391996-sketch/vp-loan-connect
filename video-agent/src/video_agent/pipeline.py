"""End-to-end generation pipeline: parse → validate → generate → QC → MP4."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from . import jobs
from .errors import (
    CancelledError,
    DiskFullError,
    FFmpegUnavailableError,
    GenerationFailureError,
    InterruptedGenerationError,
    InvalidOutputError,
    MissingImageError,
    ModelLoadFailureError,
    ModelUnavailableError,
    OutOfMemoryError,
    VideoAgentError,
    WrongAspectRatioError,
)
from .ffmpeg_tools import RESOLUTIONS, cleanup_failed, extract_qc_frames, require_ffmpeg
from .hardware import detect_hardware
from .images import aspect_warning_or_error, require_image
from .maya import require_maya_source
from .paths import OUTPUTS, TMP, ensure_dirs
from .engine import ENGINE_FFMPEG, ENGINE_LABELS, resolve_engine
from .providers.base import GenerateRequest
from .providers.local_ffmpeg import LocalFFmpegProvider


def _progress(job_id: str, status: str, pct: int, message: str) -> None:
    if jobs.is_cancelled(job_id):
        jobs.update_job(
            job_id,
            status="CANCELLED",
            progress=pct,
            message="Generation cancelled.",
            error="Cancelled by user.",
            error_code="cancelled",
        )
        raise CancelledError("Generation was cancelled.")
    jobs.update_job(job_id, status=status, progress=pct, message=message)


def parse_request(body: dict[str, Any], image_path: Path | None) -> GenerateRequest:
    mode = str(body.get("mode") or "image_to_video").strip()
    if mode not in {"text_to_video", "image_to_video"}:
        raise VideoAgentError(f"Unknown mode '{mode}'. Use text_to_video or image_to_video.")
    prompt = str(body.get("prompt") or "").strip()
    if not prompt:
        raise VideoAgentError("A prompt is required.")
    if len(prompt) > 8000:
        raise VideoAgentError("Prompt is too long (8000 character maximum).")
    duration = float(body.get("duration") or 6)
    if duration < 1 or duration > 12:
        raise VideoAgentError("Duration must be between 1 and 12 seconds for the local short-form pipeline.")
    quality = str(body.get("quality") or "720p")
    if quality not in RESOLUTIONS:
        raise VideoAgentError("Quality must be 480p, 720p, or 1080p.")
    aspect = str(body.get("aspect_ratio") or "9:16")
    if aspect not in {"9:16", "9/16", "vertical"}:
        raise WrongAspectRatioError(
            f"This short-form workflow only outputs 9:16 vertical video. Received '{aspect}'."
        )
    return GenerateRequest(
        prompt=prompt,
        mode=mode,
        image_path=image_path,
        negative_prompt=str(body.get("negative_prompt") or ""),
        aspect_ratio="9:16",
        duration=duration,
        quality=quality,
        dry_run=bool(body.get("dry_run")),
        identity_lock=bool(body.get("maya") or body.get("identity_lock")),
        extra={"maya": bool(body.get("maya")), "seed": body.get("seed"), "low_memory": True},
    )


def run_job(job_id: str) -> dict[str, Any]:
    job = jobs.load_job(job_id)
    dest = jobs.output_file(job_id)
    qc_dir = TMP / job_id / "qc"
    tmp_dir = TMP / job_id
    ensure_dirs()
    try:
        _progress(job_id, "PREPARING", 8, "Preparing job directories and hardware profile.")
        hardware = detect_hardware(OUTPUTS)
        jobs.update_job(job_id, hardware_summary=hardware["reason"])

        _progress(job_id, "VALIDATING", 18, "Validating prompt, image, aspect ratio, and dependencies.")
        request = parse_request(job, Path(job["image_path"]) if job.get("image_path") else None)
        if job.get("maya"):
            maya = require_maya_source()
            request.image_path = Path(maya["source"])
            request.identity_lock = True
            if not request.prompt:
                request.prompt = maya["prompt"]
            if not request.negative_prompt:
                request.negative_prompt = maya["negative_prompt"]
            jobs.update_job(job_id, source_sha256=maya["source_sha256"], identity_lock=True)

        image_info = require_image(request.image_path, mode=request.mode)
        warning = aspect_warning_or_error(image_info, strict=False) if image_info else None
        if warning:
            jobs.update_job(job_id, aspect_warning=warning)

        require_ffmpeg()
        engine_id, provider, engine_reason = resolve_engine(
            job.get("engine"),
            provider_id=job.get("provider_id"),
            recommended_engine=hardware["recommended_engine"],
        )
        if provider.paid:
            raise ModelUnavailableError(
                "Paid providers are not selected by the Video Agent. Use the free local engine."
            )
        if engine_id == ENGINE_FFMPEG and request.identity_lock and request.mode == "image_to_video":
            # Keep Maya identity lock language; FFmpeg still does not redesign pixels.
            pass
        if request.identity_lock and engine_id != ENGINE_FFMPEG:
            from .neural_spec import MAYA_NEURAL_NEGATIVE, MAYA_NEURAL_PROMPT

            if job.get("maya"):
                request.prompt = MAYA_NEURAL_PROMPT if not job.get("keep_original_prompt") else request.prompt
                if not request.negative_prompt:
                    request.negative_prompt = MAYA_NEURAL_NEGATIVE
            request.extra["low_memory"] = True
            request.extra["seed"] = int(job.get("seed") or 42)
        validated = provider.validate(request)
        jobs.update_job(
            job_id,
            provider=provider.id,
            provider_name=provider.name,
            validation=validated,
            engine=engine_id,
            engine_label=ENGINE_LABELS.get(engine_id, engine_id),
            engine_reason=engine_reason,
            ai_generated=engine_id != ENGINE_FFMPEG,
        )

        if request.dry_run and engine_id != ENGINE_FFMPEG:
            provider = LocalFFmpegProvider()
            engine_id = ENGINE_FFMPEG
            engine_reason = "Dry-run skipped neural generate; FFmpeg validation encode only."
            jobs.update_job(
                job_id,
                engine=engine_id,
                engine_label="Dry-run FFmpeg validation (Local AI not executed)",
                engine_reason=engine_reason,
                ai_generated=False,
                provider=provider.id,
                provider_name=provider.name,
                dry_run_skipped_neural=True,
            )

        _progress(
            job_id,
            "LOADING_MODEL",
            30,
            "Dry-run: checking engine wiring without a full-length encode."
            if request.dry_run
            else f"Loading engine: {provider.name}.",
        )
        dest.parent.mkdir(parents=True, exist_ok=True)
        _progress(job_id, "RUNNING", 40, "Generating video.")

        def gen_progress(stage: str, pct: int, message: str) -> None:
            _progress(job_id, "RUNNING", pct, message)

        if request.mode == "image_to_video":
            output = provider.generate_from_image(request, dest, gen_progress)
        else:
            output = provider.generate_from_text(request, dest, gen_progress)

        _progress(job_id, "POST_PROCESSING", 88, "Validating MP4 and extracting QC frames.")
        frames = extract_qc_frames(output, qc_dir)
        jobs.update_job(
            job_id,
            output_path=str(output),
            qc_frames=[str(p) for p in frames],
            file_size=output.stat().st_size,
        )
        _progress(
            job_id,
            "COMPLETED",
            100,
            "Dry-run complete." if request.dry_run else "Generation complete.",
        )
        return jobs.load_job(job_id)
    except CancelledError:
        cleanup_failed([dest, tmp_dir])
        return jobs.load_job(job_id)
    except MemoryError as exc:
        err = OutOfMemoryError(f"The machine ran out of memory during generation: {exc}")
        return _fail(job_id, dest, tmp_dir, err)
    except OSError as exc:
        if getattr(exc, "errno", None) == 28:
            return _fail(job_id, dest, tmp_dir, DiskFullError(f"Disk is full: {exc}"))
        return _fail(job_id, dest, tmp_dir, GenerationFailureError(str(exc)))
    except VideoAgentError as exc:
        return _fail(job_id, dest, tmp_dir, exc)
    except Exception as exc:  # noqa: BLE001 — last-chance job failure
        mapped = _map_unknown(exc)
        return _fail(job_id, dest, tmp_dir, mapped)


def _map_unknown(exc: BaseException) -> VideoAgentError:
    text = str(exc).lower()
    if "ffmpeg" in text and ("not found" in text or "no such file" in text):
        return FFmpegUnavailableError(str(exc))
    if "memory" in text or "oom" in text:
        return OutOfMemoryError(str(exc))
    if isinstance(exc, KeyboardInterrupt):
        return InterruptedGenerationError("Generation was interrupted.")
    if "model" in text and "load" in text:
        return ModelLoadFailureError(str(exc))
    return GenerationFailureError(str(exc))


def _fail(job_id: str, dest: Path, tmp_dir: Path, exc: VideoAgentError) -> dict[str, Any]:
    cleanup_failed([dest, tmp_dir])
    return jobs.update_job(
        job_id,
        status="FAILED",
        progress=0,
        message=exc.message,
        error=exc.message,
        error_code=exc.code,
        error_details=exc.details,
        output_path=None,
    )


def dry_run_report() -> dict[str, Any]:
    """Validate pipeline wiring without a heavy generation. Used by CLI + tests."""
    from .engine import engine_public_status
    from .ffmpeg_tools import ffmpeg_version, still_to_motion
    from .images import describe_image
    from .maya import maya_status

    hardware = detect_hardware()
    ffmpeg = ffmpeg_version()
    maya = maya_status()
    image = describe_image(Path(maya["source"])) if maya["source_present"] else None
    tmp = TMP / "dry-run.mp4"
    still_to_motion(
        Path(maya["source"]),
        tmp,
        width=720,
        height=1280,
        duration=1,
        dry_run=True,
    )
    size = tmp.stat().st_size
    tmp.unlink(missing_ok=True)
    return {
        "ok": True,
        "dry_run": True,
        "paid_generations": 0,
        "hardware": hardware,
        "ffmpeg": ffmpeg,
        "maya": {
            "identity_lock": maya["identity_lock"],
            "source_sha256": maya["source_sha256"],
            "prompt_ready": maya["prompt_ready"],
            "is_9_16": image["is_9_16"] if image else False,
        },
        "sample_mp4_bytes": size,
        "engine": "local_ffmpeg",
        "image_to_video": "wired (AUTO uses Local AI when available, otherwise FFmpeg motion)",
        "portrait_9_16": True,
        "local_ai": engine_public_status(),
    }
