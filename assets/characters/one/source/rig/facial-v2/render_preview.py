#!/usr/bin/env python3
"""Render a short enthusiastic explaining preview from ONE facial rig v2."""
from __future__ import annotations

import argparse
import math
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

RIG_DIR = Path(__file__).resolve().parent


def shift_layer(im: Image.Image, dx=0, dy=0) -> Image.Image:
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.alpha_composite(im, (dx, dy))
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--generated", type=Path, default=RIG_DIR / "generated")
    ap.add_argument("--out", type=Path, default=RIG_DIR / "generated" / "one-head-explain-rig-v1.webp")
    ap.add_argument("--seconds", type=float, default=6.0)
    ap.add_argument("--fps", type=int, default=12)
    args = ap.parse_args()

    layers_dir = args.generated / "layers"
    names = [
        "00-base-clean", "eyes-open", "eyes-closed", "brow-left", "brow-right",
        "mouth-happy", "mouth-rest", "mouth-smile", "mouth-o-small", "mouth-o", "mouth-open",
    ]
    L = {n: Image.open(layers_dir / f"{n}.png").convert("RGBA") for n in names}
    size = L["00-base-clean"].size[0]
    blink_centers = (1.25, 3.55, 5.15)
    mouth_cycle = ("mouth-happy", "mouth-open", "mouth-o", "mouth-happy", "mouth-o-small", "mouth-rest")
    emphasis = (2.05, 4.25, 5.55)

    def frame(t: float) -> Image.Image:
        blink = any(abs(t - b) < 0.085 for b in blink_centers)
        mouth = mouth_cycle[int(t * 5.2) % len(mouth_cycle)]
        brow_raise = -7 if any(abs(t - e) < 0.28 for e in emphasis) else 0
        face = L["00-base-clean"].copy()
        face = Image.alpha_composite(face, L["eyes-closed" if blink else "eyes-open"])
        face = Image.alpha_composite(face, shift_layer(L["brow-left"], dy=brow_raise))
        face = Image.alpha_composite(face, shift_layer(L["brow-right"], dy=brow_raise))
        face = Image.alpha_composite(face, L[mouth])

        angle = 1.05 * math.sin(2 * math.pi * t / 2.4) + 0.35 * math.sin(2 * math.pi * t / 0.95)
        y = round(3.5 * math.sin(2 * math.pi * t / 1.25) + 1.5 * math.sin(2 * math.pi * t / 2.7))
        rotated = face.rotate(angle, resample=Image.Resampling.BICUBIC, expand=False)
        out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        out.alpha_composite(rotated, (0, y))
        return out

    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise SystemExit("ffmpeg is required to export animated WebP")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="one-rig-v2-") as tmp:
        td = Path(tmp)
        count = round(args.seconds * args.fps)
        for i in range(count):
            frame(i / args.fps).save(td / f"frame-{i:04d}.png")
        cmd = [
            ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
            "-framerate", str(args.fps), "-i", str(td / "frame-%04d.png"),
            "-loop", "0", "-c:v", "libwebp_anim", "-lossless", "0",
            "-q:v", "88", "-compression_level", "4", str(args.out),
        ]
        subprocess.run(cmd, check=True)
    print(args.out)


if __name__ == "__main__":
    main()
