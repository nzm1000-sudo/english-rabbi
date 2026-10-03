"""Removes the plain background from the generated illustrations.

Usage: python3 tools/pics/cutout.py <in dir> <out dir>
Writes <out dir>/<id>.png with a transparent background, skipping files
that are already up to date. Needs: pip install "rembg[cpu]" scipy (the
model, isnet-general-use, is downloaded once to ~/.rembg).

The background remover sometimes eats white parts of the subject (a milk
carton, a plate, snow), because they look like the cream background. So the
mask is repaired: holes inside the subject are filled.
Stickers (s-*) are handled by sticker_border.py instead.
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage


def repair(alpha):
    """Fills holes inside the subject (white parts the remover took for background)."""
    solid = alpha > 128
    filled = ndimage.binary_fill_holes(solid)
    return np.maximum(alpha, (filled & ~solid).astype(np.uint8) * 255)


def main():
    from rembg import new_session, remove

    src, dst = sys.argv[1], sys.argv[2]
    os.makedirs(dst, exist_ok=True)
    session = new_session('isnet-general-use')
    names = sorted(f for f in os.listdir(src) if f.endswith('.png') and not f.startswith('s-'))
    for i, name in enumerate(names):
        a, b = os.path.join(src, name), os.path.join(dst, name)
        if os.path.exists(b) and os.path.getmtime(b) >= os.path.getmtime(a) and '--force' not in sys.argv:
            continue
        rgb = np.array(Image.open(a).convert('RGB'))
        cut = remove(Image.fromarray(rgb), session=session, post_process_mask=True)
        alpha = repair(np.array(cut)[:, :, 3])
        Image.fromarray(np.dstack([rgb, alpha]), 'RGBA').save(b)
        print(f'{i + 1}/{len(names)} {name}', flush=True)


if __name__ == '__main__':
    main()
