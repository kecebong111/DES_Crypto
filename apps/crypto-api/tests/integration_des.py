"""Live Python + production Next integration; standard library, no database.

Run after npm --prefix apps/web run build, from apps/crypto-api:
.venv/bin/python tests/integration_des.py
"""
import copy
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[3]
MODE = None


def request(url, body=None, raw=None, content_type="application/json"):
    data = raw if raw is not None else json.dumps(body).encode() if body is not None else None
    try:
        response = urlopen(Request(url, data=data, headers={"Content-Type": content_type}), timeout=15)
    except HTTPError as exc:
        response = exc
    with response:
        return response.status, dict(response.headers), json.loads(response.read())


class Upstream(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        self.do_POST()

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        if MODE is None:
            status, _, payload = request("http://127.0.0.1:18000" + self.path, raw=body or None)
            output = json.dumps(payload).encode()
        else:
            status, payload, delay = MODE
            time.sleep(delay)
            output = payload if isinstance(payload, bytes) else json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        try:
            self.wfile.write(output)
        except BrokenPipeError:
            pass


def main():
    global MODE
    processes = []
    server = ThreadingHTTPServer(("127.0.0.1", 18001), Upstream)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    with tempfile.TemporaryFile() as log:
        try:
            processes.append(subprocess.Popen([str(ROOT / "apps/crypto-api/.venv/bin/python"), "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "18000", "--no-access-log"], cwd=ROOT / "apps/crypto-api", stdout=log, stderr=log))
            env = dict(os.environ, CRYPTO_API_URL="http://127.0.0.1:18001", CRYPTO_API_TIMEOUT_MS="1000")
            processes.append(subprocess.Popen(["npm", "run", "start", "--", "--hostname", "127.0.0.1", "--port", "13000"], cwd=ROOT / "apps/web", env=env, stdout=log, stderr=log, start_new_session=True))
            for origin, path in [("http://127.0.0.1:18000", "/health"), ("http://127.0.0.1:13000", "/api/health")]:
                for _ in range(100):
                    try:
                        if request(origin + path)[0] == 200:
                            break
                    except OSError:
                        pass
                    time.sleep(.1)
                else:
                    raise AssertionError("Server did not become healthy")
            web = "http://127.0.0.1:13000/api"
            key = {"format": "hex", "value": "133457799BBCDFF1"}
            inputs = {
                "encrypt": {"plaintext": {"format": "hex", "value": "0123456789ABCDEF"}, "key": key},
                "decrypt": {"ciphertextHex": "85E813540F0AB405", "key": key},
                "key-schedule": {"key": key},
            }
            good = {}
            for operation, body in inputs.items():
                status, headers, payload = request(web + "/des/" + operation, body)
                assert status == 200 and headers.get("cache-control") == "no-store", (status, headers, payload)
                good[operation] = payload
            assert good["encrypt"]["ciphertextHex"] == "85E813540F0AB405"
            assert good["decrypt"]["plaintextHex"] == "0123456789ABCDEF" and good["decrypt"]["plaintextText"] is None
            assert good["key-schedule"]["rounds"][0]["subkeyHex"] == "1B02EFFC7072"
            assert good["key-schedule"]["rounds"][15]["subkeyHex"] == "CB3D8B0E17F5"
            print("PASS: Python health; Next health; all three live DES operations; no-store")
            for raw, media, expected in [(b"{", "application/json", 400), (b"{}", "text/plain", 415), (b"{}", "application/json", 422)]:
                assert request(web + "/des/encrypt", raw=raw, content_type=media)[0] == expected
            print("PASS: malformed JSON 400, media type 415, validation 422")
            cases = []
            for operation in inputs:
                for field, replacement in [("algorithm", "AES"), ("operation", "wrong")]:
                    payload = copy.deepcopy(good[operation]); payload[field] = replacement
                    cases.append((operation, payload))
            for field, replacement in [("ciphertextHex", "0"), ("plaintextHex", "0123456789abcdef")]:
                payload = copy.deepcopy(good["encrypt"]); payload[field] = replacement
                cases.append(("encrypt", payload))
            payload = copy.deepcopy(good["decrypt"]); del payload["plaintextText"]
            cases.append(("decrypt", payload))
            for field, replacement in [("rounds", []), ("pc1Table", [1] * 56), ("shiftSchedule", [2] * 16), ("inputKeyBinary", "0" * 63)]:
                payload = copy.deepcopy(good["key-schedule"]); payload[field] = replacement
                cases.append(("key-schedule", payload))
            for index in range(16):
                for field, replacement in [("round", 0), ("shift", 3), ("c", "0"), ("d", "2" * 28), ("subkeyBinary", "0" * 47), ("subkeyHex", "F" * 11)]:
                    payload = copy.deepcopy(good["key-schedule"]); payload["rounds"][index][field] = replacement
                    cases.append(("key-schedule", payload))
            for operation, payload in cases:
                MODE = (200, payload, 0)
                status, headers, result = request(web + "/des/" + operation, inputs[operation])
                assert status == 502 and result["error"]["code"] == "BACKEND_BAD_RESPONSE" and headers.get("cache-control") == "no-store"
            print(f"PASS: {len(cases)} malformed upstream successes rejected through Next")
            for mode, expected in [((200, b"{", 0), 502), ((302, {}, 0), 502), ((500, {}, 0), 502), ((422, {"error": {"code": "VALIDATION_ERROR", "message": "bad", "details": [None]}}, 0), 502), ((200, {}, 1.5), 504)]:
                MODE = mode
                assert request(web + "/des/encrypt", inputs["encrypt"])[0] == expected
            server.shutdown(); server.server_close()
            assert request(web + "/des/encrypt", inputs["encrypt"])[0] == 503
            print("PASS: bad JSON, redirect, unexpected status/envelope 502; timeout 504; offline 503")
        finally:
            import signal
            for p in reversed(processes):
                if p is processes[-1] and len(processes) == 2:
                    os.killpg(p.pid, signal.SIGTERM)
                else:
                    p.terminate()
                p.wait(timeout=10)
            server.shutdown(); server.server_close()


if __name__ == "__main__":
    main()
