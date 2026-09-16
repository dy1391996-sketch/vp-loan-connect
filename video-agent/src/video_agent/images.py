"""Reference-image validation. Identity pixels are never rewritten here."""

from __future__ import annotations

import struct
from pathlib import Path

from .errors import CorruptImageError, MissingImageError, UnsupportedImageError, WrongAspectRatioError

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
JPEG_MAGIC = b"\xff\xd8\xff"
WEBP_MAGIC = b"RIFF"
ALLOWED_EXT = {".png", ".jpg", ".jpeg", ".webp"}
MAX_BYTES = 25 * 1024 * 1024
MIN_SIDE = 256
VERTICAL_RATIO = 9 / 16
RATIO_TOLERANCE = 0.03


def sniff_image(path: Path) -> tuple[str, int, int]:
    if not path.is_file():
        raise MissingImageError(f"Reference image is missing: {path}")
    size = path.stat().st_size
    if size < 32:
        raise CorruptImageError(f"Image file is too small to be valid ({size} bytes): {path}")
    if size > MAX_BYTES:
        raise UnsupportedImageError(
            f"Image is {size} bytes. Maximum accepted size is {MAX_BYTES} bytes (25 MB)."
        )
    header = path.read_bytes()[:32]
    suffix = path.suffix.lower()
    if suffix and suffix not in ALLOWED_EXT:
        raise UnsupportedImageError(
            f"Unsupported image type '{suffix}'. Use PNG, JPEG, or WebP."
        )
    if header.startswith(PNG_MAGIC):
        return ("image/png", *_png_size(path))
    if header.startswith(JPEG_MAGIC):
        return ("image/jpeg", *_jpeg_size(path))
    if header.startswith(WEBP_MAGIC) and header[8:12] == b"WEBP":
        return ("image/webp", *_webp_size(path))
    raise UnsupportedImageError(
        "File is not a readable PNG, JPEG, or WebP image. "
        "SVG, HEIC, GIF, and PDF are not accepted as a reference frame."
    )


def _png_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if data[:8] != PNG_MAGIC or len(data) < 24:
        raise CorruptImageError(f"PNG header is corrupt: {path}")
    width, height = struct.unpack(">II", data[16:24])
    if width < 1 or height < 1:
        raise CorruptImageError(f"PNG has invalid dimensions {width}x{height}: {path}")
    return width, height


def _jpeg_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if not data.startswith(JPEG_MAGIC):
        raise CorruptImageError(f"JPEG header is corrupt: {path}")
    i = 2
    length = len(data)
    while i < length - 8:
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker in {0xC0, 0xC1, 0xC2}:
            height = struct.unpack(">H", data[i + 5 : i + 7])[0]
            width = struct.unpack(">H", data[i + 7 : i + 9])[0]
            if width < 1 or height < 1:
                raise CorruptImageError(f"JPEG has invalid dimensions {width}x{height}: {path}")
            return width, height
        if marker == 0xD9:
            break
        if marker in {0xD8, 0x01} or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        seglen = struct.unpack(">H", data[i + 2 : i + 4])[0]
        i += 2 + seglen
    raise CorruptImageError(f"Could not read JPEG dimensions: {path}")


def _webp_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if len(data) < 30 or data[8:12] != b"WEBP":
        raise CorruptImageError(f"WebP header is corrupt: {path}")
    kind = data[12:16]
    if kind == b"VP8X":
        width = 1 + int.from_bytes(data[24:27], "little")
        height = 1 + int.from_bytes(data[27:30], "little")
        return width, height
    if kind == b"VP8 " and len(data) >= 30:
        # Lossy VP8: 14-byte payload header then packed 24-bit sizes.
        width = struct.unpack("<H", data[26:28])[0] & 0x3FFF
        height = struct.unpack("<H", data[28:30])[0] & 0x3FFF
        return width, height
    if kind == b"VP8L" and len(data) >= 25:
        bits = struct.unpack("<I", data[21:25])[0]
        width = (bits & 0x3FFF) + 1
        height = ((bits >> 14) & 0x3FFF) + 1
        return width, height
    raise CorruptImageError(f"Unsupported or corrupt WebP variant: {path}")


def describe_image(path: Path) -> dict:
    mime, width, height = sniff_image(path)
    if min(width, height) < MIN_SIDE:
        raise UnsupportedImageError(
            f"Image is {width}x{height}. Each side must be at least {MIN_SIDE}px."
        )
    ratio = width / height if height else 0
    vertical = abs(ratio - VERTICAL_RATIO) <= RATIO_TOLERANCE
    return {
        "path": str(path),
        "mime": mime,
        "width": width,
        "height": height,
        "ratio": round(ratio, 4),
        "is_9_16": vertical,
        "bytes": path.stat().st_size,
    }


def require_image(path: Path | None, *, mode: str) -> dict | None:
    if mode == "image_to_video":
        if path is None:
            raise MissingImageError(
                "Image-to-video requires a reference image. Upload a PNG, JPEG, or WebP, "
                "or use the Maya Video #1 approved start frame."
            )
        return describe_image(path)
    if path is not None:
        return describe_image(path)
    return None


def aspect_warning_or_error(info: dict, *, strict: bool) -> str | None:
    if info.get("is_9_16"):
        return None
    message = (
        f"Reference image is {info['width']}x{info['height']} "
        f"(ratio {info['ratio']}), not 9:16. "
        "The pipeline will pad to 720x1280 without stretching identity pixels."
    )
    if strict:
        raise WrongAspectRatioError(message)
    return message
