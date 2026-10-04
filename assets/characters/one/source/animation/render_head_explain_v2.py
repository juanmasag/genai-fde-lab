from PIL import Image
from pathlib import Path
import math
ROOT=Path(__file__).resolve().parents[2]; SRC=ROOT/'source/raster/components/head'; OUT=ROOT/'exports/webp/one-head-explain-v2.webp'
FPS=24; N=FPS*6; SIZE=360
imgs={n:Image.open(SRC/f'{n}.png').convert('RGBA') for n in ['head-happy','head-neutral','head-surprised','head-wink']}
# Explanation performance: eyes open almost always. Wink is a 3-frame blink; surprised is a short spoken emphasis.
def state(t):
    f=round(t*FPS)
    if any(abs(f-x)<=1 for x in [45,112]): return 'head-wink'
    if 72<=f<=78: return 'head-surprised'
    # speech cadence alternates mouth-open happy and mouth-closed neutral in short syllabic bursts
    phase=f%18
    return 'head-neutral' if phase in (0,1,2,8,9,15) else 'head-happy'
def place(im,t):
    canvas=Image.new('RGBA',(SIZE,SIZE),(0,0,0,0)); q=im.copy(); q.thumbnail((270,270),Image.Resampling.LANCZOS)
    # overlapping motions: speech bob + slower conversational nod, never touching canvas edges
    y=3*math.sin(2*math.pi*t/1.05)+2*math.sin(2*math.pi*t/2.7); ang=.7*math.sin(2*math.pi*t/1.8)+.35*math.sin(2*math.pi*t/.72)
    q=q.rotate(ang,resample=Image.Resampling.BICUBIC,expand=True); canvas.alpha_composite(q,((SIZE-q.width)//2,(SIZE-q.height)//2+int(y))); return canvas
frames=[place(imgs[state(i/FPS)],i/FPS) for i in range(N)]
OUT.parent.mkdir(parents=True,exist_ok=True); frames[0].save(OUT,save_all=True,append_images=frames[1:],duration=42,loop=0,lossless=True,method=5)
print(OUT,OUT.stat().st_size,'frames',len(frames))
