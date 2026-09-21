#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export VIDEO_AGENT_IS_WORKER=1
export VIDEO_AGENT_WORKER_HOST="${VIDEO_AGENT_WORKER_HOST:-127.0.0.1}"
export VIDEO_AGENT_WORKER_PORT="${VIDEO_AGENT_WORKER_PORT:-7861}"
export HF_HOME="${HF_HOME:-$ROOT/models/huggingface}"
export PYTORCH_ENABLE_MPS_FALLBACK=1
export PYTHONPATH="$ROOT/src"
if [[ "$VIDEO_AGENT_WORKER_HOST" != "127.0.0.1" && "$VIDEO_AGENT_WORKER_HOST" != "localhost" ]]; then
  echo "Refusing to bind the video worker off localhost." >&2
  exit 2
fi
echo "Starting localhost neural worker at http://${VIDEO_AGENT_WORKER_HOST}:${VIDEO_AGENT_WORKER_PORT}/health"
exec python3 -m video_agent worker --host "$VIDEO_AGENT_WORKER_HOST" --port "$VIDEO_AGENT_WORKER_PORT"
