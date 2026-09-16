"""CLI: hardware, dry-run, generate, Maya Video #1 local run."""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from .hardware import detect_hardware
from .jobs import load_job, new_job
from .maya import maya_status
from .pipeline import dry_run_report, run_job


def _print(payload: object) -> None:
    print(json.dumps(payload, indent=2))


def cmd_hardware(_: argparse.Namespace) -> int:
    _print(detect_hardware())
    return 0


def cmd_maya(_: argparse.Namespace) -> int:
    _print(maya_status())
    return 0


def cmd_dry_run(_: argparse.Namespace) -> int:
    report = dry_run_report()
    _print(report)
    print("DRY RUN COMPLETE. PAID GENERATIONS MADE: 0", file=sys.stderr)
    return 0 if report.get("ok") else 1


def cmd_generate(args: argparse.Namespace) -> int:
    image = Path(args.image).resolve() if args.image else None
    job = new_job(
        {
            "prompt": args.prompt,
            "negative_prompt": args.negative or "",
            "mode": args.mode,
            "aspect_ratio": "9:16",
            "duration": args.duration,
            "quality": args.quality,
            "dry_run": bool(args.dry_run),
            "maya": bool(args.maya),
            "image_path": str(image) if image else None,
            "provider_id": "local_ffmpeg",
        }
    )
    if args.maya and not args.prompt:
        job["prompt"] = maya_status()["prompt"]
        from .jobs import save_job

        save_job(job)
    result = run_job(job["id"])
    _print(result)
    return 0 if result.get("status") == "COMPLETED" else 1


def cmd_serve(args: argparse.Namespace) -> int:
    from .server import serve

    serve(host=args.host, port=args.port)
    return 0


def cmd_wait(args: argparse.Namespace) -> int:
    deadline = time.time() + args.timeout
    while time.time() < deadline:
        job = load_job(args.job_id)
        if job["status"] in {"COMPLETED", "FAILED", "CANCELLED"}:
            _print(job)
            return 0 if job["status"] == "COMPLETED" else 1
        time.sleep(0.4)
    print("Timed out waiting for job.", file=sys.stderr)
    return 2


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Personal Video Agent (local/free first)")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("hardware", help="Detect this machine and recommended engine")
    p.set_defaults(func=cmd_hardware)

    p = sub.add_parser("maya", help="Show Maya Video #1 lock status")
    p.set_defaults(func=cmd_maya)

    p = sub.add_parser("dry-run", help="Validate pipeline without paid or heavy generation")
    p.set_defaults(func=cmd_dry_run)

    p = sub.add_parser("generate", help="Create a local job and run it")
    p.add_argument("--prompt", default="")
    p.add_argument("--image")
    p.add_argument("--negative", default="")
    p.add_argument("--mode", choices=["text_to_video", "image_to_video"], default="image_to_video")
    p.add_argument("--duration", type=float, default=6)
    p.add_argument("--quality", choices=["480p", "720p", "1080p"], default="720p")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--maya", action="store_true", help="Use the approved Maya Video #1 start frame")
    p.set_defaults(func=cmd_generate)

    p = sub.add_parser("serve", help="Open the local UI")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=7860)
    p.set_defaults(func=cmd_serve)

    p = sub.add_parser("wait", help="Wait for a job id")
    p.add_argument("job_id")
    p.add_argument("--timeout", type=float, default=120)
    p.set_defaults(func=cmd_wait)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
