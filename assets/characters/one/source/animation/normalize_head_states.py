from PIL import Image,ImageSequence
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'exports/png/normalized'; OUT.mkdir(parents=True,exist_ok=True)
CANVAS=420; TARGET=250
sources={'idle':ROOT/'exports/png/new-source/front-head.png','happy':ROOT/'source/raster/components/head/head-happy.png','neutral':ROOT/'source/raster/components/head/head-neutral.png','wink':ROOT/'source/raster/components/head/head-wink.png','smile':ROOT/'source/raster/components/head/head-smile-closed.png','surprised':ROOT/'source/raster/components/head/head-surprised.png'}
def norm(im):
 im=im.convert('RGBA'); a=im.getchannel('A'); box=a.getbbox(); crop=im.crop(box); scale=min(TARGET/crop.width,TARGET/crop.height); crop=crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.LANCZOS); out=Image.new('RGBA',(CANVAS,CANVAS)); out.alpha_composite(crop,((CANVAS-crop.width)//2,(CANVAS-crop.height)//2)); return out
for name,p in sources.items(): norm(Image.open(p)).save(OUT/f'{name}.png')
print('normalized',len(sources),'canvas',CANVAS,'target',TARGET)
