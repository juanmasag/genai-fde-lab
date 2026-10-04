from PIL import Image
from pathlib import Path
import math
ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/'source/raster/components/head'
OUT=ROOT/'exports/webp/one-head-talk-v1.webp'
FPS=24; SECONDS=8; N=FPS*SECONDS; SIZE=320
names=['head-happy','head-wink','head-happy','head-surprised','head-happy','head-smile-closed','head-happy','head-wink','head-happy']
# expression changes are deliberately discrete/short, like facial poses in a 2D rig.
keys=[0,.75,1.35,2.15,2.65,3.45,3.62,4.7,5.2,6.15,6.35,7.15,8.0]
states=['head-happy','head-wink','head-happy','head-surprised','head-happy','head-smile-closed','head-happy','head-wink','head-happy','head-smile-closed','head-happy','head-wink','head-happy']
imgs={n:Image.open(SRC/f'{n}.png').convert('RGBA') for n in set(states)}
def eased(x): return .5-.5*math.cos(math.pi*max(0,min(1,x)))
def fit(im,scale=1.0,angle=0,y=0):
    base=Image.new('RGBA',(SIZE,SIZE),(0,0,0,0)); target=int(250*scale)
    q=im.copy(); q.thumbnail((target,target),Image.Resampling.LANCZOS); q=q.rotate(angle,resample=Image.Resampling.BICUBIC,expand=True)
    base.alpha_composite(q,((SIZE-q.width)//2,(SIZE-q.height)//2+int(y))); return base
frames=[]
for i in range(N):
    t=i/FPS
    j=max(k for k in range(len(keys)-1) if keys[k]<=t)
    span=max(.001,keys[j+1]-keys[j]); local=(t-keys[j])/span
    # Crossfade only near expression boundaries; hold poses long enough to read as acting.
    mix=eased(max(0,(local-.72)/.28))
    bob=2.8*math.sin(2*math.pi*t/2.2); nod=1.4*math.sin(2*math.pi*t/3.1)+.55*math.sin(2*math.pi*t/.9)
    pulse=1+.012*math.sin(2*math.pi*t/1.7)
    a=fit(imgs[states[j]],pulse,nod,bob); b=fit(imgs[states[j+1]],pulse,nod,bob)
    frames.append(Image.blend(a,b,mix))
OUT.parent.mkdir(parents=True,exist_ok=True)
frames[0].save(OUT,save_all=True,append_images=frames[1:],duration=round(1000/FPS),loop=0,lossless=True,method=6)
print(OUT, OUT.stat().st_size, 'frames',len(frames),'fps',FPS)
