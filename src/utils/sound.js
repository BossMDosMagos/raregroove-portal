let audioCtx = null;

function isEnabled() {
  return typeof window !== 'undefined' && window.__rg_audio_enabled === true;
}

function getCtx() {
  if (audioCtx) return audioCtx;
  const Ctx = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
  if (!Ctx) return null;
  audioCtx = new Ctx();
  return audioCtx;
}

export function enableAudio() {
  if (typeof window === 'undefined') return;
  window.__rg_audio_enabled = true;
  const ctx = getCtx();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => void 0);
}

export function playBeep() {
  if (!isEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(2200, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.09);
}

export function playRelayClick() {
  if (!isEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;

  const duration = 0.035;
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i += 1) {
    const t = i / bufferSize;
    const env = (1 - t) * (1 - t);
    data[i] = (Math.random() * 2 - 1) * env;
  }

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1100;
  filter.Q.value = 8;

  const gain = ctx.createGain();
  gain.gain.value = 0.22;

  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;
  src.start(now);
  src.stop(now + duration);
}

