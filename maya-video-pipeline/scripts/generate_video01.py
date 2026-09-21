#!/usr/bin/env python3
"""Maya Video #1 generator.

Default = DRY RUN. Running this file must not submit a paid generation.

Paid generation requires BOTH:
  python scripts/generate_video01.py --execute --confirm VIDEO01

One API request maximum. No retry. No fallback model. No second variant.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PIPELINE_ROOT = Path(__file__).resolve().parent.parent
SOURCE_PATH = PIPELINE_ROOT / "sources" / "video01-approved-start.png"
SOURCE_SHA_PATH = PIPELINE_ROOT / "sources" / "video01-approved-start.sha256"
PROMPT_PATH = PIPELINE_ROOT / "prompts" / "video01-final.txt"
NEGATIVE_PATH = PIPELINE_ROOT / "prompts" / "video01-negative.txt"
OUTPUT_DIR = PIPELINE_ROOT / "generations" / "video01"
OUTPUT_VIDEO = OUTPUT_DIR / "video01.mp4"
OUTPUT_META = OUTPUT_DIR / "metadata.json"
OUTPUT_ERROR = OUTPUT_DIR / "error.json"
QC_DIR = OUTPUT_DIR / "qc"
CONFIRM_TOKEN = "VIDEO01"
HTTP_TIMEOUT_PROBE = 20
HTTP_TIMEOUT_GENERATE = 120
POLL_SECONDS = 12
POLL_MAX = 90  # 90 * 12s = 18 minutes

RUNWAY_PROMPT_MAX = 1000
RUNWAY_CONDENSED_PROMPT = (
    "Animate only this approved photo of Maya, a fictional adult. Same woman, "
    "new natural moment. Do not beautify or change her face, body, hair, or outfit. "
    "Brief breathing beat in the original over-shoulder pose, then a subtle weight "
    "shift, hip settle, and a small torso/shoulder turn toward camera. Phone lowers "
    "slightly. Head follows the shoulder with a delayed independent turn; chin lifts "
    "slightly; eyes meet the lens; a gradual playful half-smile; one natural blink; "
    "mouth closed, no talking. Ponytail moves with delayed inertia. Casual handheld "
    "smartphone camera, tiny drift, no zoom or orbit. Same bedroom, same black top "
    "and gray floral pants. Candid, confident, feminine, slightly teasing, not CGI."
)


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if key and key not in os.environ:
            os.environ[key] = value


def first_env(*names: str) -> tuple[str | None, str | None]:
    for name in names:
        value = os.environ.get(name, "").strip()
        if value:
            return name, value
    return None, None


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8").strip()


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_expected_sha256(path: Path) -> str:
    text = read_text(path).split()[0].strip().lower()
    if len(text) != 64:
        raise RuntimeError(f"Invalid SHA256 file: {path}")
    return text


def png_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise RuntimeError(f"Source is not a PNG: {path}")
    import struct

    width, height = struct.unpack(">II", data[16:24])
    return width, height


def ffmpeg_version() -> str:
    try:
        proc = subprocess.run(
            ["ffmpeg", "-version"],
            check=True,
            capture_output=True,
            text=True,
        )
        return proc.stdout.splitlines()[0].strip()
    except (OSError, subprocess.CalledProcessError) as exc:
        return f"MISSING ({exc})"


def http_json(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    body: dict[str, Any] | bytes | None = None,
    timeout: int = HTTP_TIMEOUT_PROBE,
) -> tuple[int, Any, str]:
    data: bytes | None = None
    req_headers = dict(headers or {})
    if isinstance(body, dict):
        data = json.dumps(body).encode("utf-8")
        req_headers.setdefault("Content-Type", "application/json")
    elif isinstance(body, bytes):
        data = body
    request = urllib.request.Request(url, data=data, method=method, headers=req_headers)
    context = ssl.create_default_context()
    try:
        with urllib.request.urlopen(request, timeout=timeout, context=context) as response:
            raw = response.read()
            text = raw.decode("utf-8", errors="replace")
            parsed: Any
            try:
                parsed = json.loads(text) if text else {}
            except json.JSONDecodeError:
                parsed = text
            return int(response.status), parsed, text
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        text = raw.decode("utf-8", errors="replace")
        try:
            parsed = json.loads(text) if text else {}
        except json.JSONDecodeError:
            parsed = text
        return int(exc.code), parsed, text
    except Exception as exc:  # noqa: BLE001 — probe must never crash the dry run
        return 0, {"error": str(exc)}, str(exc)


def summarize_error(payload: Any, raw: str) -> str:
    if isinstance(payload, dict):
        for key in ("error", "message", "detail", "reason"):
            value = payload.get(key)
            if isinstance(value, dict):
                message = value.get("message") or value.get("reason") or value.get("status")
                if message:
                    return str(message)[:240]
            if value:
                return str(value)[:240]
    return (raw or str(payload))[:240]


def probe_google() -> dict[str, Any]:
    env_name, key = first_env("GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENAI_API_KEY")
    result: dict[str, Any] = {
        "id": "google_veo",
        "name": "Google Veo",
        "env_name": env_name,
        "configured": bool(key),
        "auth": "MISSING",
        "balance": "NO KEY",
        "image_to_video": False,
        "portrait_9_16": True,
        "usable": False,
        "model": None,
        "models": [],
        "notes": [],
    }
    if not key:
        return result
    url = "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=" + urllib.parse.quote(key)
    status, payload, raw = http_json("GET", url)
    if status != 200:
        result["auth"] = f"FAIL HTTP {status}"
        result["balance"] = "AUTH FAILED"
        result["notes"].append(summarize_error(payload, raw))
        return result
    models = []
    for item in (payload or {}).get("models", []):
        name = str(item.get("name") or item.get("displayName") or "")
        short = name.split("/")[-1].lower()
        if "veo" in short:
            models.append(short)
    result["models"] = models
    preferred = [
        "veo-3.1-generate-001",
        "veo-3.1-generate-preview",
        "veo-3.1-fast-generate-preview",
        "veo-3.1-lite-generate-preview",
        "veo-3.0-generate-preview",
        "veo-2.0-generate-001",
    ]
    chosen = next((model for model in preferred if model in models), models[0] if models else None)
    result["model"] = chosen
    result["auth"] = "OK"
    result["balance"] = "AUTH OK, CREDIT BALANCE NOT EXPOSED"
    result["image_to_video"] = bool(chosen)
    result["usable"] = bool(chosen)
    if not chosen:
        result["notes"].append("Authenticated, but no Veo model was listed for this key.")
        result["usable"] = False
    return result


def probe_runway() -> dict[str, Any]:
    env_name, key = first_env("RUNWAYML_API_SECRET", "RUNWAY_API_KEY")
    result: dict[str, Any] = {
        "id": "runway",
        "name": "Runway",
        "env_name": env_name,
        "configured": bool(key),
        "auth": "MISSING",
        "balance": "NO KEY",
        "image_to_video": True,
        "portrait_9_16": True,
        "usable": False,
        "model": "gen4_turbo",
        "notes": [],
    }
    if not key:
        return result
    status, payload, raw = http_json(
        "GET",
        "https://api.dev.runwayml.com/v1/tasks?limit=1",
        headers={
            "Authorization": f"Bearer {key}",
            "X-Runway-Version": "2024-11-06",
        },
    )
    if status in (200, 404):
        result["auth"] = "OK"
        result["balance"] = "AUTH OK, CREDIT BALANCE NOT EXPOSED"
        result["usable"] = True
        return result
    result["auth"] = f"FAIL HTTP {status}"
    result["balance"] = "AUTH FAILED"
    result["notes"].append(summarize_error(payload, raw))
    return result


def probe_fal() -> dict[str, Any]:
    env_name, key = first_env("FAL_KEY", "FAL_API_KEY")
    result: dict[str, Any] = {
        "id": "fal",
        "name": "fal.ai",
        "env_name": env_name,
        "configured": bool(key),
        "auth": "MISSING",
        "balance": "NO KEY",
        "image_to_video": True,
        "portrait_9_16": True,
        "usable": False,
        "model": "fal-ai/veo3.1/image-to-video",
        "notes": [
            "Previously observed 403 User is locked / Exhausted balance. "
            "Will not be selected unless current balance is positively confirmed."
        ],
    }
    if not key:
        result["notes"].append("No fal.ai key in environment.")
        return result
    headers = {"Authorization": f"Key {key}"}
    status, payload, raw = http_json(
        "GET",
        "https://api.fal.ai/v1/account/billing?expand=credits",
        headers=headers,
    )
    text_blob = json.dumps(payload).lower() + raw.lower()
    locked = status == 403 or "exhausted" in text_blob or "locked" in text_blob
    if locked:
        result["auth"] = f"LOCKED HTTP {status}" if status else "LOCKED"
        result["balance"] = "NOT USABLE (locked or exhausted)"
        result["usable"] = False
        result["notes"].append(summarize_error(payload, raw))
        return result
    if status == 200:
        credits = (payload or {}).get("credits") if isinstance(payload, dict) else None
        balance = None
        if isinstance(credits, dict):
            balance = credits.get("current_balance")
        result["auth"] = "OK"
        if balance is None:
            result["balance"] = "AUTH OK, CREDIT BALANCE UNKNOWN — NOT SELECTED"
            result["usable"] = False
            result["notes"].append("Billing endpoint did not return current_balance.")
            return result
        try:
            numeric = float(balance)
        except (TypeError, ValueError):
            numeric = 0.0
        result["balance"] = f"current_balance={numeric}"
        result["usable"] = numeric > 0
        if numeric <= 0:
            result["notes"].append("Balance is zero or not positive. Not selected.")
        return result
    result["auth"] = f"FAIL HTTP {status}"
    result["balance"] = "NOT CONFIRMED — NOT SELECTED"
    result["notes"].append(summarize_error(payload, raw))
    return result


def probe_replicate() -> dict[str, Any]:
    env_name, key = first_env("REPLICATE_API_TOKEN")
    result: dict[str, Any] = {
        "id": "replicate",
        "name": "Replicate",
        "env_name": env_name,
        "configured": bool(key),
        "auth": "MISSING",
        "balance": "NO KEY",
        "image_to_video": True,
        "portrait_9_16": True,
        "usable": False,
        "model": None,
        "notes": [],
    }
    if not key:
        return result
    status, payload, raw = http_json(
        "GET",
        "https://api.replicate.com/v1/account",
        headers={"Authorization": f"Bearer {key}"},
    )
    if status != 200:
        result["auth"] = f"FAIL HTTP {status}"
        result["balance"] = "AUTH FAILED"
        result["notes"].append(summarize_error(payload, raw))
        return result
    result["auth"] = "OK"
    result["balance"] = "AUTH OK, CREDIT BALANCE NOT EXPOSED"
    result["usable"] = False
    result["notes"].append("Configured, but not preferred over Veo/Runway for this identity-lock job.")
    return result


def probe_luma() -> dict[str, Any]:
    env_name, key = first_env("LUMAAI_API_KEY", "LUMA_API_KEY")
    result: dict[str, Any] = {
        "id": "luma",
        "name": "Luma",
        "env_name": env_name,
        "configured": bool(key),
        "auth": "MISSING",
        "balance": "NO KEY",
        "image_to_video": True,
        "portrait_9_16": True,
        "usable": False,
        "model": None,
        "notes": [],
    }
    if not key:
        return result
    status, payload, raw = http_json(
        "GET",
        "https://api.lumalabs.ai/dream-machine/v1/generations?limit=1",
        headers={"Authorization": f"Bearer {key}"},
    )
    if status not in (200, 404):
        result["auth"] = f"FAIL HTTP {status}"
        result["balance"] = "AUTH FAILED"
        result["notes"].append(summarize_error(payload, raw))
        return result
    result["auth"] = "OK"
    result["balance"] = "AUTH OK, CREDIT BALANCE NOT EXPOSED"
    result["usable"] = False
    result["notes"].append("Configured, but not preferred over Veo/Runway for this identity-lock job.")
    return result


def select_provider(probes: list[dict[str, Any]]) -> dict[str, Any] | None:
    by_id = {item["id"]: item for item in probes}
    for candidate_id in ("google_veo", "runway", "fal"):
        candidate = by_id.get(candidate_id)
        if candidate and candidate.get("usable"):
            return candidate
    return None


def selected_settings(provider: dict[str, Any] | None) -> dict[str, Any]:
    if not provider:
        return {
            "provider": "NONE",
            "model": "NONE",
            "aspect_ratio": "9:16",
            "duration": "6s (target)",
            "resolution": "720p",
            "audio": "none",
            "outputs": 1,
        }
    if provider["id"] == "google_veo":
        return {
            "provider": provider["name"],
            "model": provider.get("model") or "veo-3.1-generate-preview",
            "aspect_ratio": "9:16",
            "duration": "6s",
            "resolution": "720p",
            "audio": "off (generateAudio=false)",
            "outputs": 1,
        }
    if provider["id"] == "runway":
        return {
            "provider": provider["name"],
            "model": "gen4_turbo",
            "aspect_ratio": "9:16 (720:1280)",
            "duration": "5s",
            "resolution": "720x1280",
            "audio": "none",
            "outputs": 1,
        }
    return {
        "provider": provider["name"],
        "model": provider.get("model") or "UNKNOWN",
        "aspect_ratio": "9:16",
        "duration": "5s",
        "resolution": "720p",
        "audio": "none",
        "outputs": 1,
    }


def print_cost_safety(settings: dict[str, Any], source_sha: str, balance: str) -> None:
    print("PROVIDER:", settings["provider"])
    print("MODEL:", settings["model"])
    print("SOURCE:", SOURCE_PATH)
    print("SOURCE SHA256:", source_sha)
    print("ASPECT RATIO:", settings["aspect_ratio"])
    print("DURATION:", settings["duration"])
    print("RESOLUTION:", settings["resolution"])
    print("OUTPUT COUNT:", settings["outputs"])
    print("AUDIO:", settings["audio"])
    print("ESTIMATED COST: UNKNOWN")
    print("ACCOUNT/BALANCE STATUS:", balance)


def print_preflight(
    *,
    source_sha: str,
    prompt_ready: bool,
    negative_ready: bool,
    ffmpeg: str,
    settings: dict[str, Any],
    auth: str,
    balance: str,
    image_to_video: str,
    portrait: str,
    dry_run: bool,
    ready: bool,
) -> None:
    print("====================================")
    print("MAYA VIDEO #1 — FINAL PRE-FLIGHT")
    print("====================================")
    print("SOURCE:", SOURCE_PATH)
    print("SOURCE SHA256:", source_sha)
    print("MASTER MAYA LOCK: ACTIVE")
    print("PROMPT:", "READY" if prompt_ready else "NOT READY")
    print("NEGATIVE:", "READY" if negative_ready else "NOT READY")
    print("FFMPEG:", ffmpeg)
    print("PROVIDER:", settings["provider"])
    print("MODEL:", settings["model"])
    print("AUTH:", auth)
    print("BALANCE/ACCESS:", balance)
    print("IMAGE-TO-VIDEO:", image_to_video)
    print("9:16:", portrait)
    print("DURATION:", settings["duration"])
    print("RESOLUTION:", settings["resolution"])
    print("OUTPUTS: 1")
    print("ESTIMATED COST: UNKNOWN")
    print("DRY RUN:", "YES" if dry_run else "NO")
    print("PAID GENERATIONS MADE: 0")
    print("READY TO GENERATE:", "YES" if ready else "NO")
    if ready and dry_run:
        print()
        print("NEXT COMMAND:")
        print("python scripts/generate_video01.py --execute --confirm VIDEO01")


def save_error(payload: dict[str, Any]) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = dict(payload)
    payload.setdefault("saved_at", utc_now())
    OUTPUT_ERROR.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def extract_qc_frames(video_path: Path) -> None:
    QC_DIR.mkdir(parents=True, exist_ok=True)
    probe = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(video_path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    duration = float(probe.stdout.strip() or "0")
    if duration <= 0:
        raise RuntimeError("Could not read generated video duration")
    percents = (0, 20, 40, 60, 80, 100)
    frame_paths: list[Path] = []
    for percent in percents:
        timestamp = 0.0 if percent == 0 else min(duration * (percent / 100.0), max(duration - 0.04, 0))
        dest = QC_DIR / f"frame-{percent:02d}.jpg"
        subprocess.run(
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
            check=True,
            capture_output=True,
        )
        frame_paths.append(dest)
    sheet = QC_DIR / "contact-sheet.jpg"
    scaled = [f"[{index}:v]scale=360:-1[s{index}]" for index in range(6)]
    filter_complex = (
        ";".join(scaled)
        + ";[s0][s1][s2]hstack=inputs=3[top];[s3][s4][s5]hstack=inputs=3[bottom];"
        + "[top][bottom]vstack=inputs=2"
    )
    cmd = ["ffmpeg", "-y"]
    for path in frame_paths:
        cmd.extend(["-i", str(path)])
    cmd.extend(["-filter_complex", filter_complex, str(sheet)])
    subprocess.run(cmd, check=True, capture_output=True)


def generate_google(settings: dict[str, Any], prompt: str, negative: str) -> None:
    _env_name, key = first_env("GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENAI_API_KEY")
    if not key:
        raise RuntimeError("Google key disappeared before execute")
    image_b64 = base64.b64encode(SOURCE_PATH.read_bytes()).decode("ascii")
    model = settings["model"]
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        + urllib.parse.quote(model, safe="-.")
        + ":predictLongRunning?key="
        + urllib.parse.quote(key)
    )
    body = {
        "instances": [
            {
                "prompt": prompt,
                "image": {
                    "bytesBase64Encoded": image_b64,
                    "mimeType": "image/png",
                },
            }
        ],
        "parameters": {
            "aspectRatio": "9:16",
            "durationSeconds": 6,
            "negativePrompt": negative,
            "personGeneration": "allow_adult",
            "sampleCount": 1,
            "resolution": "720p",
            "generateAudio": False,
        },
    }
    status, payload, raw = http_json("POST", url, body=body, timeout=HTTP_TIMEOUT_GENERATE)
    if status not in (200, 201):
        raise RuntimeError(f"Google Veo start failed HTTP {status}: {summarize_error(payload, raw)}")
    operation_name = ""
    if isinstance(payload, dict):
        operation_name = str(payload.get("name") or "")
    if not operation_name:
        raise RuntimeError("Google Veo did not return an operation name")
    op_url = (
        "https://generativelanguage.googleapis.com/v1beta/"
        + operation_name
        + "?key="
        + urllib.parse.quote(key)
    )
    video_bytes: bytes | None = None
    last_payload: Any = payload
    for _ in range(POLL_MAX):
        time.sleep(POLL_SECONDS)
        status, last_payload, raw = http_json("GET", op_url, timeout=HTTP_TIMEOUT_GENERATE)
        if status != 200:
            raise RuntimeError(f"Google Veo poll failed HTTP {status}: {summarize_error(last_payload, raw)}")
        if not isinstance(last_payload, dict):
            continue
        if last_payload.get("error"):
            raise RuntimeError(f"Google Veo operation error: {summarize_error(last_payload, raw)}")
        if not last_payload.get("done"):
            continue
        video_bytes = download_google_video(last_payload, key)
        break
    else:
        raise RuntimeError("Google Veo timed out waiting for a single operation")
    if not video_bytes:
        raise RuntimeError("Google Veo completed without a video payload")
    OUTPUT_VIDEO.write_bytes(video_bytes)
    write_metadata(settings, {"operation": operation_name, "response_keys": sorted(list(last_payload))})


def http_bytes(url: str, headers: dict[str, str] | None = None) -> bytes:
    request = urllib.request.Request(url, headers=headers or {}, method="GET")
    context = ssl.create_default_context()
    with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_GENERATE, context=context) as response:
        return response.read()


def download_google_video(payload: dict[str, Any], api_key: str) -> bytes | None:
    response = payload.get("response") or {}
    if not isinstance(response, dict):
        return None
    candidates: list[Any] = []
    for key_name in ("generateVideoResponse", "generateVideoResult", "generateVideosResponse"):
        block = response.get(key_name)
        if isinstance(block, dict):
            candidates.extend(block.get("generatedSamples") or block.get("generatedVideos") or [])
    candidates.extend(response.get("generatedVideos") or [])
    candidates.extend(response.get("videos") or [])
    for item in candidates:
        if not isinstance(item, dict):
            continue
        video = item.get("video") if isinstance(item.get("video"), dict) else item
        if not isinstance(video, dict):
            continue
        encoded = video.get("bytesBase64Encoded") or video.get("videoBytes")
        if encoded:
            return base64.b64decode(encoded)
        uri = video.get("uri") or video.get("downloadUri")
        if uri:
            sep = "&" if "?" in str(uri) else "?"
            return http_bytes(f"{uri}{sep}key={urllib.parse.quote(api_key)}")
    encoded = response.get("bytesBase64Encoded")
    if encoded:
        return base64.b64decode(encoded)
    return None


def generate_runway(settings: dict[str, Any], prompt: str) -> None:
    _env_name, key = first_env("RUNWAYML_API_SECRET", "RUNWAY_API_KEY")
    if not key:
        raise RuntimeError("Runway key disappeared before execute")
    if len(prompt) > RUNWAY_PROMPT_MAX:
        prompt = RUNWAY_CONDENSED_PROMPT
    image_b64 = "data:image/png;base64," + base64.b64encode(SOURCE_PATH.read_bytes()).decode("ascii")
    status, payload, raw = http_json(
        "POST",
        "https://api.dev.runwayml.com/v1/image_to_video",
        headers={
            "Authorization": f"Bearer {key}",
            "X-Runway-Version": "2024-11-06",
        },
        body={
            "model": settings["model"],
            "promptImage": image_b64,
            "promptText": prompt,
            "ratio": "720:1280",
            "duration": 5,
            "audio": False,
        },
        timeout=HTTP_TIMEOUT_GENERATE,
    )
    if status not in (200, 201):
        raise RuntimeError(f"Runway start failed HTTP {status}: {summarize_error(payload, raw)}")
    task_id = ""
    if isinstance(payload, dict):
        task_id = str(payload.get("id") or "")
    if not task_id:
        raise RuntimeError("Runway did not return a task id")
    task_url = f"https://api.dev.runwayml.com/v1/tasks/{task_id}"
    last_payload: Any = payload
    output_url = None
    for _ in range(POLL_MAX):
        time.sleep(POLL_SECONDS)
        status, last_payload, raw = http_json(
            "GET",
            task_url,
            headers={
                "Authorization": f"Bearer {key}",
                "X-Runway-Version": "2024-11-06",
            },
            timeout=HTTP_TIMEOUT_GENERATE,
        )
        if status != 200:
            raise RuntimeError(f"Runway poll failed HTTP {status}: {summarize_error(last_payload, raw)}")
        if not isinstance(last_payload, dict):
            continue
        state = str(last_payload.get("status") or last_payload.get("state") or "").lower()
        if state in {"failed", "error", "cancelled"}:
            raise RuntimeError(f"Runway task failed: {summarize_error(last_payload, raw)}")
        if state in {"succeeded", "success", "complete", "completed"}:
            output = last_payload.get("output") or last_payload.get("artifacts") or []
            if isinstance(output, list) and output:
                first = output[0]
                output_url = first if isinstance(first, str) else (first.get("url") if isinstance(first, dict) else None)
            elif isinstance(output, str):
                output_url = output
            break
    else:
        raise RuntimeError("Runway timed out waiting for a single task")
    if not output_url:
        raise RuntimeError("Runway completed without an output URL")
    request = urllib.request.Request(str(output_url))
    with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_GENERATE) as resp:
        OUTPUT_VIDEO.write_bytes(resp.read())
    write_metadata(settings, {"task_id": task_id})


def generate_fal(settings: dict[str, Any], prompt: str, negative: str) -> None:
    _env_name, key = first_env("FAL_KEY", "FAL_API_KEY")
    if not key:
        raise RuntimeError("fal.ai key disappeared before execute")
    recheck = probe_fal()
    if not recheck.get("usable"):
        raise RuntimeError(
            "fal.ai re-check did not confirm a usable balance. Refusing to submit."
        )
    image_url = "data:image/png;base64," + base64.b64encode(SOURCE_PATH.read_bytes()).decode("ascii")
    model = str(settings["model"])
    status, payload, raw = http_json(
        "POST",
        "https://queue.fal.run/" + model,
        headers={"Authorization": f"Key {key}"},
        body={
            "prompt": prompt,
            "negative_prompt": negative,
            "image_url": image_url,
            "aspect_ratio": "9:16",
            "duration": "6s",
            "generate_audio": False,
        },
        timeout=HTTP_TIMEOUT_GENERATE,
    )
    if status not in (200, 201, 202):
        raise RuntimeError(f"fal.ai start failed HTTP {status}: {summarize_error(payload, raw)}")
    if not isinstance(payload, dict):
        raise RuntimeError("fal.ai start returned a non-JSON body")
    status_url = payload.get("status_url")
    response_url = payload.get("response_url")
    request_id = payload.get("request_id")
    if not status_url or not response_url:
        raise RuntimeError("fal.ai did not return queue URLs")
    last_payload: Any = payload
    for _ in range(POLL_MAX):
        time.sleep(POLL_SECONDS)
        status, last_payload, raw = http_json(
            "GET",
            str(status_url),
            headers={"Authorization": f"Key {key}"},
            timeout=HTTP_TIMEOUT_GENERATE,
        )
        if status != 200:
            raise RuntimeError(f"fal.ai poll failed HTTP {status}: {summarize_error(last_payload, raw)}")
        state = ""
        if isinstance(last_payload, dict):
            state = str(last_payload.get("status") or "").upper()
        if state in {"FAILED", "ERROR", "CANCELLED"}:
            raise RuntimeError(f"fal.ai task failed: {summarize_error(last_payload, raw)}")
        if state == "COMPLETED":
            break
    else:
        raise RuntimeError("fal.ai timed out waiting for a single request")
    status, result, raw = http_json(
        "GET",
        str(response_url),
        headers={"Authorization": f"Key {key}"},
        timeout=HTTP_TIMEOUT_GENERATE,
    )
    if status != 200:
        raise RuntimeError(f"fal.ai result failed HTTP {status}: {summarize_error(result, raw)}")
    video_url = None
    if isinstance(result, dict):
        video = (result.get("video") or {})
        if isinstance(video, dict):
            video_url = video.get("url")
        if not video_url:
            video_url = result.get("video_url")
    if not video_url:
        raise RuntimeError("fal.ai completed without a video URL")
    OUTPUT_VIDEO.write_bytes(http_bytes(str(video_url)))
    write_metadata(settings, {"request_id": request_id})


def write_metadata(settings: dict[str, Any], extra: dict[str, Any]) -> None:
    payload = {
        "clip": "VIDEO01",
        "saved_at": utc_now(),
        "source": str(SOURCE_PATH),
        "source_sha256": file_sha256(SOURCE_PATH),
        "provider": settings["provider"],
        "model": settings["model"],
        "aspect_ratio": settings["aspect_ratio"],
        "duration": settings["duration"],
        "resolution": settings["resolution"],
        "audio": settings["audio"],
        "outputs": 1,
        "retries": 0,
        "estimated_cost": "UNKNOWN",
        **extra,
    }
    OUTPUT_META.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Maya Video #1 controlled generator")
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Submit one paid generation. Also requires --confirm VIDEO01.",
    )
    parser.add_argument(
        "--confirm",
        default="",
        help="Must be VIDEO01 to allow paid generation.",
    )
    return parser.parse_args()


def main() -> int:
    load_env_file(PIPELINE_ROOT / ".env")
    load_env_file(PIPELINE_ROOT.parent / ".env")
    load_env_file(PIPELINE_ROOT.parent / ".env.local")
    args = parse_args()
    dry_run = not (args.execute and args.confirm == CONFIRM_TOKEN)

    if not SOURCE_PATH.is_file():
        print("SOURCE MISSING:", SOURCE_PATH, file=sys.stderr)
        return 2
    if not SOURCE_SHA_PATH.is_file():
        print("SOURCE SHA256 FILE MISSING:", SOURCE_SHA_PATH, file=sys.stderr)
        return 2

    source_sha = file_sha256(SOURCE_PATH)
    expected_sha = load_expected_sha256(SOURCE_SHA_PATH)
    if source_sha != expected_sha:
        print("SOURCE SHA256 MISMATCH — refusing to continue.", file=sys.stderr)
        print("computed:", source_sha, file=sys.stderr)
        print("expected:", expected_sha, file=sys.stderr)
        return 2

    prompt_ready = PROMPT_PATH.is_file() and bool(read_text(PROMPT_PATH))
    negative_ready = NEGATIVE_PATH.is_file() and bool(read_text(NEGATIVE_PATH))
    ffmpeg = ffmpeg_version()
    ffmpeg_ok = ffmpeg.startswith("ffmpeg version")

    probes = [probe_google(), probe_runway(), probe_fal(), probe_replicate(), probe_luma()]
    provider = select_provider(probes)
    settings = selected_settings(provider)
    auth = provider["auth"] if provider else "NO PROVIDER KEYS FOUND"
    balance = provider["balance"] if provider else "NO CONFIGURED VIDEO PROVIDER"
    image_to_video = (
        "YES" if provider and provider.get("image_to_video") else "NO (no usable provider)"
    )
    portrait = "YES (requested)"

    ready = bool(
        prompt_ready
        and negative_ready
        and ffmpeg_ok
        and provider
        and provider.get("usable")
        and source_sha == expected_sha
    )

    print_cost_safety(settings, source_sha, balance)
    print()
    print("Configured provider probes (secrets redacted):")
    for item in probes:
        print(
            f"- {item['name']}: configured={item['configured']} auth={item['auth']} "
            f"balance={item['balance']} usable={item['usable']}"
        )
        for note in item.get("notes") or []:
            print(f"  note: {note}")
    print()
    print_preflight(
        source_sha=source_sha,
        prompt_ready=prompt_ready,
        negative_ready=negative_ready,
        ffmpeg=ffmpeg,
        settings=settings,
        auth=auth,
        balance=balance,
        image_to_video=image_to_video,
        portrait=portrait,
        dry_run=dry_run,
        ready=ready,
    )

    if dry_run:
        if args.execute and args.confirm != CONFIRM_TOKEN:
            print()
            print("EXECUTE REFUSED: --confirm VIDEO01 is required. No API request was sent.")
            save_error(
                {
                    "error": "execute_refused_bad_confirm",
                    "paid_generations_made": 0,
                }
            )
            return 2
        print()
        print("DRY RUN COMPLETE. PAID GENERATIONS MADE: 0")
        return 0

    if not ready:
        save_error(
            {
                "error": "execute_refused_not_ready",
                "paid_generations_made": 0,
                "ready": False,
            }
        )
        print()
        print("EXECUTE REFUSED: pre-flight is not READY. No API request was sent.")
        return 2

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    QC_DIR.mkdir(parents=True, exist_ok=True)
    prompt = read_text(PROMPT_PATH)
    negative = read_text(NEGATIVE_PATH)

    print()
    print("SUBMITTING ONE IMAGE-TO-VIDEO REQUEST. NO RETRY.")
    try:
        assert provider is not None
        if provider["id"] == "google_veo":
            generate_google(settings, prompt, negative)
        elif provider["id"] == "runway":
            generate_runway(settings, prompt)
        elif provider["id"] == "fal":
            generate_fal(settings, prompt, negative)
        else:
            raise RuntimeError(f"Unsupported provider {provider['id']}")
        extract_qc_frames(OUTPUT_VIDEO)
    except Exception as exc:  # noqa: BLE001 — one shot, then stop
        save_error(
            {
                "error": str(exc),
                "paid_generations_made": "unknown_after_submit",
                "stopped": True,
                "retry": False,
            }
        )
        print("GENERATION FAILED. STOPPING. NO RETRY.")
        print(str(exc))
        return 1

    print("SAVED:", OUTPUT_VIDEO)
    print("METADATA:", OUTPUT_META)
    print("QC FRAMES:", QC_DIR)
    print("PAID GENERATIONS MADE: 1")
    print("STOP.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
