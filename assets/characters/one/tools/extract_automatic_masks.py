from pathlib import Path
import json, numpy as np, torch
from PIL import Image
from mobile_sam import sam_model_registry, SamAutomaticMaskGenerator
ROOT=Path('assets/characters/one')
SRC=ROOT/'references/one-character-kit-approved.png'
OUT=ROOT/'work/auto-mask-v1'; PNG=OUT/'png'; PNG.mkdir(parents=True,exist_ok=True)
img=np.array(Image.open(SRC).convert('RGB'))
ck=Path.home()/'.local/share/one-creative/mobilesam/weights/mobile_sam.pt'
sam=sam_model_registry['vit_t'](checkpoint=str(ck)); sam.eval()
gen=SamAutomaticMaskGenerator(sam,points_per_side=32,points_per_batch=64,pred_iou_thresh=.88,stability_score_thresh=.95,box_nms_thresh=.7,crop_n_layers=1,crop_n_points_downscale_factor=2,min_mask_region_area=120)
masks=gen.generate(img)
# Keep useful-sized detections; automatic SAM may detect nested regions, so preserve metadata rather than pretending each mask is a semantic kit part.
valid=[]
for m in masks:
 x,y,w,h=[int(v) for v in m['bbox']]; area=int(m['area'])
 if area<300 or w<12 or h<12: continue
 seg=m['segmentation'].astype(bool); crop=img[y:y+h,x:x+w]; sm=seg[y:y+h,x:x+w]
 rgba=np.zeros((h,w,4),dtype=np.uint8); rgba[:,:,:3]=crop; rgba[:,:,3]=sm.astype(np.uint8)*255
 idx=len(valid)+1; fn=f'elemento_{idx:03d}.png'; Image.fromarray(rgba).save(PNG/fn)
 valid.append({'id':idx,'file':fn,'bbox':[x,y,w,h],'area':area,'predicted_iou':float(m['predicted_iou']),'stability_score':float(m['stability_score'])})
(OUT/'masks.json').write_text(json.dumps(valid,indent=2)+'\n')
print('raw_masks',len(masks),'valid_masks',len(valid))
print('manifest',OUT/'masks.json')
