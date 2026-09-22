#!/usr/bin/env python3
"""Direct maya-media-v1 real generation tests (free local only)."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
BRIDGE = os.environ.get("MAYA_MEDIA_LOCAL_URL", "http://127.0.0.1:8787").rstrip("/")
MASTER = REPO / "config/maya/visual/MASTER_MAYA_REFERENCE.png"
OUT = REPO / "work/maya-comfy/test-outputs"
OUT.mkdir(parents=True, exist_ok=True)


def multipart(fields: dict[str, tuple[bytes, str | None, str | None]]) -> tuple[bytes, str]:
    boundary = "----mayaBoundary7MAYA"
    body = bytearray()
    for name, (value, filename, mime) in fields.items():
        body.extend(f"--{boundary}\r\n".encode())
        if filename:
            body.extend(
                f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'.encode()
            )
            body.extend(f"Content-Type: {mime or 'application/octet-stream'}\r\n\r\n".encode())
        else:
            body.extend(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        body.extend(value)
        body.extend(b"\r\n")
    body.extend(f"--{boundary}--\r\n".encode())
    return bytes(body), f"multipart/form-data; boundary={boundary}"


def post_generate(payload: dict, master: bytes, source: bytes | None = None) -> tuple[bytes, str]:
    fields: dict[str, tuple[bytes, str | None, str | None]] = {
        "request": (json.dumps(payload).encode(), None, None),
        "master": (master, "master.png", "image/png"),
    }
    if source is not None:
        fields["source"] = (source, "approved-source.png", "image/png")
    body, content_type = multipart(fields)
    req = urllib.request.Request(
        f"{BRIDGE}/generate",
        data=body,
        headers={"Content-Type": content_type},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=2400) as resp:
        return resp.read(), resp.headers.get("content-type", "")


def main() -> int:
    caps = urllib.request.urlopen(f"{BRIDGE}/capabilities", timeout=10).read()
    print("capabilities", caps.decode())
    master = MASTER.read_bytes()

    scenes = [
        (
            "photo1-balcony",
            "Maya standing on a quiet balcony at dusk, looking toward the street lights",
        ),
        (
            "photo2-cafe",
            "Maya sitting at a small cafe table by a window with soft daylight, holding a ceramic cup",
        ),
        (
            "photo3-park",
            "Maya walking through a leafy city park path in soft afternoon light, candid waist-up",
        ),
    ]

    for name, scene in scenes:
        print(f"PHOTO {name} …")
        payload = {
            "protocol": "maya-media-v1",
            "kind": "photo",
            "mode": "lifestyle",
            "scene": scene,
            "outfit": "casual everyday clothing",
            "pose": "natural pose distinct from the master reference",
            "prompt": (
                "1 IDENTITY: Use the attached immutable Master Maya image as highest identity authority. "
                "Same adult fictional Maya.\n"
                f"3 SCENE: {scene}\n"
                "9 REALISM: natural skin texture, realistic hands, ordinary environment.\n"
                "11 PROVIDER: maya-media-v1; synthetic creative visual."
            ),
        }
        data, ctype = post_generate(payload, master)
        path = OUT / f"{name}.png"
        path.write_bytes(data)
        print(json.dumps({"name": name, "bytes": len(data), "content_type": ctype, "path": str(path)}))
        if ctype not in ("image/png", "image/jpeg") or len(data) < 20_000:
            print("FAIL: photo output invalid", file=sys.stderr)
            return 1

    source = (OUT / "photo1-balcony.png").read_bytes()
    print("VIDEO from photo1 …")
    video_payload = {
        "protocol": "maya-media-v1",
        "kind": "video",
        "mode": "lifestyle",
        "scene": scenes[0][1],
        "motion": "Subtle breathing, blinking and natural hair movement. Static phone camera.",
        "prompt": (
            "Exact approved source photo: preserve starting face, body, outfit, room, light and pose; "
            "add motion only. Stable identity at start, middle and end."
        ),
    }
    data, ctype = post_generate(video_payload, master, source)
    vpath = OUT / "video1-from-photo1.mp4"
    vpath.write_bytes(data)
    print(json.dumps({"name": "video1", "bytes": len(data), "content_type": ctype, "path": str(vpath)}))
    if ctype != "video/mp4" or len(data) < 50_000:
        print("FAIL: video output invalid", file=sys.stderr)
        return 1
    print("ALL_DIRECT_TESTS_DONE")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except urllib.error.URLError as exc:
        print(f"NETWORK_ERROR: {exc}", file=sys.stderr)
        raise SystemExit(2) from exc
