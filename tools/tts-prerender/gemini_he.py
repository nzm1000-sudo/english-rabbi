"""Renders Hebrew phrases with Gemini TTS, several phrases per request.

Called by hebrew.mjs with {checkModels, batch, jobs: [{text, say?, model, voice, style, out}]}
(say: the text with niqqud where the voice misreads it; the check compares with text)
on stdin. The free tier allows only a few TTS requests a day, so each request
reads a batch of lines with long pauses between them; the audio is cut at
the longest pauses and every piece is checked by transcription before it is
kept. A piece that does not say exactly its phrase is dropped and rendered
again on the next run.

The key comes from GEMINI_API_KEY, or is added by a proxy when unset.
Only fixed app text is sent (instructions and names). Never learner data.
Needs: ffmpeg.
"""
import base64
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

API = 'https://generativelanguage.googleapis.com/v1beta/models'
RATE = 24000
PAUSES = ' Pause for two seconds between lines'


class DailyQuota(Exception):
    pass


def interact(model, voice, style, text):
    """Gemini 3.8 TTS: the text is read verbatim, the style goes in an annotation (Interactions API)."""
    body = {
        'model': model,
        'input': [{'type': 'user_input', 'content': [{'type': 'text', 'text': text, 'annotations': [{'type': 'speech_metadata', 'style': style}]}]}],
        'response_format': {'type': 'audio'},
        'generation_config': {'speech_config': [{'voice': voice}]},
    }
    r = call(model, body, url=f'{API.rsplit("/", 1)[0]}/interactions')
    part = next(c for step in r['steps'] for c in step.get('content', []) if c.get('data'))
    return {'mimeType': part.get('mime_type', 'audio/wav'), 'data': part['data']}


def call(model, body, tries=5, url=None):
    headers = {'Content-Type': 'application/json'}
    if os.environ.get('GEMINI_API_KEY'):
        headers['x-goog-api-key'] = os.environ['GEMINI_API_KEY']
    for attempt in range(tries):
        req = urllib.request.Request(url or f'{API}/{model}:generateContent', data=json.dumps(body).encode(), headers=headers)
        try:
            return json.load(urllib.request.urlopen(req, timeout=300))
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors='replace')
            if e.code == 429 and 'PerDay' in msg:
                raise DailyQuota(model) from None
            if e.code not in (429, 500, 502, 503) or attempt == tries - 1:
                raise RuntimeError(f'{model} {e.code}: {msg[:300]}') from None
            wait = 30 * (attempt + 1)
            m = re.search(r'"retryDelay": "(\d+)s"', msg)
            if m:
                wait = int(m.group(1)) + 2
            print(f'  {e.code}, waiting {wait}s', file=sys.stderr, flush=True)
            time.sleep(wait)
    raise RuntimeError('unreachable')


CACHE = os.path.join(tempfile.gettempdir(), 'gemini-he-cache')


def speak(model, voice, style, lines):
    """Raw audio for these lines, kept on disk so a failed check costs no new TTS request."""
    os.makedirs(CACHE, exist_ok=True)
    prompt = style + (PAUSES + ':\n' if len(lines) > 1 else ': ') + '\n'.join(lines)
    # The 3.8 key differs: its earlier generateContent takes read the style aloud.
    api = 'interactions' if model.startswith('gemini-3.8') else 'generate'
    name = hashlib.sha1(json.dumps([model, voice, prompt] + ([api] if api == 'interactions' else [])).encode()).hexdigest()
    path = os.path.join(CACHE, name + '.pcm')
    if os.path.exists(path):
        with open(path, 'rb') as f:
            return f.read()
    if model.startswith('gemini-3.8'):
        if len(lines) != 1:
            raise RuntimeError('gemini-3.8 TTS records one phrase per request (batch 1)')
        part = interact(model, voice, style, lines[0])
    else:
        part = None
    body = {
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': {
            'responseModalities': ['AUDIO'],
            'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': voice}}},
        },
    }
    part = part or call(model, body)['candidates'][0]['content']['parts'][0]['inlineData']
    data = base64.b64decode(part['data'])
    if part['mimeType'].startswith('audio/l16'):
        pcm = data
    elif part['mimeType'] in ('audio/wav', 'audio/x-wav'):  # newer models send a WAV file
        pcm = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', '-', '-f', 's16le', '-ar', str(RATE), '-ac', '1', '-'],
                             input=data, capture_output=True, check=True).stdout
    else:
        raise RuntimeError(f'unexpected audio {part["mimeType"]}')
    with open(path, 'wb') as f:
        f.write(pcm)
    return pcm


def pieces(pcm, n):
    """Cuts raw 16-bit mono PCM at the n-1 longest pauses. Returns n byte ranges or None."""
    with tempfile.NamedTemporaryFile(suffix='.pcm') as f:
        f.write(pcm)
        f.flush()
        log = subprocess.run(
            ['ffmpeg', '-f', 's16le', '-ar', str(RATE), '-ac', '1', '-i', f.name, '-af', 'silencedetect=noise=-40dB:d=0.35', '-f', 'null', '-'],
            capture_output=True, text=True,
        ).stderr
    total = len(pcm) / 2 / RATE
    starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', log)]
    ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', log)]
    # Pauses inside the speech (not the lead-in or the tail).
    gaps = [(e - s, s, e) for s, e in zip(starts, ends) if s > 0.05 and e < total - 0.05]
    if len(gaps) < n - 1:
        return None
    cuts = sorted(gaps, reverse=True)[: n - 1]
    bounds = [0.0] + [(s + e) / 2 for _, s, e in sorted(cuts, key=lambda g: g[1])] + [total]
    to_byte = lambda t: int(t * RATE) * 2
    return [(to_byte(a), to_byte(b)) for a, b in zip(bounds, bounds[1:])]


def norm(s):
    s = re.sub(r'[֑-ׇ]', '', s)  # niqqud and cantillation
    s = re.sub(r'[^א-תA-Za-z0-9 ]', ' ', s)
    s = re.sub(r'[וי]', '', s)  # full and defective spelling (לחמנייה / לחמניה) sound the same
    # Letters that sound alike in Israeli Hebrew: the transcript may pick either.
    s = s.translate(str.maketrans('טקחעםןץףך', 'תככאמנצפכ'))
    return ' '.join(s.split())


def check(models, wavs, lines):
    """Transcribes every piece in one request. Returns which pieces say their line."""
    parts = []
    for i, w in enumerate(wavs):
        parts.append({'text': f'Clip {i + 1}:'})
        parts.append({'inlineData': {'mimeType': 'audio/wav', 'data': base64.b64encode(w).decode()}})
    parts.append({'text': f'Transcribe each of the {len(wavs)} Hebrew clips exactly as spoken, without niqqud. '
                          'Answer only with a JSON array of strings, one per clip, in order.'})
    body = {'contents': [{'parts': parts}], 'generationConfig': {'responseMimeType': 'application/json', 'temperature': 0}}
    # Busy or out of quota: the next model checks just as well.
    for m in models:
        try:
            text = call(m, body, tries=2)['candidates'][0]['content']['parts'][0]['text']
            break
        except (DailyQuota, RuntimeError) as e:
            print(f'  check with {m} failed ({str(e)[:60]}), trying the next model', file=sys.stderr, flush=True)
    else:
        raise RuntimeError('no model could check the audio; the audio is cached, run again later')
    heard = json.loads(text)
    if not isinstance(heard, list) or len(heard) != len(lines):
        return [False] * len(lines), [str(heard)] * len(lines)
    return [norm(h) == norm(t) for h, t in zip(heard, lines)], heard


def wav(pcm):
    r = subprocess.run(['ffmpeg', '-loglevel', 'error', '-f', 's16le', '-ar', str(RATE), '-ac', '1', '-i', '-', '-f', 'wav', '-'],
                       input=pcm, capture_output=True, check=True)
    return r.stdout


def main():
    cfg = json.load(sys.stdin)
    by_voice = {}
    for j in cfg['jobs']:
        by_voice.setdefault((j['model'], j['voice'], j['style']), []).append(j)
    done = failed = 0
    spent = set()  # models whose daily quota is used up; the other models go on
    for (model, voice, style), jobs in by_voice.items():
        for i in range(0, len(jobs), cfg['batch']):
            if model in spent:
                break
            batch = jobs[i : i + cfg['batch']]
            lines = [j['text'] for j in batch]
            spoken = [j.get('say', j['text']) for j in batch]
            print(f'{voice}: {" / ".join(spoken)}', flush=True)
            try:
                pcm = speak(model, voice, style, spoken)
            except DailyQuota:
                print(f'daily quota of {model} used up; run again after the reset', flush=True)
                spent.add(model)
                break
            except RuntimeError as e:
                print(f'  {str(e)[:120]}; will retry next run', flush=True)
                failed += len(batch)
                continue
            cut = pieces(pcm, len(batch))
            if not cut:
                print('  could not find the pauses; will retry next run', flush=True)
                failed += len(batch)
                continue
            wavs = [wav(pcm[a:b]) for a, b in cut]
            try:
                ok, heard = check(cfg['checkModels'], wavs, lines)
            except RuntimeError as e:
                print(f'  {e}', flush=True)
                failed += len(batch)
                continue
            for j, w, good, h in zip(batch, wavs, ok, heard):
                if not good:
                    print(f'  rejected "{j["text"]}" (heard "{h}")', flush=True)
                    failed += 1
                    continue
                subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', '-', '-ac', '1', '-ar', str(RATE), '-b:a', '48k', j['out']],
                               input=w, check=True)
                done += 1
    print(f'{done} rendered, {failed} rejected', flush=True)


main()
