from __future__ import annotations

import json
import sys
import tempfile
import threading
import unittest
from http.client import HTTPConnection
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from pngutil import write_png  # noqa: E402

from video_agent.server import Handler, ThreadingHTTPServer  # noqa: E402


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.port = cls.httpd.server_address[1]
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def _conn(self) -> HTTPConnection:
        return HTTPConnection("127.0.0.1", self.port, timeout=60)

    def _get(self, path: str) -> tuple[int, dict | str]:
        conn = self._conn()
        conn.request("GET", path)
        res = conn.getresponse()
        raw = res.read()
        ctype = res.getheader("Content-Type") or ""
        if "json" in ctype:
            return res.status, json.loads(raw.decode())
        return res.status, raw.decode("utf-8", "replace")

    def test_health_and_ui(self) -> None:
        status, payload = self._get("/api/health")
        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        status, html = self._get("/")
        self.assertEqual(status, 200)
        self.assertIn("Video Agent", html)
        self.assertIn("Image to Video", html)
        self.assertIn("LOCAL AI", html)
        self.assertIn("FFMPEG MOTION", html)
        self.assertIn("AUTO", html)

    def test_hardware_and_maya(self) -> None:
        status, hw = self._get("/api/hardware")
        self.assertEqual(status, 200)
        self.assertIn("recommended_engine", hw)
        self.assertIn("execution", hw)
        self.assertIn("local_ai", hw)
        self.assertIn(hw["local_ai"]["label"], {"AVAILABLE", "NOT AVAILABLE"})
        status, maya = self._get("/api/maya")
        self.assertEqual(status, 200)
        self.assertTrue(maya["identity_lock"])
        status, engines = self._get("/api/engines")
        self.assertEqual(status, 200)
        self.assertTrue(engines["ffmpeg_motion"]["available"])
        self.assertIn(engines["auto_would_choose"], {"local_ai", "ffmpeg_motion"})

    def test_create_job_and_status(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            image = write_png(Path(tmp) / "ref.png", 720, 1280)
            boundary = "----VideoAgentTest"
            prompt = "keep the same person, slight camera drift"
            file_bytes = image.read_bytes()
            body = (
                (
                    f"--{boundary}\r\n"
                    'Content-Disposition: form-data; name="prompt"\r\n\r\n'
                    f"{prompt}\r\n"
                    f"--{boundary}\r\n"
                    'Content-Disposition: form-data; name="mode"\r\n\r\n'
                    "image_to_video\r\n"
                    f"--{boundary}\r\n"
                    'Content-Disposition: form-data; name="aspect_ratio"\r\n\r\n'
                    "9:16\r\n"
                    f"--{boundary}\r\n"
                    'Content-Disposition: form-data; name="duration"\r\n\r\n'
                    "6\r\n"
                    f"--{boundary}\r\n"
                    'Content-Disposition: form-data; name="quality"\r\n\r\n'
                    "720p\r\n"
                    f"--{boundary}\r\n"
                    'Content-Disposition: form-data; name="dry_run"\r\n\r\n'
                    "true\r\n"
                    f"--{boundary}\r\n"
                    'Content-Disposition: form-data; name="image"; filename="ref.png"\r\n'
                    "Content-Type: image/png\r\n\r\n"
                ).encode("utf-8")
                + file_bytes
                + f"\r\n--{boundary}--\r\n".encode("utf-8")
            )
            conn = self._conn()
            conn.request(
                "POST",
                "/api/jobs",
                body=body,
                headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
            )
            res = conn.getresponse()
            payload = json.loads(res.read().decode())
            self.assertEqual(res.status, 201, payload)
            job_id = payload["id"]
            for _ in range(80):
                st, job = self._get(f"/api/jobs/{job_id}")
                self.assertEqual(st, 200)
                if job["status"] in {"COMPLETED", "FAILED", "CANCELLED"}:
                    break
                import time

                time.sleep(0.25)
            self.assertEqual(job["status"], "COMPLETED", job)
            self.assertEqual(job["ui_status"], "completed")
            conn = self._conn()
            conn.request("GET", f"/api/jobs/{job_id}/video")
            video = conn.getresponse()
            data = video.read()
            self.assertEqual(video.status, 200)
            self.assertGreater(len(data), 1000)
            self.assertEqual(video.getheader("Content-Type"), "video/mp4")

    def test_image_to_video_missing_image_fails(self) -> None:
        body = json.dumps(
            {
                "prompt": "no image supplied",
                "mode": "image_to_video",
                "dry_run": True,
            }
        ).encode()
        conn = self._conn()
        conn.request("POST", "/api/jobs", body=body, headers={"Content-Type": "application/json"})
        res = conn.getresponse()
        payload = json.loads(res.read().decode())
        self.assertEqual(res.status, 201)
        import time

        job = payload
        for _ in range(40):
            _, job = self._get(f"/api/jobs/{payload['id']}")
            if job["status"] in {"COMPLETED", "FAILED", "CANCELLED"}:
                break
            time.sleep(0.1)
        self.assertEqual(job["status"], "FAILED")
        self.assertEqual(job["error_code"], "missing_image")


if __name__ == "__main__":
    unittest.main()
