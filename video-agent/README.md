# Personal Video Agent

Isolated local video-generation agent. It is **not** part of the VP Loan Connect
product and is not deployed with that site.

This continues the Maya Video #1 work in `maya-video-pipeline/`:
the approved start frame, SHA256 lock, prompts, dry-run generator, and accept
script are preserved and are not replaced.

## What it does

```
prompt / reference image
        ↓
parse + validate
        ↓
reference identity lock (when an image is supplied)
        ↓
VideoProvider (local FFmpeg by default)
        ↓
job: QUEUED → PREPARING → VALIDATING → LOADING_MODEL → RUNNING → POST_PROCESSING
        ↓
9:16 H.264 MP4 + QC frames
        ↓
preview / download
```

Modes:

- **Image to Video** — required path. Uses the uploaded still (or the Maya Video #1 approved frame).
- **Text to Video** — local motion graphic from the prompt when no neural model is available.

## Free-first engines

| Provider | Paid | When it runs |
|---|---|---|
| `local_ffmpeg` | No | FFmpeg motion fallback. Not labeled as AI-generated. |
| `local_neural` | No | LTX-Video 2B local inference (Apple Silicon MPS or NVIDIA). |
| `local_diffusion` | No | Legacy alias; still refuses unless hardware can run neural weights. |
| `optional_cloud` | Yes | **Never** selected by the UI. |

Engine selector in the UI: **AUTO** / **LOCAL AI** / **FFMPEG MOTION**.
AUTO uses Local AI when the neural venv+weights or a localhost worker is ready.

## Local AI on a Mac (not this Cloud VM)

Cursor Cloud is a Linux container. Neural I2V runs on the physical Mac:

```bash
cd video-agent
./scripts/install-neural.sh          # ~6.5 GB LTX-Video 2B, Apple Silicon / NVIDIA only
./scripts/start-local-video-worker.sh  # http://127.0.0.1:7861
./scripts/run.sh                     # UI at http://127.0.0.1:7860
PYTHONPATH=src python3 scripts/maya_neural_i2v_test.py
```

This Cloud/CI Linux host has no NVIDIA GPU and is not Apple Silicon.
Neural image-to-video is **not** realistic here. The agent does not pretend otherwise.

Local FFmpeg motion keeps the source pixels (no face redesign / beautify).
It cannot invent new expressions or poses; that needs a neural model plus a GPU.

## Install → run

Requirements: Python 3.10+, FFmpeg (with libx264 and ffprobe). No pip packages.

```bash
cd video-agent
./scripts/setup.sh
./scripts/run.sh
```

Open [http://127.0.0.1:7860](http://127.0.0.1:7860)

Useful commands:

```bash
./scripts/verify.sh          # deps, FFmpeg, Maya lock, dry-run
./scripts/dry_run.py         # pipeline dry-run only
PYTHONPATH=src python3 -m video_agent hardware
PYTHONPATH=src python3 -m video_agent generate --maya --dry-run
PYTHONPATH=src python3 -m video_agent generate --maya
PYTHONPATH=src python3 -m unittest discover -s tests
```

## Maya Video #1

The registered source is `maya-video-pipeline/sources/video01-approved-start.png`
(SHA256 `a357abc29cfbed4de941eef2053d7d69c98ce5fc444f6f69534d1ef5ec862aeb`).
Pixels are not rewritten. In the UI, check **Use Maya Video #1 approved start frame**.

Intended later sequence remains short 9:16 clips joined toward ~25–30s.
Clip joining is implemented (`concat_clips`); only Video #1 currently has an
accepted source.

## Job statuses

`QUEUED` `PREPARING` `VALIDATING` `LOADING_MODEL` `RUNNING` `POST_PROCESSING` `COMPLETED` `FAILED` `CANCELLED`

UI labels: preparing, validating, loading model, generating, processing, completed, failed.

## Errors

Failures return a specific code and message, including unsupported/missing/corrupt
image, wrong aspect ratio, model unavailable, FFmpeg missing, OOM, disk full,
invalid output, interrupted/cancelled generation.

## Isolation

Do not mount this UI on the public loan site. Bind defaults to `127.0.0.1:7860`.
No API keys are required. Do not commit `.env`.
