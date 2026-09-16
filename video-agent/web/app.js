const form = document.getElementById("gen-form");
const statusLabel = document.getElementById("status-label");
const statusMsg = document.getElementById("status-msg");
const bar = document.getElementById("bar");
const jobJson = document.getElementById("job-json");
const preview = document.getElementById("preview");
const fileLoc = document.getElementById("file-loc");
const download = document.getElementById("download");
const generateBtn = document.getElementById("generate");
const cancelBtn = document.getElementById("cancel");
const mayaBox = document.getElementById("maya");
const promptEl = document.getElementById("prompt");

let currentJob = null;
let timer = null;

async function getJson(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || res.statusText);
  return data;
}

function setStatus(ui, pct, message, ok) {
  statusLabel.textContent = ui || "idle";
  statusLabel.className = "status " + (ok === false ? "bad" : ok ? "ok" : "");
  statusMsg.textContent = message || "";
  bar.style.width = Math.max(0, Math.min(100, pct || 0)) + "%";
}

async function loadMeta() {
  const [hw, maya] = await Promise.all([
    getJson("/api/hardware"),
    getJson("/api/maya"),
  ]);
  document.getElementById("hardware").textContent = [
    `${hw.os} ${hw.arch} · ${hw.cpu}`,
    `CPU ${hw.cpu_count} · RAM ${hw.ram_gb} GB · disk ${hw.disk_free_gb} GB free`,
    `GPU: ${hw.gpu ? hw.gpu.name : "none"} · Apple Silicon / Metal: ${hw.apple_silicon}`,
    `Python ${hw.python} · Node ${hw.node}`,
    hw.ffmpeg.version,
    `H.264: ${hw.ffmpeg.h264}`,
    `Engine: ${hw.recommended_engine}`,
    hw.reason,
  ].join("\n");
  document.getElementById("maya-status").textContent = [
    `Clip: ${maya.clip}`,
    `Source: ${maya.source}`,
    `Present: ${maya.source_present}`,
    `Identity lock: ${maya.identity_lock}`,
    `SHA256: ${maya.source_sha256}`,
    `Prompt ready: ${maya.prompt_ready}`,
    `Paid CLI (optional, not used by this UI): ${maya.paid_cli}`,
  ].join("\n");
  mayaBox.addEventListener("change", () => {
    if (mayaBox.checked && !promptEl.value.trim()) {
      promptEl.value = maya.prompt;
    }
  });
}

function showOutput(job) {
  if (job.status === "COMPLETED" && job.output_path) {
    const url = `/api/jobs/${job.id}/video?t=${Date.now()}`;
    preview.src = url;
    fileLoc.textContent = job.output_path;
    download.href = `/api/jobs/${job.id}/video?download=1`;
    download.classList.remove("hidden");
  } else {
    preview.removeAttribute("src");
    fileLoc.textContent = job.error ? job.error : "No file yet.";
    download.classList.add("hidden");
  }
}

async function poll() {
  if (!currentJob) return;
  const job = await getJson(`/api/jobs/${currentJob}`);
  jobJson.textContent = JSON.stringify(
    {
      id: job.id,
      status: job.status,
      ui_status: job.ui_status,
      progress: job.progress,
      provider: job.provider,
      dry_run: job.dry_run,
      error: job.error,
      output_path: job.output_path,
    },
    null,
    2
  );
  const failed = job.status === "FAILED" || job.status === "CANCELLED";
  setStatus(job.ui_status, job.progress, job.message, job.status === "COMPLETED" ? true : failed ? false : null);
  if (["COMPLETED", "FAILED", "CANCELLED"].includes(job.status)) {
    showOutput(job);
    generateBtn.disabled = false;
    cancelBtn.disabled = true;
    clearInterval(timer);
    timer = null;
    return;
  }
  cancelBtn.disabled = false;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  generateBtn.disabled = true;
  cancelBtn.disabled = false;
  preview.removeAttribute("src");
  download.classList.add("hidden");
  setStatus("preparing", 5, "Creating job…");
  const data = new FormData(form);
  if (!mayaBox.checked) data.delete("maya");
  else data.set("maya", "true");
  if (!document.getElementById("dry_run").checked) data.delete("dry_run");
  else data.set("dry_run", "true");
  try {
    const res = await fetch("/api/jobs", { method: "POST", body: data });
    const job = await res.json();
    if (!res.ok) throw new Error(job.message || job.error);
    currentJob = job.id;
    jobJson.textContent = JSON.stringify(job, null, 2);
    if (timer) clearInterval(timer);
    timer = setInterval(poll, 800);
    await poll();
  } catch (err) {
    setStatus("failed", 0, err.message, false);
    generateBtn.disabled = false;
    cancelBtn.disabled = true;
  }
});

cancelBtn.addEventListener("click", async () => {
  if (!currentJob) return;
  await fetch(`/api/jobs/${currentJob}/cancel`, { method: "POST" });
});

loadMeta().catch((err) => {
  document.getElementById("hardware").textContent = err.message;
});
