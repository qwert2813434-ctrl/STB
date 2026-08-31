# 配合 pptx-bake.html：收 base64 存成 .pptx（只在本機、跑完就關）
import base64, sys, os
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs
OUT = sys.argv[1] if len(sys.argv) > 1 else "dev-tests/shot/ar"
class H(BaseHTTPRequestHandler):
    def do_OPTIONS(self): self._ok(b"")
    def do_POST(self):
        q = parse_qs(urlparse(self.path).query)
        name = (q.get("name") or ["out"])[0]
        raw = self.rfile.read(int(self.headers["Content-Length"]))
        data = raw.split(b",", 1)[1] if raw[:5] == b"data:" else raw
        os.makedirs(OUT, exist_ok=True)
        p = os.path.join(OUT, name + ".pptx")
        open(p, "wb").write(base64.b64decode(data))
        print(f"寫入 {p}  {os.path.getsize(p)/1e6:.2f} MB", flush=True)
        self._ok(b"ok")
    def _ok(self, body):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers(); self.wfile.write(body)
    def log_message(self, *a): pass
HTTPServer(("127.0.0.1", 5198), H).serve_forever()
