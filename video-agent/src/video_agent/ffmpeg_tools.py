"""FFmpeg helpers: 9:16 H.264 output, motion from a still, concat, QC, cleanup."""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Any, Callable

from .errors import (
    DiskFullError,
    FFmpegUnavailableError,
    GenerationFailureError,
    InterruptedGenerationError,
    InvalidOutputError,
)

ProgressCb = Callable[[str, int, str], None]

RESOLUTIONS = {
    "480p": (480, 854),
    "720p": (720, 1280),
    "1080p": (1080, 1920),
}
DEFAULT_FPS = 24
MIN_FREE_BYTES = 200 * 1024 * 1024


def require_ffmpeg() -> str:
    path = shutil.which("ffmpeg")
    if not path:
        raise FFmpegUnavailableError(
            "FFmpeg is not installed or not on PATH. Install FFmpeg, then re-run setup."
        )
    if not shutil.which("ffprobe"):
        raise FFmpegUnavailableError(
            "ffprobe is not installed or not on PATH. Install the full FFmpeg package."
        )
    return path


def ffmpeg_version() -> str:
    try:
        proc = subprocess.run(
            ["ffmpeg", "-version"],
            check=True,
            capture_output=True,
            text=True,
        )
    except (OSError, subprocess.CalledProcessError) as exc:
        raise FFmpegUnavailableError(f"FFmpeg could not run: {exc}") from exc
    return proc.stdout.splitlines()[0].strip()


def ensure_disk_space(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)
    if shutil.disk_usage(path).free < MIN_FREE_BYTES:
        raise DiskFullError(
            f"Not enough free disk space under {path}. Need at least 200 MB free."
        )


def _run_ffmpeg(args: list[str], *, label: str) -> None:
    proc = subprocess.run(args, capture_output=True, text=True)
    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "").strip().splitlines()
        tail = "\n".join(err[-12:]) if err else "no FFmpeg output"
        if proc.returncode < 0:
            raise InterruptedGenerationError(f"{label} was interrupted (signal {-proc.returncode}).")
        raise GenerationFailureError(f"{label} failed.\n{tail}")


def probe_media(path: Path) -> dict[str, Any]:
    proc = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            str(path),
        ],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        raise InvalidOutputError(f"ffprobe could not read {path}: {proc.stderr.strip()[:240]}")
    try:
        return json.loads(proc.stdout or "{}")
    except json.JSONDecodeError as exc:
        raise InvalidOutputError(f"ffprobe returned invalid JSON for {path}") from exc


def validate_mp4(path: Path, *, expect_w: int, expect_h: int, min_duration: float) -> dict[str, Any]:
    if not path.is_file() or path.stat().st_size < 1000:
        raise InvalidOutputError(f"Output video is missing or too small: {path}")
    info = probe_media(path)
    video = next((s for s in info.get("streams", []) if s.get("codec_type") == "video"), None)
    if not video:
        raise InvalidOutputError("Output file has no video stream.")
    codec = str(video.get("codec_name") or "")
    width = int(video.get("width") or 0)
    height = int(video.get("height") or 0)
    duration = float((info.get("format") or {}).get("duration") or video.get("duration") or 0)
    if codec not in {"h264", "libx264"}:
        raise InvalidOutputError(f"Output codec is {codec or 'unknown'}, expected H.264.")
    if width != expect_w or height != expect_h:
        raise InvalidOutputError(
            f"Output is {width}x{height}, expected {expect_w}x{expect_h} (9:16)."
        )
    if duration + 0.05 < min_duration:
        raise InvalidOutputError(
            f"Output duration is {duration:.2f}s, shorter than requested {min_duration:.2f}s."
        )
    return {
        "path": str(path),
        "codec": codec,
        "width": width,
        "height": height,
        "duration": round(duration, 3),
        "bytes": path.stat().st_size,
        "aspect": "9:16",
    }


def normalize_vertical_still(
    source: Path,
    dest: Path,
    *,
    width: int,
    height: int,
) -> Path:
    """Pad to 9:16 without stretching. Identity pixels stay unstretched."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    vf = (
        f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
        f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=black,"
        "setsar=1,format=rgb24"
    )
    _run_ffmpeg(
        ["ffmpeg", "-y", "-i", str(source), "-vf", vf, "-frames:v", "1", str(dest)],
        label="9:16 still normalization",
    )
    if not dest.is_file():
        raise GenerationFailureError("FFmpeg did not write the normalized still.")
    return dest


def still_to_motion(
    source: Path,
    dest: Path,
    *,
    width: int,
    height: int,
    duration: float,
    fps: int = DEFAULT_FPS,
    dry_run: bool = False,
) -> Path:
    """Identity-preserving camera motion from a still. Does not redesign the face."""
    require_ffmpeg()
    ensure_disk_space(dest.parent)
    dest.parent.mkdir(parents=True, exist_ok=True)
    frames = max(int(round((1.0 if dry_run else duration) * fps)), fps)
    actual_duration = frames / fps
    # Slow zoom + tiny handheld drift. No face morph, no beautify.
    z = "min(1.08\\,1+0.00045*on)"
    x = "iw/2-(iw/zoom/2)+2*sin(on/18)"
    y = "ih/2-(ih/zoom/2)+1.5*cos(on/22)"
    vf = (
        f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
        f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=black,"
        f"zoompan=z='{z}':x='{x}':y='{y}':d={frames}:s={width}x{height}:fps={fps},"
        "format=yuv420p"
    )
    _run_ffmpeg(
        [
            "ffmpeg",
            "-y",
            "-loop",
            "1",
            "-i",
            str(source),
            "-vf",
            vf,
            "-t",
            f"{actual_duration:.3f}",
            "-r",
            str(fps),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-preset",
            "veryfast",
            "-crf",
            "20",
            "-movflags",
            "+faststart",
            "-an",
            str(dest),
        ],
        label="image-to-video motion encode",
    )
    min_dur = 0.4 if dry_run else max(duration - 0.35, 0.4)
    validate_mp4(dest, expect_w=width, expect_h=height, min_duration=min_dur)
    return dest


def text_to_motion(
    prompt: str,
    dest: Path,
    *,
    width: int,
    height: int,
    duration: float,
    fps: int = DEFAULT_FPS,
    dry_run: bool = False,
    font: str | None = None,
) -> Path:
    """Local text→video fallback: vertical motion graphic. Not a neural T2V model."""
    require_ffmpeg()
    ensure_disk_space(dest.parent)
    dest.parent.mkdir(parents=True, exist_ok=True)
    actual = 1.0 if dry_run else duration
    fontfile = font or _default_font()
    safe = (
        prompt.replace("\\", "\\\\")
        .replace(":", "\\:")
        .replace("'", "\\'")
        .replace("%", "\\%")
    )
    wrapped = _wrap(safe, 28)
    draw = (
        f"drawtext=fontfile={fontfile}:text='{wrapped}':fontcolor=white:fontsize=36:"
        f"x=(w-text_w)/2:y=(h-text_h)/2:line_spacing=12:"
        "shadowcolor=black:shadowx=2:shadowy=2"
    )
    vf = f"hue=h={20}*t,{draw},format=yuv420p"
    _run_ffmpeg(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            f"color=c=0x12141c:s={width}x{height}:d={actual:.3f}:r={fps}",
            "-vf",
            vf,
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-preset",
            "veryfast",
            "-crf",
            "20",
            "-movflags",
            "+faststart",
            "-an",
            str(dest),
        ],
        label="text-to-video motion graphic",
    )
    validate_mp4(dest, expect_w=width, expect_h=height, min_duration=0.4 if dry_run else max(duration - 0.35, 0.4))
    return dest


def concat_clips(clips: list[Path], dest: Path, *, width: int, height: int) -> Path:
    require_ffmpeg()
    ensure_disk_space(dest.parent)
    dest.parent.mkdir(parents=True, exist_ok=True)
    if len(clips) < 2:
        raise GenerationFailureError("Clip joining needs at least two MP4 files.")
    list_file = dest.with_suffix(".concat.txt")
    normalized: list[Path] = []
    try:
        for i, clip in enumerate(clips):
            norm = dest.parent / f"{dest.stem}.norm{i}.mp4"
            _run_ffmpeg(
                [
                    "ffmpeg",
                    "-y",
                    "-i",
                    str(clip),
                    "-vf",
                    f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
                    f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=24,format=yuv420p",
                    "-c:v",
                    "libx264",
                    "-an",
                    "-preset",
                    "veryfast",
                    str(norm),
                ],
                label=f"normalize clip {i + 1} for join",
            )
            normalized.append(norm)
        list_file.write_text(
            "".join(f"file '{p.resolve()}'\n" for p in normalized),
            encoding="utf-8",
        )
        _run_ffmpeg(
            [
                "ffmpeg",
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(list_file),
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-movflags",
                "+faststart",
                "-an",
                str(dest),
            ],
            label="clip join",
        )
    finally:
        for path in normalized:
            path.unlink(missing_ok=True)
        list_file.unlink(missing_ok=True)
    validate_mp4(dest, expect_w=width, expect_h=height, min_duration=0.5)
    return dest


def extract_qc_frames(video_path: Path, qc_dir: Path) -> list[Path]:
    qc_dir.mkdir(parents=True, exist_ok=True)
    info = probe_media(video_path)
    duration = float((info.get("format") or {}).get("duration") or 0)
    if duration <= 0:
        raise InvalidOutputError("Could not read generated video duration for QC frames.")
    frame_paths: list[Path] = []
    for percent in (0, 20, 40, 60, 80, 100):
        timestamp = 0.0 if percent == 0 else min(duration * (percent / 100.0), max(duration - 0.04, 0))
        dest = qc_dir / f"frame-{percent:02d}.jpg"
        _run_ffmpeg(
            [
                "ffmpeg",
                "-y",
                "-ss",
                f"{timestamp:.3f}",
                "-i",
                str(video_path),
                "-frames:v",
                "1",
                "-q:v",
                "2",
                str(dest),
            ],
            label=f"QC frame {percent}%",
        )
        frame_paths.append(dest)
    return frame_paths


def cleanup_failed(paths: list[Path]) -> None:
    for path in paths:
        try:
            if path.is_file():
                path.unlink()
            elif path.is_dir():
                shutil.rmtree(path, ignore_errors=True)
        except OSError:
            continue


def _default_font() -> str:
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for path in candidates:
        if Path(path).is_file():
            return path
    return "Sans"


def _wrap(text: str, width: int) -> str:
    words = text.split()
    if not words:
        return "Video Agent"
    lines: list[str] = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        if len(trial) <= width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
        if len(lines) >= 10:
            break
    if current and len(lines) < 10:
        lines.append(current)
    return "\n".join(lines)
