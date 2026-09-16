"""Stdlib HTTP server for the personal Video Agent UI + JSON API."""

from __future__ import annotations

import json
import mimetypes
import os
import re
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

from . import jobs
from .engine import engine_public_status
from .errors import JobNotFoundError, VideoAgentError
from .hardware import detect_hardware
from .maya import maya_status
from .neural_env import check_neural_environment
from .paths import AGENT_ROOT, UPLOADS, WEB_ROOT, ensure_dirs
from .pipeline import run_job
from .providers import PROVIDERS
from .providers.optional_cloud import probe_optional_cloud

HOST = os.environ.get("VIDEO_AGENT_HOST", "127.0.0.1")
PORT = int(os.environ.get("VIDEO_AGENT_PORT", "7860"))
JOB_ID_RE = re.compile(r"^[a-f0-9]{32}$")
_worker_lock = threading.Lock()
_busy = False


def _json(handler: BaseHTTPRequestHandler, status: int, payload: dict | list) -> None:
    body = json.dumps(payload, indent=2).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


def _read_json(handler: BaseHTTPRequestHandler) -> dict:
    length = int(handler.headers.get("Content-Length") or 0)
    if length > 30 * 1024 * 1024:
        raise VideoAgentError("Request body is too large.")
    raw = handler.rfile.read(length) if length else b"{}"
    if not raw:
        return {}
    try:
        data = json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise VideoAgentError("Request is not valid JSON.") from exc
    if not isinstance(data, dict):
        raise VideoAgentError("JSON body must be an object.")
    return data


def _parse_multipart(handler: BaseHTTPRequestHandler) -> tuple[dict[str, str], Path | None]:
    content_type = handler.headers.get("Content-Type", "")
    if "multipart/form-data" not in content_type:
        raise VideoAgentError("Expected multipart/form-data.")
    match = re.search(r"boundary=([^;]+)", content_type, re.I)
    if not match:
        raise VideoAgentError("Multipart request is missing a boundary.")
    boundary = match.group(1).strip().strip('"').encode("ascii")
    length = int(handler.headers.get("Content-Length") or 0)
    if length > 30 * 1024 * 1024:
        raise VideoAgentError("Upload is too large (25 MB image maximum).")
    body = handler.rfile.read(length)
    fields: dict[str, str] = {}
    upload: Path | None = None
    parts = body.split(b"--" + boundary)
    for part in parts:
        part = part.lstrip(b"\r\n")
        if not part or part in {b"--", b"--\r\n"}:
            continue
        if b"\r\n\r\n" not in part:
            continue
        header_blob, data = part.split(b"\r\n\r\n", 1)
        if data.endswith(b"\r\n"):
            data = data[:-2]
        if data.endswith(b"--"):
            data = data[:-2]
        headers = header_blob.decode("utf-8", "replace")
        name_m = re.search(r'name="([^"]+)"', headers)
        if not name_m:
            continue
        name = name_m.group(1)
        filename_m = re.search(r'filename="([^"]*)"', headers)
        if filename_m and name == "image":
            filename = Path(filename_m.group(1)).name
            if not filename:
                continue
            ext = Path(filename).suffix.lower() or ".png"
            ensure_dirs()
            dest = UPLOADS / f"{uuid.uuid4().hex}{ext}"
            dest.write_bytes(data)
            upload = dest
        else:
            fields[name] = data.decode("utf-8", "replace")
    return fields, upload


def _bool(value: str | None) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def _enqueue(fields: dict[str, str], image: Path | None) -> dict:
    maya = _bool(fields.get("maya"))
    mode = fields.get("mode") or ("image_to_video" if (image or maya) else "text_to_video")
    job = jobs.new_job(
        {
            "prompt": fields.get("prompt") or "",
            "negative_prompt": fields.get("negative_prompt") or "",
            "mode": mode,
            "aspect_ratio": fields.get("aspect_ratio") or "9:16",
            "duration": float(fields.get("duration") or 6),
            "quality": fields.get("quality") or "720p",
            "dry_run": _bool(fields.get("dry_run")),
            "maya": maya,
            "image_path": str(image) if image else None,
            "provider_id": fields.get("provider_id") or "",
            "engine": fields.get("engine") or "auto",
            "seed": fields.get("seed") or "42",
        }
    )
    thread = threading.Thread(target=_run_safe, args=(job["id"],), daemon=True)
    thread.start()
    return job


def _run_safe(job_id: str) -> None:
    global _busy
    with _worker_lock:
        _busy = True
        try:
            run_job(job_id)
        finally:
            _busy = False


class Handler(BaseHTTPRequestHandler):
    server_version = "VideoAgent/0.1"

    def log_message(self, fmt: str, *args: object) -> None:
        return

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        try:
            if path in {"/", "/index.html"}:
                return self._send_file(WEB_ROOT / "index.html", "text/html; charset=utf-8")
            if path.startswith("/assets/"):
                return self._send_web(path[len("/assets/") :])
            if path == "/api/health":
                return _json(self, 200, {"ok": True, "service": "video-agent", "busy": _busy})
            if path == "/api/hardware":
                hw = detect_hardware()
                neural = check_neural_environment()
                hw["local_ai"] = {
                    "available": neural["available"],
                    "label": neural["ui_label"],
                    "reason": neural["reason"],
                    "model": (neural.get("model") or {}).get("model_name"),
                }
                hw["worker"] = neural.get("worker")
                return _json(self, 200, hw)
            if path == "/api/engines":
                return _json(self, 200, engine_public_status())
            if path == "/api/providers":
                statuses = [p.get_status() for p in PROVIDERS.values()]
                return _json(self, 200, {"providers": statuses, "optional_cloud_probes": probe_optional_cloud()})
            if path == "/api/maya":
                return _json(self, 200, maya_status())
            if path == "/api/jobs":
                return _json(self, 200, {"jobs": jobs.list_jobs()})
            job_video = re.match(r"^/api/jobs/([a-f0-9]{32})/video$", path)
            if job_video:
                return self._send_video(job_video.group(1), download="download" in parsed.query)
            job_get = re.match(r"^/api/jobs/([a-f0-9]{32})$", path)
            if job_get:
                return _json(self, 200, jobs.load_job(job_get.group(1)))
            self._send_file(WEB_ROOT / path.lstrip("/"), None)
        except VideoAgentError as exc:
            _json(self, exc.http_status, exc.to_dict())
        except Exception as exc:  # noqa: BLE001
            _json(self, 500, {"error": "server_error", "message": str(exc)})

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        try:
            if path == "/api/jobs":
                ctype = self.headers.get("Content-Type", "")
                if "multipart/form-data" in ctype:
                    fields, image = _parse_multipart(self)
                else:
                    body = _read_json(self)
                    fields = {k: str(v) if not isinstance(v, bool) else ("true" if v else "false") for k, v in body.items()}
                    image = Path(body["image_path"]) if body.get("image_path") else None
                    if body.get("dry_run") is True:
                        fields["dry_run"] = "true"
                    if body.get("maya") is True:
                        fields["maya"] = "true"
                return _json(self, 201, _enqueue(fields, image))
            cancel = re.match(r"^/api/jobs/([a-f0-9]{32})/cancel$", path)
            if cancel:
                return _json(self, 200, jobs.request_cancel(cancel.group(1)))
            _json(self, 404, {"error": "not_found", "message": "Unknown API route."})
        except VideoAgentError as exc:
            _json(self, exc.http_status, exc.to_dict())
        except Exception as exc:  # noqa: BLE001
            _json(self, 500, {"error": "server_error", "message": str(exc)})

    def _send_web(self, rel: str) -> None:
        dest = (WEB_ROOT / rel).resolve()
        if not str(dest).startswith(str(WEB_ROOT.resolve())):
            _json(self, 404, {"error": "not_found", "message": "Not found."})
            return
        self._send_file(dest, None)

    def _send_file(self, path: Path, content_type: str | None) -> None:
        if not path.is_file():
            _json(self, 404, {"error": "not_found", "message": f"Not found: {path.name}"})
            return
        ctype = content_type or mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_video(self, job_id: str, *, download: bool) -> None:
        if not JOB_ID_RE.match(job_id):
            raise JobNotFoundError("Invalid job id.")
        job = jobs.load_job(job_id)
        path = Path(job["output_path"]) if job.get("output_path") else jobs.output_file(job_id)
        if not path.is_file():
            raise JobNotFoundError("This job has no video yet.")
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "video/mp4")
        self.send_header("Content-Length", str(len(data)))
        filename = f"video-agent-{job_id}.mp4"
        disposition = "attachment" if download else "inline"
        self.send_header("Content-Disposition", f'{disposition}; filename="{filename}"')
        self.end_headers()
        self.wfile.write(data)


def serve(host: str = HOST, port: int = PORT) -> None:
    ensure_dirs()
    httpd = ThreadingHTTPServer((host, port), Handler)
    print(f"Video Agent: http://{host}:{port}")
    print(f"Root: {AGENT_ROOT}")
    print("Default engine: local FFmpeg (free). Paid providers are not used by this UI.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Video Agent.")
        httpd.server_close()


if __name__ == "__main__":
    serve()
