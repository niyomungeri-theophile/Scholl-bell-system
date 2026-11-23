import { BellTone } from '../types';

let sharedAudioCtx: AudioContext | null = null;
let activeTimers: number[] = [];
let activeNodes: AudioNode[] = [];
let playGeneration = 0;

function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctx();
  }
  return sharedAudioCtx;
}

async function ensureAudioContextReady(ctx: AudioContext): Promise<void> {
  if (ctx.state !== 'suspended') return;
  try {
    await Promise.race([
      ctx.resume(),
      new Promise<void>((resolve) => window.setTimeout(resolve, 150)),
    ]);
  } catch {
    // Ignore resume errors when blocked by autoplay policy
  }
}

export function stopAllBells(): void {
  playGeneration++;
  activeTimers.forEach((id) => window.clearTimeout(id));
  activeTimers = [];
  activeNodes.forEach((node) => {
    try {
      if ('stop' in node && typeof (node as OscillatorNode).stop === 'function') {
        (node as OscillatorNode).stop();
      }
      node.disconnect();
    } catch {
      // Ignore already stopped audio nodes
    }
  });
  activeNodes = [];
}

function playTonePartial(
  ctx: AudioContext,
  freq: number,
  startOffsetSec: number,
  decaySec: number,
  gainPeak: number,
  type: OscillatorType = 'sine'
): void {
  const now = ctx.currentTime + startOffsetSec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, gainPeak), now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + decaySec);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + decaySec + 0.05);

  activeNodes.push(osc, gain);
}

export function playSchoolBell(
  tone: BellTone,
  volumePercent = 80,
  onComplete?: () => void
): void {
  stopAllBells();
  const myGen = playGeneration;
  const ctx = getOrCreateAudioContext();
  if (!ctx) {
    if (onComplete) {
      const id = window.setTimeout(onComplete, 1200);
      activeTimers.push(id);
    }
    return;
  }

  const startPlayback = async () => {
    await ensureAudioContextReady(ctx);
    if (myGen !== playGeneration) return;

    const vol = Math.min(1, Math.max(0.05, volumePercent / 100)) * 0.45;
    let totalMs = 2200;

    if (tone === 'brass-bell') {
      // Classic resonant brass school bell with rich harmonic strike + repeat
      const strike = (offset: number) => {
        playTonePartial(ctx, 587.33, offset, 2.2, vol * 0.85, 'sine');
        playTonePartial(ctx, 1174.66, offset, 1.6, vol * 0.45, 'triangle');
        playTonePartial(ctx, 1760.0, offset, 1.0, vol * 0.25, 'sine');
        playTonePartial(ctx, 2489.02, offset, 0.7, vol * 0.14, 'sine');
      };
      strike(0);
      strike(0.85);
      totalMs = 2800;
    } else if (tone === 'westminster-chime') {
      // Clocktower 4-note sequence: G#4 - F#4 - E4 - B3
      const notes = [415.3, 369.99, 329.63, 246.94];
      notes.forEach((freq, idx) => {
        const offset = idx * 0.45;
        playTonePartial(ctx, freq, offset, 1.4, vol * 0.8, 'sine');
        playTonePartial(ctx, freq * 2, offset, 0.9, vol * 0.25, 'triangle');
      });
      totalMs = 2900;
    } else if (tone === 'gentle-tone') {
      // Soft dual-note warm library chime
      playTonePartial(ctx, 523.25, 0, 1.5, vol * 0.65, 'sine');
      playTonePartial(ctx, 659.25, 0.35, 1.8, vol * 0.65, 'sine');
      totalMs = 2200;
    } else if (tone === 'emergency-alert') {
      // Distinct high-clarity pulse alert
      [0, 0.45, 0.9, 1.35].forEach((offset) => {
        playTonePartial(ctx, 880, offset, 0.28, vol * 0.75, 'triangle');
        playTonePartial(ctx, 660, offset + 0.14, 0.25, vol * 0.55, 'triangle');
      });
      totalMs = 2100;
    }

    if (onComplete) {
      const id = window.setTimeout(() => {
        if (myGen === playGeneration) onComplete();
      }, totalMs);
      activeTimers.push(id);
    }
  };

  void startPlayback();
}
