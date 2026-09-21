"""Localhost-only neural worker client. Never a paid API."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any

DEFAULT_WORKER_URL = "http://127.0.0.1:7861"


def worker_url() -> str:
    return (os.environ.get("VIDEO_AGENT_WORKER_URL") or DEFAULT_WORKER_URL).rstrip("/")


def probe_worker(timeout: float = 0.4) -> dict[str, Any]:
    url = worker_url()
    result: dict[str, Any] = {
        "url": url,
        "reachable": False,
        "neural_available": False,
        "detail": "No local video worker on localhost.",
        "hardware": None,
    }
    if os.environ.get("VIDEO_AGENT_IS_WORKER") == "1":
        result["detail"] = "Worker self-probe skipped."
        return result
    request = urllib.request.Request(url + "/health", method="GET")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        result["detail"] = f"Worker not reachable at {url} ({exc.__class__.__name__})."
        return result
    result["reachable"] = True
    result["neural_available"] = bool(payload.get("neural_available"))
    result["hardware"] = payload.get("hardware")
    result["model"] = payload.get("model")
    result["detail"] = payload.get("detail") or "Worker reachable."
    result["chip"] = payload.get("chip")
    result["mps"] = payload.get("mps")
    result["cuda"] = payload.get("cuda")
    return result


def worker_generate(payload: dict[str, Any], image_bytes: bytes | None, timeout: int = 1800) -> bytes:
    boundary = "----VideoAgentWorker"
    chunks = []
    for key, value in payload.items():
        if value is None:
            continue
        chunks.append(
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"{key}\"\r\n\r\n{value}\r\n".encode()
        )
    if image_bytes:
        chunks.append(
            (
                f"--{boundary}\r\nContent-Disposition: form-data; name=\"image\"; "
                f"filename=\"source.png\"\r\nContent-Type: image/png\r\n\r\n"
            ).encode()
            + image_bytes
            + b"\r\n"
        )
    chunks.append(f"--{boundary}--\r\n".encode())
    body = b"".join(chunks)
    request = urllib.request.Request(
        worker_url() + "/generate",
        data=body,
        method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            ctype = response.headers.get("Content-Type", "")
            data = response.read()
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", "replace")
        try:
            parsed = json.loads(raw)
            raise RuntimeError(parsed.get("message") or parsed.get("error") or raw)
        except json.JSONDecodeError:
            raise RuntimeError(raw or str(exc)) from exc
    if "json" in ctype:
        parsed = json.loads(data.decode("utf-8"))
        raise RuntimeError(parsed.get("message") or "Worker returned JSON instead of video.")
    return data
