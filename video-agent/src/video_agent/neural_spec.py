"""Single selected local neural model. Weights are never committed."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .paths import AGENT_ROOT

# 2B, not 13B/14B. Practical first model for Apple Silicon / a later NVIDIA box.
MODEL_ID = "Lightricks/LTX-Video"
MODEL_NAME = "LTX-Video 2B (local image-to-video)"
MODEL_KIND = "ltx_image_to_video"
DOWNLOAD_GB = 6.5
DISK_GB = 12.0
RAM_GB_RECOMMENDED = 16.0
RAM_GB_MINIMUM = 12.0

# LTX requires height/width divisible by 32 and num_frames = 8k+1.
LOW_MEMORY_PRESET = {
    "name": "low_memory_3s_vertical",
    "height": 512,
    "width": 288,
    "num_frames": 25,  # 8*3+1 ≈ 3.1s at 8 fps
    "frame_rate": 8,
    "num_inference_steps": 20,
    "guidance_scale": 3.0,
    "duration_seconds": 3.125,
}

MODELS_DIR = AGENT_ROOT / "models"
HF_HOME = MODELS_DIR / "huggingface"
VENV_DIR = AGENT_ROOT / ".venv-neural"
OUTPUT_DIR = AGENT_ROOT / "output"

MAYA_NEURAL_PROMPT = (
    "The same woman remains the exact same person. Natural breathing. "
    "One subtle blink. Tiny natural eye movement. Very slight head movement. "
    "Minimal realistic hair movement. Stable facial identity. "
    "Stable facial proportions. Stable body proportions. Realistic camera. No talking."
)

MAYA_NEURAL_NEGATIVE = (
    "face replacement, facial redesign, beautification, age change, identity drift, "
    "warped eyes, distorted mouth, extra limbs, body deformation, aggressive camera motion, "
    "scene replacement, different woman, beauty filter, talking, lip sync"
)


def model_dir() -> Path:
    return Path(__file__).resolve().parents[2] / "models"


def estimate_requirements() -> dict[str, Any]:
    return {
        "model_id": MODEL_ID,
        "model_name": MODEL_NAME,
        "paid": False,
        "download_gb": DOWNLOAD_GB,
        "disk_gb": DISK_GB,
        "ram_gb_recommended": RAM_GB_RECOMMENDED,
        "ram_gb_minimum": RAM_GB_MINIMUM,
        "low_memory_preset": LOW_MEMORY_PRESET,
        "notes": [
            "Local inference only. No LTX cloud API, Fal, Replicate, Runway, or Veo.",
            "Do not install Wan 14B / Hunyuan-sized models for this first pass.",
            "Weights stay in video-agent/models/ and are gitignored.",
        ],
    }
