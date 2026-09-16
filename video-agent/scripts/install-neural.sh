#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
FORCE=0
DOWNLOAD=1
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    --no-download) DOWNLOAD=0 ;;
  esac
done

echo "================================================="
echo "Local neural backend (LTX-Video 2B)"
echo "================================================="
echo "Model: Lightricks/LTX-Video"
echo "Approximate download: 6.5 GB"
echo "Disk needed: ~12 GB"
echo "RAM recommended: 16 GB unified / GPU memory"
echo "First test preset: 3s, 288x512, 25 frames, 20 steps"
echo "Paid APIs: none"
echo

python3 - <<'PY'
import platform, shutil, os, sys
from pathlib import Path
root = Path(".").resolve()
sys.path.insert(0, str(root / "src"))
from video_agent.execution import classify_execution
from video_agent.hardware import detect_hardware
exe = classify_execution()
hw = detect_hardware(root)
print("Execution:", exe["kind"], "-", exe["summary"])
print("OS/arch:", hw["os"], hw["arch"])
print("CPU:", hw["cpu"])
print("RAM GB:", hw["ram_gb"])
print("Disk free GB:", hw["disk_free_gb"])
print("Apple Silicon:", hw["apple_silicon"])
print("NVIDIA:", hw["gpu"])
ok_hw = bool(hw["gpu"] or hw["apple_silicon"])
if hw["disk_free_gb"] < 12:
    print("NOT ENOUGH DISK for the model.", file=sys.stderr)
    sys.exit(3)
open("/tmp/video-agent-neural-hw", "w").write("1" if ok_hw else "0")
PY

HW_OK="$(cat /tmp/video-agent-neural-hw)"
if [[ "$HW_OK" != "1" && "$FORCE" != "1" ]]; then
  echo
  echo "REFUSING to download LTX-Video on this CPU-only environment."
  echo "On Deepak's MacBook Air (Apple Silicon), run this script locally:"
  echo "  cd video-agent && ./scripts/install-neural.sh"
  echo "  ./scripts/start-local-video-worker.sh"
  echo
  echo "Use --force only if you understand this will likely OOM on CPU."
  exit 2
fi

python3 -m venv .venv-neural
# shellcheck disable=SC1091
source .venv-neural/bin/activate
python -m pip install --upgrade pip
if [[ "$(uname -s)" == "Darwin" ]]; then
  python -m pip install torch torchvision
else
  python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
  echo "CPU torch installed. Neural I2V is still not recommended here."
fi
python -m pip install "diffusers>=0.32" transformers accelerate safetensors pillow imageio imageio-ffmpeg protobuf sentencepiece

mkdir -p models/huggingface output
export HF_HOME="$ROOT/models/huggingface"
export HF_HUB_DISABLE_TELEMETRY=1
export PYTORCH_ENABLE_MPS_FALLBACK=1

if [[ "$DOWNLOAD" == "1" ]]; then
  echo "Downloading Lightricks/LTX-Video into $HF_HOME ..."
  python - <<'PY'
from diffusers import LTXImageToVideoPipeline
import torch
LTXImageToVideoPipeline.from_pretrained("Lightricks/LTX-Video", torch_dtype=torch.float16)
print("Model download complete.")
PY
fi
echo "Neural backend install finished."
echo "Start worker: ./scripts/start-local-video-worker.sh"
