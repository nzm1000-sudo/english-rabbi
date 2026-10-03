/**
 * Records raw microphone samples with Web Audio, without compressing them.
 * The reading check needs the full, clean signal: on iPhone, decoding the
 * compressed MediaRecorder file again lost parts of the speech.
 * Audio stays in memory on this device.
 */
export interface PcmRecording {
  /** 16 kHz mono samples, as speech recognition expects. */
  samples: Float32Array;
  /** The same audio as a WAV file, to play back. */
  wav: Blob;
  durationMs: number;
}

const TARGET_RATE = 16000;

export class PcmRecorder {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private node: ScriptProcessorNode | null = null;
  private chunks: Float32Array[] = [];
  private startedAt = 0;
  /** Counts starts and releases, so a late microphone grant is not kept. */
  private generation = 0;

  isSupported(): boolean {
    return !!navigator.mediaDevices?.getUserMedia && (typeof AudioContext !== 'undefined' || 'webkitAudioContext' in window);
  }

  /**
   * Must run inside the tap handler, before any await: iPhone only lets an
   * audio context start from a user gesture.
   */
  prepare(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
    }
    void this.ctx.resume();
  }

  async start(): Promise<void> {
    this.prepare();
    const ctx = this.ctx!;
    const gen = ++this.generation;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true, channelCount: 1 } });
    // Released (left the screen) or started again while waiting for the
    // microphone: turn this one off, or the phone keeps recording.
    if (gen !== this.generation || this.ctx !== ctx) {
      stream.getTracks().forEach((t) => t.stop());
      throw new DOMException('recording replaced', 'AbortError');
    }
    this.disconnect();
    this.stream = stream;
    await ctx.resume();
    this.chunks = [];
    this.source = ctx.createMediaStreamSource(this.stream);
    // ScriptProcessor is old but works everywhere, including iPhone.
    this.node = ctx.createScriptProcessor(4096, 1, 1);
    this.node.onaudioprocess = (e) => this.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    this.source.connect(this.node);
    this.node.connect(ctx.destination);
    this.startedAt = Date.now();
  }

  async stop(): Promise<PcmRecording> {
    const ctx = this.ctx;
    if (!ctx || !this.node) throw new Error('not recording');
    const rate = ctx.sampleRate;
    this.disconnect();
    const total = this.chunks.reduce((n, c) => n + c.length, 0);
    const raw = new Float32Array(total);
    let o = 0;
    for (const c of this.chunks) {
      raw.set(c, o);
      o += c.length;
    }
    this.chunks = [];
    const samples = await resample(raw, rate, TARGET_RATE);
    return { samples, wav: toWav(samples, TARGET_RATE), durationMs: Date.now() - this.startedAt };
  }

  private disconnect(): void {
    this.node?.disconnect();
    this.source?.disconnect();
    if (this.node) this.node.onaudioprocess = null;
    this.node = null;
    this.source = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  /** Stops the microphone (the browser's recording indicator turns off). */
  release(): void {
    this.generation++;
    this.disconnect();
    void this.ctx?.close();
    this.ctx = null;
  }
}

async function resample(x: Float32Array, from: number, to: number): Promise<Float32Array> {
  if (!x.length || from === to) return x;
  const length = Math.max(1, Math.round((x.length * to) / from));
  const off = new OfflineAudioContext(1, length, to);
  const buf = off.createBuffer(1, x.length, from);
  buf.copyToChannel(x as Float32Array<ArrayBuffer>, 0);
  const src = off.createBufferSource();
  src.buffer = buf;
  src.connect(off.destination);
  src.start();
  return (await off.startRendering()).getChannelData(0);
}

/** 16-bit mono WAV. */
export function toWav(x: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + x.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + x.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, x.length * 2, true);
  for (let i = 0; i < x.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x[i]!)) * 0x7fff, true);
  return new Blob([buf], { type: 'audio/wav' });
}
