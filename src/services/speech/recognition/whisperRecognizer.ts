import type { RecognitionResult, SpeechRecognizer } from './types';

/**
 * Speech-to-text on the phone itself with Whisper base.en (MIT licence),
 * run by transformers.js in WebAssembly. The model and runtime are served
 * from this site (public/models, public/ort), so the child's voice never
 * leaves the device. About 105 MB the first time, then cached for offline use.
 */
type Asr = (audio: Float32Array) => Promise<{ text: string } | { text: string }[]>;

/** Whisper base.en: about twice the size of tiny, clearly better with young and accented voices. */
function modelId(): string {
  try {
    return localStorage.getItem('asrModel') ?? 'whisper-base.en';
  } catch {
    return 'whisper-base.en';
  }
}

let loading: Promise<Asr> | null = null;
let ready = false;

export type LoadProgress = (loaded: number, total: number) => void;

export function isRecognizerReady(): boolean {
  return ready;
}

/** True when the model files are already in the offline cache. */
export async function isRecognizerCached(): Promise<boolean> {
  try {
    const keys = await caches.keys();
    for (const k of keys) {
      const c = await caches.open(k);
      if (await c.match(new URL(`models/${modelId()}/onnx/decoder_model_merged_quantized.onnx`, document.baseURI).href)) return true;
    }
  } catch {
    /* no Cache API */
  }
  return false;
}

export function loadRecognizer(onProgress?: LoadProgress): Promise<Asr> {
  loading ??= (async () => {
    const { AutoProcessor, AutoTokenizer, AutomaticSpeechRecognitionPipeline, WhisperForConditionalGeneration, env } = await import('@huggingface/transformers');
    const base = document.baseURI;
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    // Relative on purpose: transformers.js skips its local-file check for absolute URLs.
    env.localModelPath = 'models/';
    const wasm = env.backends.onnx?.wasm;
    if (wasm) {
      // Runtime files are served from this site (public/ort), not from a CDN.
      wasm.wasmPaths = new URL('ort/', base).href;
      // GitHub Pages is not cross-origin isolated, so no threads.
      wasm.numThreads = 1;
    }
    const files = new Map<string, { loaded: number; total: number }>();
    const progress_callback = (p: { status: string; file?: string; loaded?: number; total?: number }) => {
      if (p.status !== 'progress' || !p.file) return;
      files.set(p.file, { loaded: p.loaded ?? 0, total: p.total ?? 0 });
      let l = 0;
      let t = 0;
      for (const f of files.values()) {
        l += f.loaded;
        t += f.total;
      }
      onProgress?.(l, t);
    };
    // Built by hand: the generic pipeline() cannot list local files without the Hub.
    const id = modelId();
    const [processor, tokenizer, model] = await Promise.all([
      AutoProcessor.from_pretrained(id, { progress_callback }),
      AutoTokenizer.from_pretrained(id, { progress_callback }),
      WhisperForConditionalGeneration.from_pretrained(id, { dtype: 'q8', device: 'wasm', progress_callback }),
    ]);
    const asr = new AutomaticSpeechRecognitionPipeline({ task: 'automatic-speech-recognition', model, tokenizer, processor });
    ready = true;
    return asr as unknown as Asr;
  })();
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

/**
 * Phone microphones (with echo cancellation on) often record quietly, and a
 * quiet input makes Whisper drop words. Remove any DC offset and bring the
 * loudest point to 90%.
 */
export function normalize(x: Float32Array): Float32Array {
  if (!x.length) return x;
  let mean = 0;
  for (const v of x) mean += v;
  mean /= x.length;
  let peak = 0;
  for (let i = 0; i < x.length; i++) {
    x[i] = x[i]! - mean;
    peak = Math.max(peak, Math.abs(x[i]!));
  }
  if (peak < 1e-4) return x;
  const gain = Math.min(20, 0.9 / peak);
  for (let i = 0; i < x.length; i++) x[i] = x[i]! * gain;
  return x;
}

/** Decodes a recording to 16 kHz mono samples, as Whisper expects. */
async function toSamples(blob: Blob): Promise<Float32Array> {
  const data = await blob.arrayBuffer();
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const decoded = await ctx.decodeAudioData(data);
    const length = Math.ceil(decoded.duration * 16000);
    const off = new OfflineAudioContext(1, Math.max(1, length), 16000);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start();
    const out = await off.startRendering();
    return out.getChannelData(0);
  } finally {
    void ctx.close();
  }
}

export class WhisperRecognizer implements SpeechRecognizer {
  readonly id = 'whisper-tiny-en';
  readonly runsOnDevice = true;

  async recognize(audio: Blob): Promise<RecognitionResult> {
    return this.recognizeSamples(await toSamples(audio));
  }

  /** 16 kHz mono samples (from PcmRecorder). */
  async recognizeSamples(samples: Float32Array): Promise<RecognitionResult> {
    const asr = await loadRecognizer();
    const r = await asr(normalize(new Float32Array(samples)));
    const text = Array.isArray(r) ? r.map((x) => x.text).join(' ') : r.text;
    return { transcript: text.trim(), confidence: 1 };
  }
}
