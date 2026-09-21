#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== Video Agent setup =="
if ! command -v python3 >/dev/null; then
  echo "Python 3 is required." >&2
  exit 1
fi
python3 - <<'PY'
import sys
if sys.version_info < (3, 10):
    raise SystemExit(f"Python 3.10+ required, found {sys.version}")
print(f"Python {sys.version.split()[0]}")
PY

if ! command -v ffmpeg >/dev/null; then
  echo "FFmpeg is required. On macOS: brew install ffmpeg. On Ubuntu: sudo apt-get install -y ffmpeg" >&2
  exit 1
fi
if ! command -v ffprobe >/dev/null; then
  echo "ffprobe is required (full FFmpeg package)." >&2
  exit 1
fi
ffmpeg -hide_banner -version | head -n 1

mkdir -p data/uploads data/outputs data/jobs data/tmp
if [[ ! -f .env && -f .env.example ]]; then
  cp .env.example .env
  echo "Wrote .env from .env.example (no secrets)."
fi

export PYTHONPATH="$ROOT/src"
python3 -m video_agent hardware
python3 "$ROOT/scripts/verify_deps.py"
echo
echo "Setup complete. Start with: $ROOT/scripts/run.sh"
echo "UI: http://127.0.0.1:7860"
