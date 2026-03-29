import { useEffect, useRef } from 'react';
import { Howler } from 'howler';

function WooferBassSync(elements) {
  const BASS_MIN_HZ = 20;
  const BASS_MAX_HZ = 250;
  const SMOOTH = 0.75;
  const SCALE_MIN = 1.00;
  const SCALE_MAX = 1.16;
  const GLOW_MAX_PX = 28;

  const coneL = elements.coneL;
  const coneR = elements.coneR;
  const wooferL = elements.wooferL || null;
  const wooferR = elements.wooferR || null;

  let analyserL = null;
  let analyserR = null;
  let splitter = null;
  let frameId = null;
  let freqDataL = null;
  let freqDataR = null;
  let smoothL = 0;
  let smoothR = 0;
  let bassMinBin = 0;
  let bassMaxBin = 0;

  function connect() {
    const ctx = Howler.ctx;
    if (!ctx) return false;

    const nyquist = ctx.sampleRate / 2;
    const fftSize = 2048;
    const binSize = nyquist / (fftSize / 2);
    bassMinBin = Math.floor(BASS_MIN_HZ / binSize);
    bassMaxBin = Math.ceil(BASS_MAX_HZ / binSize);

    splitter = ctx.createChannelSplitter(2);
    analyserL = ctx.createAnalyser();
    analyserR = ctx.createAnalyser();

    analyserL.fftSize = fftSize;
    analyserR.fftSize = fftSize;
    analyserL.smoothingTimeConstant = 0.0;
    analyserR.smoothingTimeConstant = 0.0;

    freqDataL = new Uint8Array(analyserL.frequencyBinCount);
    freqDataR = new Uint8Array(analyserR.frequencyBinCount);

    Howler.masterGain.connect(splitter);
    splitter.connect(analyserL, 0);
    splitter.connect(analyserR, 1);
    analyserL.connect(ctx.destination);

    return true;
  }

  function disconnect() {
    try { if (splitter) splitter.disconnect(); } catch (e) { }
    try { if (analyserL) analyserL.disconnect(); } catch (e) { }
    try { if (analyserR) analyserR.disconnect(); } catch (e) { }
    splitter = analyserL = analyserR = null;
    freqDataL = freqDataR = null;
  }

  function bassEnergy(analyser, data) {
    analyser.getByteFrequencyData(data);
    let sum = 0;
    const count = bassMaxBin - bassMinBin;
    for (let i = bassMinBin; i < bassMaxBin && i < data.length; i++) {
      const norm = data[i] / 255;
      sum += norm * norm;
    }
    return Math.sqrt(sum / count);
  }

  function applyCone(cone, woofer, energy) {
    const scale = SCALE_MIN + energy * (SCALE_MAX - SCALE_MIN);
    const tz = energy * -8;

    cone.style.transform = `scale(${scale.toFixed(4)}) translateZ(${tz.toFixed(2)}px)`;

    cone.style.boxShadow =
      `inset 0 4px 12px rgba(0,0,0,0.7),` +
      `inset 0 -2px 8px rgba(255,215,0,${(energy * 0.25).toFixed(3)})`;

    if (woofer) {
      const g = (energy * GLOW_MAX_PX).toFixed(1);
      const o = (energy * 0.7).toFixed(3);
      const ring = woofer.querySelector('.woofer-ring');
      if (ring) {
        ring.style.boxShadow = energy > 0.08
          ? `inset 0 2px 6px rgba(0,0,0,0.9), 0 0 ${g}px rgba(255,180,0,${o})`
          : `inset 0 2px 6px rgba(0,0,0,0.9)`;
      }
    }
  }

  function loop() {
    if (!analyserL || !analyserR || !freqDataL || !freqDataR) {
      frameId = requestAnimationFrame(loop);
      return;
    }

    const rawL = bassEnergy(analyserL, freqDataL);
    const rawR = bassEnergy(analyserR, freqDataR);

    smoothL = rawL > smoothL
      ? smoothL + (rawL - smoothL) * 0.6
      : smoothL + (rawL - smoothL) * (1 - SMOOTH);

    smoothR = rawR > smoothR
      ? smoothR + (rawR - smoothR) * 0.6
      : smoothR + (rawR - smoothR) * (1 - SMOOTH);

    applyCone(coneL, wooferL, smoothL);
    applyCone(coneR, wooferR, smoothR);

    frameId = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (frameId !== null) return;
    frameId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
    if (coneL) coneL.style.transform = 'scale(1) translateZ(0)';
    if (coneR) coneR.style.transform = 'scale(1) translateZ(0)';
    if (wooferL) {
      const ring = wooferL.querySelector('.woofer-ring');
      if (ring) ring.style.boxShadow = '';
    }
    if (wooferR) {
      const ring = wooferR.querySelector('.woofer-ring');
      if (ring) ring.style.boxShadow = '';
    }
    smoothL = smoothR = 0;
  }

  async function ensureCtx() {
    const ctx = Howler.ctx;
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch (e) { return false; }
    }
    return ctx.state === 'running';
  }

  function attach() {
    disconnect();
    setTimeout(async () => {
      const ok = await ensureCtx();
      if (!ok) { console.warn('[WooferBassSync] AudioContext não disponível.'); return; }
      if (connect()) startLoop();
    }, 100);
  }

  function detach() {
    stopLoop();
    disconnect();
  }

  return { attach, detach };
}

export function VirtualWooferLeft() {
  const coneLRef = useRef(null);
  const wooferLRef = useRef(null);

  useEffect(() => {
    if (!coneLRef.current || !wooferLRef.current) return;

    const wooferMotor = WooferBassSync({
      coneL: coneLRef.current,
      coneR: document.getElementById('cone-r'),
      wooferL: wooferLRef.current,
      wooferR: document.getElementById('woofer-r'),
    });

    const handlePlay = () => wooferMotor.attach();
    const handleStop = () => wooferMotor.detach();
    const handlePause = () => wooferMotor.detach();

    document.addEventListener('grooveflix-play', handlePlay);
    document.addEventListener('grooveflix-stop', handleStop);
    document.addEventListener('grooveflix-pause', handlePause);

    return () => {
      document.removeEventListener('grooveflix-play', handlePlay);
      document.removeEventListener('grooveflix-stop', handleStop);
      document.removeEventListener('grooveflix-pause', handlePause);
      wooferMotor.detach();
    };
  }, []);

  return (
    <div className="woofer" id="woofer-l" ref={wooferLRef}>
      <div className="woofer-ring"></div>
      <div className="woofer-surround"></div>
      <div className="woofer-cone" id="cone-l" ref={coneLRef}>
        <div className="woofer-spider">
          <div className="woofer-dustcap"></div>
        </div>
      </div>
      <div className="woofer-label">Canal L</div>
    </div>
  );
}

export function VirtualWooferRight() {
  const coneRRef = useRef(null);
  const wooferRRef = useRef(null);

  useEffect(() => {
    if (!coneRRef.current || !wooferRRef.current) return;

    const wooferMotor = WooferBassSync({
      coneL: document.getElementById('cone-l'),
      coneR: coneRRef.current,
      wooferL: document.getElementById('woofer-l'),
      wooferR: wooferRRef.current,
    });

    const handlePlay = () => wooferMotor.attach();
    const handleStop = () => wooferMotor.detach();
    const handlePause = () => wooferMotor.detach();

    document.addEventListener('grooveflix-play', handlePlay);
    document.addEventListener('grooveflix-stop', handleStop);
    document.addEventListener('grooveflix-pause', handlePause);

    return () => {
      document.removeEventListener('grooveflix-play', handlePlay);
      document.removeEventListener('grooveflix-stop', handleStop);
      document.removeEventListener('grooveflix-pause', handlePause);
      wooferMotor.detach();
    };
  }, []);

  return (
    <div className="woofer" id="woofer-r" ref={wooferRRef}>
      <div className="woofer-ring"></div>
      <div className="woofer-surround"></div>
      <div className="woofer-cone" id="cone-r" ref={coneRRef}>
        <div className="woofer-spider">
          <div className="woofer-dustcap"></div>
        </div>
      </div>
      <div className="woofer-label">Canal R</div>
    </div>
  );
}
