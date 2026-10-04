"""Renders English learning audio with Microsoft's neural voices (edge-tts).

Called by prerender.mjs with {jobs: [{text, voice, rate, out}]} on stdin.
Only fixed app text is sent (questions, examples, passages). No learner data.
Writes each file as it is done and prints one line per file, so a stopped run
keeps its work. Needs: pip install edge-tts
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

CONCURRENCY = int(os.environ.get('EDGE_CONCURRENCY', '6'))


async def render(job, sem):
    async with sem:
        for attempt in range(4):
            try:
                tmp = job['out'] + '.part'
                await edge_tts.Communicate(job['text'], job['voice'], rate=job['rate']).save(tmp)
                if os.path.getsize(tmp) == 0:
                    raise RuntimeError('empty audio')
                os.replace(tmp, job['out'])
                print(f'ok {job["out"]}', flush=True)
                return
            except Exception as e:  # network hiccup or throttling: back off and retry
                if attempt == 3:
                    print(f'fail {job["out"]} {e}', flush=True)
                    return
                await asyncio.sleep(3 * (attempt + 1))


async def main() -> None:
    jobs = json.load(sys.stdin)['jobs']
    sem = asyncio.Semaphore(CONCURRENCY)
    await asyncio.gather(*(render(j, sem) for j in jobs))


asyncio.run(main())
