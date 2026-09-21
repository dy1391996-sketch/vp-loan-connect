#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PYTHONPATH="$ROOT/src"
echo "== dependency verification =="
python3 "$ROOT/scripts/verify_deps.py"
echo "== model / engine verification =="
python3 -m video_agent hardware
echo "== FFmpeg verification =="
python3 "$ROOT/scripts/verify_ffmpeg.py"
echo "== Maya lock =="
python3 -m video_agent maya
echo "== pipeline dry-run =="
python3 -m video_agent dry-run
echo "ALL CHECKS PASSED"
