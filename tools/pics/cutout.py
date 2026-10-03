"""Removes the plain background from the generated illustrations.

Usage: python3 tools/pics/cutout.py <in dir> <out dir>
Writes <out dir>/<id>.png with a transparent background, skipping files
that are already up to date. Needs: pip install "rembg[cpu]" (the model,
isnet-general-use, is downloaded once to ~/.rembg).
"""
import os
import sys

from PIL import Image
from rembg import new_session, remove

src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
session = new_session('isnet-general-use')
names = sorted(f for f in os.listdir(src) if f.endswith('.png'))
for i, name in enumerate(names):
    a, b = os.path.join(src, name), os.path.join(dst, name)
    if os.path.exists(b) and os.path.getmtime(b) >= os.path.getmtime(a):
        continue
    out = remove(Image.open(a).convert('RGB'), session=session, post_process_mask=True)
    out.save(b)
    print(f'{i + 1}/{len(names)} {name}', flush=True)
