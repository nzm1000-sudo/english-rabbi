"""Gives every sticker a clean, even white die-cut border.

Background removal eats into the white sticker border that the image
generator drew, leaving it uneven. This rebuilds it: the cut-out subject
(with whatever is left of the old border) is placed on a new white outline
of constant thickness, with rounded corners and a soft shadow.

Usage: python3 tools/pics/sticker_border.py <raw dir> <out dir>
Processes s-*.png only. Works from the raw images: the plain background is
found by flood fill from the edges (so white parts inside the sticker, such
as notebook pages, are kept), not by the general background remover.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

SIZE = 600
PAD = 34  # room for the border and shadow
BORDER = 16  # white outline thickness in px at 600 px


def disk(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r


src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
def cut_plain_background(rgb, tol=10):
    """Alpha mask: everything except the plain background touching the edges."""
    a = rgb.astype(int)
    h, w, _ = a.shape
    bg = np.median(np.array([a[3, 3], a[3, w - 4], a[h - 4, 3], a[h - 4, w - 4]]), axis=0)
    near = np.abs(a - bg).max(axis=2) <= tol
    lab, _ = ndimage.label(near)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    keep = ~np.isin(lab, list(edge))
    keep = ndimage.binary_fill_holes(ndimage.binary_opening(keep, structure=disk(2)))
    return (np.clip(ndimage.gaussian_filter(keep.astype(float), 0.8), 0, 1) * 255).astype(np.uint8)


for name in sorted(f for f in os.listdir(src) if f.startswith('s-') and f.endswith('.png')):
    rgb = np.array(Image.open(os.path.join(src, name)).convert('RGB'))
    im = Image.fromarray(np.dstack([rgb, cut_plain_background(rgb)]), 'RGBA')
    # Crop to the subject and fit it inside the padded square.
    alpha = np.array(im)[:, :, 3]
    ys, xs = np.nonzero(alpha > 24)
    im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    inner = SIZE - 2 * PAD - 2 * BORDER
    scale = inner / max(im.size)
    im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    canvas = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    ox, oy = (SIZE - im.width) // 2, (SIZE - im.height) // 2
    canvas.alpha_composite(im, (ox, oy))
    # Solid silhouette: fill holes, then grow it by BORDER with round corners.
    mask = ndimage.binary_fill_holes(np.array(canvas)[:, :, 3] > 40)
    # Close gaps between thin parts (menorah branches) so the outline is one smooth shape.
    mask = ndimage.binary_closing(np.pad(mask, 40), structure=disk(18))[40:-40, 40:-40]
    outline = ndimage.binary_dilation(mask, structure=disk(BORDER))
    outline = ndimage.gaussian_filter(outline.astype(float), 1.2)
    outline_a = (np.clip(outline, 0, 1) * 255).astype(np.uint8)
    white = Image.new('RGBA', (SIZE, SIZE), (255, 255, 255, 0))
    white.putalpha(Image.fromarray(outline_a))
    shadow = Image.new('RGBA', (SIZE, SIZE), (60, 40, 20, 0))
    shadow.putalpha(Image.fromarray((outline_a * 0.28).astype(np.uint8)).filter(ImageFilter.GaussianBlur(7)))
    out = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    out.alpha_composite(shadow, (0, 6))
    out.alpha_composite(white)
    out.alpha_composite(canvas)
    out.save(os.path.join(dst, name))
    print(name, flush=True)
