"""Renders Hebrew phrases with Microsoft's neural Hebrew voice (edge-tts).

Called by hebrew.mjs with a JSON list of {text, out} jobs on stdin.
Only fixed app text is sent (instructions, names of topics, stickers and
books). No learner data and no voice recordings ever leave the phone.
Needs: pip install edge-tts
"""
import asyncio
import json
import os
import sys

import certifi

# Trust a corporate proxy CA when one is set (SSL_CERT_FILE).
if os.environ.get('SSL_CERT_FILE'):
    certifi.where = lambda: os.environ['SSL_CERT_FILE']

import edge_tts  # noqa: E402


async def main() -> None:
    cfg = json.load(sys.stdin)
    for i, job in enumerate(cfg['jobs']):
        for attempt in range(3):
            try:
                await edge_tts.Communicate(job['text'], cfg['voice'], rate=cfg['rate']).save(job['out'])
                break
            except Exception as e:  # network hiccup: retry
                if attempt == 2:
                    raise
                print(f'retry {job["text"]}: {e}', file=sys.stderr)
                await asyncio.sleep(2 * (attempt + 1))
        print(f'{i + 1}/{len(cfg["jobs"])} {job["text"]}', flush=True)


asyncio.run(main())
