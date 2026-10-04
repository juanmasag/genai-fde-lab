from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from PIL import Image
import json, urllib.parse, datetime, os, cgi, shutil
ROOT=Path(__file__).resolve().parents[1]
PORT=int(os.environ.get('PORT','4194'))
UPLOADS=ROOT/'references'/'new-source'
EXPORTS=ROOT/'exports'/'png'/'new-source'
NAMES=['front-head','front-tablet','quarter-tablet','side-tablet','back','gesture-tablet']

def strip_black(src,dst):
    im=Image.open(src).convert('RGBA'); px=im.load(); w,h=im.size
    from collections import deque
    seen=set(); q=deque()
    for x in range(w): q.extend(((x,0),(x,h-1)))
    for y in range(h): q.extend(((0,y),(w-1,y)))
    while q:
        x,y=q.popleft()
        if (x,y) in seen or x<0 or y<0 or x>=w or y>=h: continue
        seen.add((x,y)); r,g,b,a=px[x,y]
        if (r,g,b)!=(0,0,0): continue
        px[x,y]=(r,g,b,0)
        q.extend(((x-1,y),(x+1,y),(x,y-1),(x,y+1)))
    box=im.getbbox(); im=im.crop(box) if box else im
    dst.parent.mkdir(parents=True,exist_ok=True); im.save(dst,optimize=True)
    return {'width':im.width,'height':im.height}

class H(SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw): super().__init__(*a,directory=str(ROOT),**kw)
    def do_POST(self):
        if self.path=='/qa-viewer/api/upload-sources':
            form=cgi.FieldStorage(fp=self.rfile,headers=self.headers,environ={'REQUEST_METHOD':'POST','CONTENT_TYPE':self.headers.get('Content-Type','')})
            saved=[]; UPLOADS.mkdir(parents=True,exist_ok=True)
            for name in NAMES:
                item=form[name] if name in form else None
                if item is None or not getattr(item,'file',None): continue
                raw=UPLOADS/f'{name}.png'
                with raw.open('wb') as f: shutil.copyfileobj(item.file,f)
                try:
                    with Image.open(raw) as chk: chk.verify()
                    meta=strip_black(raw,EXPORTS/f'{name}.png'); saved.append({'name':name,**meta})
                except Exception:
                    raw.unlink(missing_ok=True); self.send_error(400,f'invalid image: {name}'); return
            body=json.dumps({'ok':True,'saved':saved}).encode(); self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body);return
        if self.path!='/qa-viewer/api/review': self.send_error(404); return
        n=int(self.headers.get('Content-Length','0')); data=json.loads(self.rfile.read(n) or b'{}')
        allowed={'pending','approved','rejected'}
        if data.get('status') not in allowed: self.send_error(400,'invalid status'); return
        record={'asset':str(data.get('asset','')),'status':data['status'],'note':str(data.get('note',''))[:500],'reviewed_at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
        p=ROOT/'qa-viewer'/'reviews.jsonl'; p.parent.mkdir(parents=True,exist_ok=True)
        with p.open('a',encoding='utf8') as f: f.write(json.dumps(record,ensure_ascii=False)+'\n')
        body=json.dumps({'ok':True,'record':record},ensure_ascii=False).encode(); self.send_response(200); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body)
ThreadingHTTPServer(('127.0.0.1',PORT),H).serve_forever()
