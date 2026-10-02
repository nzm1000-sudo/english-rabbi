/**
 * Short UI sounds synthesized with Web Audio (no files, works offline).
 * Rewards accuracy, not speed. Can be muted in the parent screen.
 */
let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

function audio(): AudioContext | null {
  if (!enabled || typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.12) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + start;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sounds = {
  correct() {
    tone(784, 0, 0.16, 'triangle');
    tone(1175, 0.08, 0.22, 'triangle');
  },
  wrong() {
    tone(220, 0, 0.22, 'sine', 0.08);
  },
  combo() {
    [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.06, 0.18, 'triangle', 0.09));
  },
  finish() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.3, 'triangle', 0.1));
  },
};
