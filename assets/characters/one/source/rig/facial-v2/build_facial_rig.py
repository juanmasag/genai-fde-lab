#!/usr/bin/env python3
"""Build ONE facial rig v2 from versioned canonical sources.

No generative step is used here. Open eyes, brows and the happy mouth are
recovered from the exact full-head/clean-plate pair. Blink and alternate mouth
poses are copied from the canonical parts sheet and registered deterministically.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from collections import deque
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

RIG_DIR = Path(__file__).resolve().parent
ONE_ROOT = RIG_DIR.parents[2]


def max_channel(im: Image.Image) -> Image.Image:
    r, g, b = im.convert("RGB").split()
    return ImageChops.lighter(ImageChops.lighter(r, g), b)


def border_connected_alpha(rgb: Image.Image, threshold: int) -> Image.Image:
    """Make only border-connected near-black pixels transparent."""
    score = max_channel(rgb)
    w, h = score.size
    px = score.load()
    seen = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()

    def push(x: int, y: int) -> None:
        i = y * w + x
        if not seen[i] and px[x, y] <= threshold:
            seen[i] = 1
            q.append((x, y))

    for x in range(w):
        push(x, 0); push(x, h - 1)
    for y in range(h):
        push(0, y); push(w - 1, y)
    while q:
        x, y = q.popleft()
        if x: push(x - 1, y)
        if x + 1 < w: push(x + 1, y)
        if y: push(x, y - 1)
        if y + 1 < h: push(x, y + 1)

    alpha = Image.new("L", (w, h), 255)
    ap = alpha.load()
    for y in range(h):
        off = y * w
        for x in range(w):
            if seen[off + x]:
                ap[x, y] = 0
    return alpha


def largest_component(mask: Image.Image) -> Image.Image:
    """Keep largest 8-connected white component of a binary L mask."""
    m = mask.point(lambda p: 255 if p else 0)
    w, h = m.size
    p = m.load()
    seen = bytearray(w * h)
    best: list[tuple[int, int]] = []
    for y in range(h):
        for x in range(w):
            idx = y * w + x
            if seen[idx] or not p[x, y]:
                continue
            seen[idx] = 1
            q = [(x, y)]
            comp: list[tuple[int, int]] = []
            while q:
                cx, cy = q.pop()
                comp.append((cx, cy))
                for ny in range(max(0, cy - 1), min(h, cy + 2)):
                    for nx in range(max(0, cx - 1), min(w, cx + 2)):
                        ni = ny * w + nx
                        if not seen[ni] and p[nx, ny]:
                            seen[ni] = 1
                            q.append((nx, ny))
            if len(comp) > len(best):
                best = comp
    out = Image.new("L", (w, h), 0)
    op = out.load()
    for x, y in best:
        op[x, y] = 255
    return out


def extract_changed_feature(front: Image.Image, clean: Image.Image, box, threshold: int) -> Image.Image:
    a = front.crop(tuple(box)).convert("RGBA")
    b = clean.crop(tuple(box)).convert("RGBA")
    diff = ImageChops.difference(a.convert("RGB"), b.convert("RGB"))
    d = max_channel(diff).point(lambda p: 255 if p >= threshold else 0)
    d = largest_component(d).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1.1))
    a.putalpha(d)
    return a


def paste_crop_on_canvas(sheet: Image.Image, box, canvas_size, center, target_width: int) -> Image.Image:
    crop = sheet.crop(tuple(box)).convert("RGBA")
    alpha_box = crop.getchannel("A").getbbox()
    if alpha_box:
        crop = crop.crop(alpha_box)
    scale = target_width / max(1, crop.width)
    crop = crop.resize((round(crop.width * scale), round(crop.height * scale)), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    x = round(center[0] - crop.width / 2)
    y = round(center[1] - crop.height / 2)
    out.alpha_composite(crop, (x, y))
    return out


def normalize_same_transform(im: Image.Image, source_bbox, canvas: int, target_width: int) -> Image.Image:
    x0, y0, x1, y1 = source_bbox
    scale = target_width / (x1 - x0)
    crop = im.crop(source_bbox)
    new_size = (round(crop.width * scale), round(crop.height * scale))
    crop = crop.resize(new_size, Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.alpha_composite(crop, ((canvas - new_size[0]) // 2, (canvas - new_size[1]) // 2))
    return out


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--one-root", type=Path, default=ONE_ROOT)
    ap.add_argument("--out", type=Path, default=RIG_DIR / "generated")
    args = ap.parse_args()

    cfg = json.loads((RIG_DIR / "rig-config.json").read_text())
    src = cfg["sources"]
    paths = {k: args.one_root / v for k, v in src.items()}
    front = Image.open(paths["front_head"]).convert("RGBA")
    clean = Image.open(paths["clean_plate"]).convert("RGBA")
    parts = Image.open(paths["parts_sheet"]).convert("RGBA")

    expected = cfg["expected_source_sizes"]
    for key, im in (("front_head", front), ("clean_plate", clean), ("parts_sheet", parts)):
        if list(im.size) != expected[key]:
            raise SystemExit(f"{key}: expected {expected[key]}, got {list(im.size)}")

    base = clean.copy()
    base.putalpha(border_connected_alpha(clean, cfg["background_threshold"]))
    bbox = base.getchannel("A").getbbox()
    if not bbox:
        raise SystemExit("clean plate alpha is empty")

    source_layers: dict[str, Image.Image] = {"00-base-clean": base}
    for name in ("brow_left", "brow_right", "eye_left", "eye_right", "mouth_happy"):
        feature = extract_changed_feature(front, clean, cfg["feature_regions"][name], cfg["feature_diff_threshold"])
        full = Image.new("RGBA", front.size, (0, 0, 0, 0))
        x0, y0, _, _ = cfg["feature_regions"][name]
        full.alpha_composite(feature, (x0, y0))
        source_layers[name.replace("_", "-")] = full

    eyes_open = Image.alpha_composite(source_layers.pop("eye-left"), source_layers.pop("eye-right"))
    source_layers["eyes-open"] = eyes_open

    p = cfg["parts"]
    c = cfg["source_space_centers"]
    tw = cfg["target_widths"]
    left_closed = paste_crop_on_canvas(parts, p["eye_closed_left"], front.size, c["eye_left"], tw["eye_closed"])
    right_closed = paste_crop_on_canvas(parts, p["eye_closed_right"], front.size, c["eye_right"], tw["eye_closed"])
    source_layers["eyes-closed"] = Image.alpha_composite(left_closed, right_closed)
    for name in ("mouth_rest", "mouth_smile", "mouth_o_small", "mouth_o", "mouth_open"):
        source_layers[name.replace("_", "-")] = paste_crop_on_canvas(
            parts, p[name], front.size, c["mouth"], tw[name]
        )

    out_layers = args.out / "layers"
    out_qa = args.out / "qa"
    out_layers.mkdir(parents=True, exist_ok=True)
    out_qa.mkdir(parents=True, exist_ok=True)
    canvas = cfg["canvas"]
    target = cfg["normalization"]["target_head_width"]
    normalized = {name: normalize_same_transform(im, bbox, canvas, target) for name, im in source_layers.items()}
    for name, im in normalized.items():
        im.save(out_layers / f"{name}.png", optimize=True)

    def face(eyes="eyes-open", mouth="mouth-happy"):
        im = normalized["00-base-clean"].copy()
        for k in (eyes, "brow-left", "brow-right", mouth):
            im = Image.alpha_composite(im, normalized[k])
        return im

    states = [
        ("open", face()),
        ("blink", face("eyes-closed")),
        ("rest", face(mouth="mouth-rest")),
        ("O", face(mouth="mouth-o")),
        ("small-O", face(mouth="mouth-o-small")),
    ]
    sheet = Image.new("RGBA", (canvas * len(states), canvas), (255, 255, 255, 255))
    for i, (_, im) in enumerate(states):
        sheet.alpha_composite(im, (i * canvas, 0))
    sheet.save(out_qa / "facial-states-v1.png", optimize=True)

    manifest = {
        "version": cfg["version"],
        "status": "candidate-awaiting-user-visual-approval",
        "source_bbox": list(bbox),
        "layers": {p.name: sha256(p) for p in sorted(out_layers.glob("*.png"))},
        "qa": {"facial-states-v1.png": sha256(out_qa / "facial-states-v1.png")},
    }
    (args.out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
