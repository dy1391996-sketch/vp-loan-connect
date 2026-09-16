#!/usr/bin/env python3
"""LTX-Video 2B local image-to-video runner.

Runs inside .venv-neural only. The Video Agent process does not import torch.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path


def _device_and_dtype():
    import torch

    if torch.backends.mps.is_available():
        return torch.device("mps"), torch.float16, "mps"
    if torch.cuda.is_available():
        return torch.device("cuda"), torch.bfloat16, "cuda"
    raise SystemExit("No MPS or CUDA device. Refusing CPU neural I2V.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Local LTX-Video 2B I2V/T2V")
    parser.add_argument("--image")
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--negative", default="")
    parser.add_argument("--out", required=True)
    parser.add_argument("--mode", default="image_to_video")
    parser.add_argument("--width", type=int, default=288)
    parser.add_argument("--height", type=int, default=512)
    parser.add_argument("--num-frames", type=int, default=25)
    parser.add_argument("--frame-rate", type=int, default=8)
    parser.add_argument("--steps", type=int, default=20)
    parser.add_argument("--guidance", type=float, default=3.0)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--model-id", default=os.environ.get("VIDEO_AGENT_MODEL_ID", "Lightricks/LTX-Video"))
    args = parser.parse_args()

    os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
    os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")

    import torch
    from diffusers.utils import export_to_video, load_image

    device, dtype, device_name = _device_and_dtype()
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    generator = torch.Generator(device="cpu").manual_seed(args.seed)

    if args.mode == "image_to_video":
        if not args.image:
            print(json.dumps({"error": "image required"}), file=sys.stderr)
            return 2
        from diffusers import LTXImageToVideoPipeline

        pipe = LTXImageToVideoPipeline.from_pretrained(args.model_id, torch_dtype=dtype)
        if hasattr(pipe, "enable_attention_slicing"):
            pipe.enable_attention_slicing()
        if hasattr(pipe, "vae") and hasattr(pipe.vae, "enable_tiling"):
            pipe.vae.enable_tiling()
        # Sequential offload is CUDA-oriented; on MPS keep the pipe on MPS.
        if device_name == "cuda" and hasattr(pipe, "enable_model_cpu_offload"):
            pipe.enable_model_cpu_offload()
        else:
            pipe = pipe.to(device)
        image = load_image(args.image)
        result = pipe(
            image=image,
            prompt=args.prompt,
            negative_prompt=args.negative or None,
            width=args.width,
            height=args.height,
            num_frames=args.num_frames,
            frame_rate=args.frame_rate,
            num_inference_steps=args.steps,
            guidance_scale=args.guidance,
            generator=generator,
        )
        frames = result.frames[0]
    else:
        from diffusers import LTXPipeline

        pipe = LTXPipeline.from_pretrained(args.model_id, torch_dtype=dtype)
        if hasattr(pipe, "enable_attention_slicing"):
            pipe.enable_attention_slicing()
        if device_name == "cuda" and hasattr(pipe, "enable_model_cpu_offload"):
            pipe.enable_model_cpu_offload()
        else:
            pipe = pipe.to(device)
        result = pipe(
            prompt=args.prompt,
            negative_prompt=args.negative or None,
            width=args.width,
            height=args.height,
            num_frames=args.num_frames,
            frame_rate=args.frame_rate,
            num_inference_steps=args.steps,
            guidance_scale=args.guidance,
            generator=generator,
        )
        frames = result.frames[0]

    export_to_video(frames, str(out), fps=args.frame_rate)
    print(
        json.dumps(
            {
                "ok": True,
                "output": str(out),
                "device": device_name,
                "frames": len(frames),
                "width": args.width,
                "height": args.height,
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
