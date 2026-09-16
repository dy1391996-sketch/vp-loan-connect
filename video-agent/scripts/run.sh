#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p data/uploads data/outputs data/jobs data/tmp
export PYTHONPATH="$ROOT/src"
HOST="${VIDEO_AGENT_HOST:-127.0.0.1}"
PORT="${VIDEO_AGENT_PORT:-7860}"
echo "Starting Video Agent at http://${HOST}:${PORT}"
exec python3 -m video_agent serve --host "$HOST" --port "$PORT"
