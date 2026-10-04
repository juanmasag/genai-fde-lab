from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import json, urllib.parse, datetime, os
ROOT=Path(__file__).resolve().parents[1]
PORT=int(os.environ.get('PORT','4194'))
class H(SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw): super().__init__(*a,directory=str(ROOT),**kw)
    def do_POST(self):
        if self.path!='/qa-viewer/api/review': self.send_error(404); return
        n=int(self.headers.get('Content-Length','0')); data=json.loads(self.rfile.read(n) or b'{}')
        allowed={'pending','approved','rejected'}
        if data.get('status') not in allowed: self.send_error(400,'invalid status'); return
        record={'asset':str(data.get('asset','')),'status':data['status'],'note':str(data.get('note',''))[:500],'reviewed_at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
        p=ROOT/'qa-viewer'/'reviews.jsonl'; p.parent.mkdir(parents=True,exist_ok=True)
        with p.open('a',encoding='utf8') as f: f.write(json.dumps(record,ensure_ascii=False)+'\n')
        body=json.dumps({'ok':True,'record':record},ensure_ascii=False).encode(); self.send_response(200); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body)
ThreadingHTTPServer(('127.0.0.1',PORT),H).serve_forever()
