"""Draws the missing storybook pages with Gemini image generation.

Usage: python3 tools/pics/gemini_pages.py <out folder> [page ids...]
Reads tools/pics/little-book-prompts.json (scene per page, shared style,
character descriptions). When a page names a storybook character, the
character's existing picture (public/pics/c-<name>.webp) is sent along so
they look the same in every book. Pages already in public/pics are skipped.
Then import the folder with tools/pics/import.mjs.

The key comes from GEMINI_API_KEY, or is added by a proxy when unset.
Only the fixed scene text is sent. Never learner data. Needs: ffmpeg.
"""
import base64
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request

MODEL = 'gemini-3.1-flash-image'
API = f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent'
root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
# A finished page from the young books: every new page copies its look.
STYLE_PIC = 'b-kb-young-milk-rug-3'
CHARACTER_PICS = {'Ari': 'c-ari', 'Tamar': 'c-tamar', 'Ima': 'c-ima', 'Eli': 'c-eli', 'Abba': 'c-abba', 'Grandma': 'c-grandma'}


def png_b64(webp):
    out = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', webp, '-f', 'image2pipe', '-vcodec', 'png', '-'], capture_output=True, check=True).stdout
    return base64.b64encode(out).decode()


def call(body):
    headers = {'Content-Type': 'application/json'}
    if os.environ.get('GEMINI_API_KEY'):
        headers['x-goog-api-key'] = os.environ['GEMINI_API_KEY']
    for attempt in range(5):
        try:
            req = urllib.request.Request(API, data=json.dumps(body).encode(), headers=headers)
            return json.load(urllib.request.urlopen(req, timeout=300))
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors='replace')
            if e.code not in (429, 500, 502, 503) or attempt == 4:
                raise RuntimeError(f'{e.code}: {msg[:200]}') from None
            time.sleep(20 * (attempt + 1))


def main():
    out_dir = sys.argv[1]
    os.makedirs(out_dir, exist_ok=True)
    spec = json.load(open(os.path.join(root, 'tools/pics/little-book-prompts.json')))
    have = set(json.load(open(os.path.join(root, 'content/kids/pics.json'))))
    ids = sys.argv[2:] or [k for k in spec if k.startswith('b-') and k not in have]
    for pid in ids:
        dest = os.path.join(out_dir, pid + '.png')
        if os.path.exists(dest):
            continue
        scene = spec[pid]
        names = [n for n in CHARACTER_PICS if re.search(rf'\b{n}\b', scene)]
        parts = [
            {'text': 'Style reference: match this exact look (3D computer-animated film render, soft light, colours, level of detail). Do not copy its content:'},
            {'inlineData': {'mimeType': 'image/png', 'data': png_b64(os.path.join(root, 'public/pics', STYLE_PIC + '.webp'))}},
        ]
        for n in names:
            pic = os.path.join(root, 'public/pics', CHARACTER_PICS[n] + '.webp')
            if os.path.exists(pic):
                parts.append({'text': f'Reference picture of {n}; draw {n} exactly like this (face, hair, clothes):'})
                parts.append({'inlineData': {'mimeType': 'image/png', 'data': png_b64(pic)}})
        described = [f'{n} is {spec["_characters"][n]}.' for n in names if n in spec['_characters']]
        parts.append({'text': ' '.join([scene, *described, spec['_style'], 'Landscape 4:3 picture.'])})
        body = {'contents': [{'parts': parts}], 'generationConfig': {'responseModalities': ['IMAGE'], 'imageConfig': {'aspectRatio': '4:3'}}}
        try:
            r = call(body)
            img = next(p['inlineData'] for p in r['candidates'][0]['content']['parts'] if 'inlineData' in p)
        except (RuntimeError, KeyError, StopIteration) as e:
            print(f'{pid}: failed ({e})', flush=True)
            continue
        raw = dest + '.src'
        with open(raw, 'wb') as f:
            f.write(base64.b64decode(img['data']))
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-vf', 'scale=800:600:flags=lanczos', dest], check=True)
        os.remove(raw)
        print(f'{pid}: ok', flush=True)


main()
