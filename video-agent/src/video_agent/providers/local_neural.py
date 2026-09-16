"""Real local neural image-to-video (LTX-Video 2B) or localhost worker."""

from __future__ import annotations

import os
import subprocess
import time
from pathlib import Path
from typing import Any

from ..errors import MissingImageError, ModelUnavailableError, GenerationFailureError
from ..ffmpeg_tools import RESOLUTIONS, transcode_vertical_h264
from ..neural_env import check_neural_environment
from ..neural_spec import (
    HF_HOME,
    LOW_MEMORY_PRESET,
    MAYA_NEURAL_NEGATIVE,
    MAYA_NEURAL_PROMPT,
    MODEL_ID,
    MODEL_NAME,
    VENV_DIR,
)
from ..worker_client import worker_generate
from .base import GenerateRequest, ProgressCb, VideoProvider


class LocalNeuralVideoProvider(VideoProvider):
    id = "local_neural"
    name = "Local AI video (LTX-Video 2B)"
    paid = False

    def check_environment(self) -> dict[str, Any]:
        return check_neural_environment()

    def estimate_requirements(self) -> dict[str, Any]:
        from ..neural_spec import estimate_requirements

        return estimate_requirements()

    def validate(self, request: GenerateRequest) -> dict[str, Any]:
        env = self.check_environment()
        if not env["available"]:
            raise ModelUnavailableError(env["reason"], details=env)
        if request.mode == "image_to_video" and request.image_path is None:
            raise MissingImageError("Image-to-video requires a reference image.")
        preset = LOW_MEMORY_PRESET
        return {
            "provider": self.id,
            "paid": False,
            "neural": True,
            "model": MODEL_NAME,
            "model_id": MODEL_ID,
            "device": env.get("local_device") or "worker",
            "low_memory": preset,
            "identity_preserving": False,
            "notes": [
                "This is real neural image-to-video.",
                "Identity is conditioned on the source frame as strongly as LTX allows.",
                "Perfect face lock is not promised.",
            ],
        }

    def generate_from_text(self, request: GenerateRequest, dest: Path, progress: ProgressCb | None = None) -> Path:
        return self._generate(request, dest, progress)

    def generate_from_image(self, request: GenerateRequest, dest: Path, progress: ProgressCb | None = None) -> Path:
        if request.image_path is None:
            raise MissingImageError("Image-to-video requires a reference image.")
        return self._generate(request, dest, progress)

    def get_status(self) -> dict[str, Any]:
        env = self.check_environment()
        return {
            "id": self.id,
            "name": self.name,
            "paid": False,
            "usable": env["available"],
            "image_to_video": env["available"],
            "text_to_video": env["available"],
            "portrait_9_16": True,
            "neural": True,
            "ui_label": env["ui_label"],
            "detail": env["reason"],
            "model": MODEL_NAME,
        }

    def cancel_generation(self, job_id: str) -> None:
        return self.cancel(job_id)

    def _generate(self, request: GenerateRequest, dest: Path, progress: ProgressCb | None) -> Path:
        env = self.check_environment()
        if not env["available"]:
            raise ModelUnavailableError(env["reason"], details=env)
        preset = LOW_MEMORY_PRESET
        prompt = request.prompt
        negative = request.negative_prompt
        if request.identity_lock:
            if not prompt:
                prompt = MAYA_NEURAL_PROMPT
            if not negative:
                negative = MAYA_NEURAL_NEGATIVE
        seed = int(request.extra.get("seed") or 42)
        raw = dest.parent / f"{dest.stem}.neural-raw.mp4"
        if progress:
            progress("generating", 42, f"Running {MODEL_NAME} low-memory 3s vertical I2V.")
        started = time.time()
        if env["local_ready"] or request.extra.get("force_local"):
            self._run_local(request, raw, prompt, negative, preset, seed)
        else:
            self._run_worker(request, raw, prompt, negative, preset, seed)
        if progress:
            progress("processing", 82, "Post-processing neural output to 9:16 H.264.")
        width, height = RESOLUTIONS.get(request.quality, RESOLUTIONS["720p"])
        info = transcode_vertical_h264(raw, dest, width=width, height=height, min_duration=1.5)
        raw.unlink(missing_ok=True)
        elapsed = round(time.time() - started, 2)
        request.extra["neural_seconds"] = elapsed
        request.extra["neural_probe"] = info
        return dest

    def _run_local(
        self,
        request: GenerateRequest,
        raw: Path,
        prompt: str,
        negative: str,
        preset: dict[str, Any],
        seed: int,
    ) -> None:
        python = VENV_DIR / "bin" / "python"
        if os.name == "nt":
            python = VENV_DIR / "Scripts" / "python.exe"
        env = os.environ.copy()
        env["HF_HOME"] = str(HF_HOME)
        env["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"
        src = Path(__file__).resolve().parents[1]
        env["PYTHONPATH"] = str(src.parent) + os.pathsep + env.get("PYTHONPATH", "")
        cmd = [
            str(python),
            "-m",
            "video_agent.neural.ltx_i2v",
            "--prompt",
            prompt,
            "--negative",
            negative,
            "--out",
            str(raw),
            "--mode",
            request.mode,
            "--width",
            str(preset["width"]),
            "--height",
            str(preset["height"]),
            "--num-frames",
            str(preset["num_frames"]),
            "--frame-rate",
            str(preset["frame_rate"]),
            "--steps",
            str(preset["num_inference_steps"]),
            "--guidance",
            str(preset["guidance_scale"]),
            "--seed",
            str(seed),
            "--model-id",
            MODEL_ID,
        ]
        if request.image_path:
            cmd.extend(["--image", str(request.image_path)])
        proc = subprocess.run(cmd, capture_output=True, text=True, env=env)
        if proc.returncode != 0:
            tail = (proc.stderr or proc.stdout or "")[-1200:]
            raise GenerationFailureError(f"LTX-Video local run failed.\n{tail}")
        if not raw.is_file():
            raise GenerationFailureError("LTX-Video finished without writing a video file.")

    def _run_worker(
        self,
        request: GenerateRequest,
        raw: Path,
        prompt: str,
        negative: str,
        preset: dict[str, Any],
        seed: int,
    ) -> None:
        image_bytes = request.image_path.read_bytes() if request.image_path else None
        data = worker_generate(
            {
                "prompt": prompt,
                "negative_prompt": negative,
                "mode": request.mode,
                "width": preset["width"],
                "height": preset["height"],
                "num_frames": preset["num_frames"],
                "frame_rate": preset["frame_rate"],
                "steps": preset["num_inference_steps"],
                "guidance": preset["guidance_scale"],
                "seed": seed,
                "quality": request.quality,
            },
            image_bytes,
        )
        raw.write_bytes(data)
        if raw.stat().st_size < 1000:
            raise GenerationFailureError("Neural worker returned an empty video.")
