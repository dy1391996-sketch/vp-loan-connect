"""Localhost neural video worker. Bind 127.0.0.1 only. No public exposure."""

from __future__ import annotations

import json
import os
import re
import tempfile
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from .engine import ENGINE_LABELS, ENGINE_LOCAL_AI
from .errors import VideoAgentError
from .hardware import detect_hardware
from .neural_env import check_neural_environment
from .neural_spec import LOW_MEMORY_PRESET, MODEL_NAME
from .paths import TMP, ensure_dirs
from .providers.base import GenerateRequest
from .providers.local_neural import LocalNeuralVideoProvider

HOST = os.environ.get("VIDEO_AGENT_WORKER_HOST", "127.0.0.1")
PORT = int(os.environ.get("VIDEO_AGENT_WORKER_PORT", "7861"))


def _json(handler: BaseHTTPRequestHandler, status: int, payload: dict) -> None:
    body = json.dumps(payload, indent=2).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _parse_multipart(handler: BaseHTTPRequestHandler) -> tuple[dict[str, str], Path | None]:
    content_type = handler.headers.get("Content-Type", "")
    match = re.search(r"boundary=([^;]+)", content_type, re.I)
    if not match:
        raise VideoAgentError("Multipart request is missing a boundary.")
    boundary = match.group(1).strip().strip('"').encode("ascii")
    length = int(handler.headers.get("Content-Length") or 0)
    body = handler.rfile.read(length)
    fields: dict[str, str] = {}
    upload: Path | None = None
    for part in body.split(b"--" + boundary):
        part = part.lstrip(b"\r\n")
        if not part or part in {b"--", b"--\r\n"} or b"\r\n\r\n" not in part:
            continue
        header_blob, data = part.split(b"\r\n\r\n", 1)
        if data.endswith(b"\r\n"):
            data = data[:-2]
        headers = header_blob.decode("utf-8", "replace")
        name_m = re.search(r'name="([^"]+)"', headers)
        if not name_m:
            continue
        name = name_m.group(1)
        filename_m = re.search(r'filename="([^"]*)"', headers)
        if filename_m and name == "image":
            dest = Path(tempfile.gettempdir()) / f"worker-{uuid.uuid4().hex}.png"
            dest.write_bytes(data)
            upload = dest
        else:
            fields[name] = data.decode("utf-8", "replace")
    return fields, upload


class WorkerHandler(BaseHTTPRequestHandler):
    server_version = "VideoAgentWorker/0.1"

    def log_message(self, fmt: str, *args: object) -> None:
        return

    def do_GET(self) -> None:  # noqa: N802
        if self.path.rstrip("/") == "/health":
            env = check_neural_environment()
            hw = detect_hardware()
            return _json(
                self,
                200,
                {
                    "ok": True,
                    "service": "video-agent-worker",
                    "neural_available": bool(env["local_ready"]),
                    "detail": env["reason"] if not env["local_ready"] else f"{MODEL_NAME} ready on worker.",
                    "model": MODEL_NAME,
                    "chip": hw.get("cpu"),
                    "mps": bool((env.get("torch") or {}).get("mps_available")),
                    "cuda": bool((env.get("torch") or {}).get("cuda")),
                    "hardware": hw,
                    "bind": f"{HOST}:{PORT}",
                    "public": False,
                },
            )
        _json(self, 404, {"error": "not_found", "message": "Unknown worker route."})

    def do_POST(self) -> None:  # noqa: N802
        if self.path.rstrip("/") != "/generate":
            return _json(self, 404, {"error": "not_found", "message": "Unknown worker route."})
        try:
            fields, image = _parse_multipart(self)
            env = check_neural_environment()
            if not env["local_ready"]:
                raise VideoAgentError(env["reason"])
            ensure_dirs()
            dest = TMP / f"worker-{uuid.uuid4().hex}.mp4"
            request = GenerateRequest(
                prompt=fields.get("prompt") or "",
                mode=fields.get("mode") or "image_to_video",  # type: ignore[arg-type]
                image_path=image,
                negative_prompt=fields.get("negative_prompt") or "",
                quality=fields.get("quality") or "720p",
                duration=float(LOW_MEMORY_PRESET["duration_seconds"]),
                identity_lock=True,
                extra={"seed": int(fields.get("seed") or 42), "force_local": True},
            )
            provider = LocalNeuralVideoProvider()
            output = (
                provider.generate_from_image(request, dest)
                if request.mode == "image_to_video"
                else provider.generate_from_text(request, dest)
            )
            data = output.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "video/mp4")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("X-Video-Engine", ENGINE_LABELS[ENGINE_LOCAL_AI])
            self.end_headers()
            self.wfile.write(data)
        except VideoAgentError as exc:
            _json(self, exc.http_status, exc.to_dict())
        except Exception as exc:  # noqa: BLE001
            _json(self, 500, {"error": "generation_failure", "message": str(exc)})


def serve(host: str = HOST, port: int = PORT) -> None:
    if host not in {"127.0.0.1", "localhost", "::1"}:
        raise SystemExit("Refusing to bind the video worker off localhost.")
    httpd = ThreadingHTTPServer((host, port), WorkerHandler)
    print(f"Video Agent worker (localhost only): http://{host}:{port}/health")
    print("This process runs LTX-Video locally. It is not a paid API.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        httpd.server_close()


if __name__ == "__main__":
    serve()
