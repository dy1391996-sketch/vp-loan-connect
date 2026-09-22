#!/usr/bin/env bash
# Run three real photo tests + one accepted-photo→video test via maya-media-v1.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"
BRIDGE="${MAYA_MEDIA_LOCAL_URL:-http://127.0.0.1:8787}"
MASTER="config/maya/visual/MASTER_MAYA_REFERENCE.png"
OUT="work/maya-comfy/test-outputs"
mkdir -p "$OUT"

echo "=== capabilities ==="
curl -fsS "$BRIDGE/capabilities" | tee "$OUT/capabilities.json"
echo

photo() {
  local name="$1" scene="$2"
  echo "=== PHOTO: $name ==="
  python3 - <<PY
import json, urllib.request
from pathlib import Path
import mimetypes

bridge = "$BRIDGE"
master = Path("$MASTER").read_bytes()
req_json = json.dumps({
  "protocol": "maya-media-v1",
  "kind": "photo",
  "mode": "lifestyle",
  "scene": """$scene""",
  "outfit": "casual everyday clothing",
  "pose": "natural standing pose distinct from the master reference",
  "prompt": "1 IDENTITY: Use attached Master. Same adult fictional Maya.\\n3 SCENE: $scene\\n9 REALISM: natural skin, realistic hands.\\n11 PROVIDER: maya-media-v1",
}).encode()

boundary = "----mayaBoundary7MAYA"
body = b""
def add(name, value, filename=None, mime=None):
  global body
  body += f"--{boundary}\\r\\n".encode()
  if filename:
    body += f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\\r\\n'.encode()
    body += f"Content-Type: {mime}\\r\\n\\r\\n".encode()
    body += value + b"\\r\\n"
  else:
    body += f'Content-Disposition: form-data; name="{name}"\\r\\n\\r\\n'.encode()
    body += value + b"\\r\\n"

add("request", req_json)
add("master", master, "master.png", "image/png")
body += f"--{boundary}--\\r\\n".encode()

request = urllib.request.Request(
  bridge + "/generate",
  data=body,
  headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
  method="POST",
)
with urllib.request.urlopen(request, timeout=300) as resp:
  data = resp.read()
  ctype = resp.headers.get("content-type", "")
  out = Path("$OUT") / f"{name}.png"
  out.write_bytes(data)
  print(json.dumps({"name": "$name", "bytes": len(data), "content_type": ctype, "path": str(out)}))
PY
}

photo "photo1-balcony" "Maya standing on a quiet balcony at dusk, looking toward the street lights"
photo "photo2-cafe" "Maya sitting at a small cafe table by a window with soft daylight, holding a ceramic cup"
photo "photo3-park" "Maya walking through a leafy city park path in soft afternoon light, candid waist-up"

echo "=== PHOTO→VIDEO from photo1 ==="
python3 - <<'PY'
import json, urllib.request
from pathlib import Path

bridge = "http://127.0.0.1:8787"
out = Path("work/maya-comfy/test-outputs")
master = Path("config/maya/visual/MASTER_MAYA_REFERENCE.png").read_bytes()
source = (out / "photo1-balcony.png").read_bytes()
req_json = json.dumps({
  "protocol": "maya-media-v1",
  "kind": "video",
  "mode": "lifestyle",
  "scene": "Maya standing on a quiet balcony at dusk, looking toward the street lights",
  "motion": "Subtle breathing, blinking and natural hair movement. Static phone camera.",
  "prompt": "Exact approved source photo: preserve face, body, outfit, room, light and pose; add motion only.",
}).encode()
boundary = "----mayaBoundary7MAYA"
body = b""
def add(name, value, filename=None, mime=None):
  global body
  body += f"--{boundary}\r\n".encode()
  if filename:
    body += f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'.encode()
    body += f"Content-Type: {mime}\r\n\r\n".encode()
    body += value + b"\r\n"
  else:
    body += f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode()
    body += value + b"\r\n"
add("request", req_json)
add("master", master, "master.png", "image/png")
add("source", source, "approved-source.png", "image/png")
body += f"--{boundary}--\r\n".encode()
request = urllib.request.Request(
  bridge + "/generate",
  data=body,
  headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
  method="POST",
)
with urllib.request.urlopen(request, timeout=900) as resp:
  data = resp.read()
  path = out / "video1-from-photo1.mp4"
  path.write_bytes(data)
  print(json.dumps({"name": "video1", "bytes": len(data), "content_type": resp.headers.get("content-type"), "path": str(path)}))
PY

echo "ALL_DIRECT_TESTS_DONE"
ls -lh "$OUT"
