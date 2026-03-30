import { useEffect, useRef } from 'react';
import { Howler } from 'howler';

function WooferBassSync(elements) {
  const BASS_MIN_HZ = 20;
  const BASS_MAX_HZ = 250;
  const SMOOTH = 0.75;
  const SCALE_MIN = 1.00;
  const SCALE_MAX = 1.15;

  const speakerL = elements.speakerL;
  const speakerR = elements.speakerR;

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

  function applySpeaker(speaker, energy) {
    const scale = SCALE_MIN + energy * (SCALE_MAX - SCALE_MIN);
    const glow = energy * 25;
    
    if (speaker) {
      speaker.style.transform = `scale(${scale.toFixed(4)})`;
      speaker.style.filter = `drop-shadow(0 0 ${glow}px rgba(0, 255, 255, ${energy * 0.8}))`;
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

    applySpeaker(speakerL, smoothL);
    applySpeaker(speakerR, smoothR);

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
    if (speakerL) {
      speakerL.style.transform = 'scale(1)';
      speakerL.style.filter = 'none';
    }
    if (speakerR) {
      speakerR.style.transform = 'scale(1)';
      speakerR.style.filter = 'none';
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
  const speakerLRef = useRef(null);

  useEffect(() => {
    if (!speakerLRef.current) return;

    const wooferMotor = WooferBassSync({
      speakerL: speakerLRef.current,
      speakerR: document.getElementById('speaker-r'),
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
    <div className="flex items-center justify-center">
      <img 
        id="speaker-l"
        ref={speakerLRef}
        src="/images/speaker/falante.png"
        alt="Speaker L"
        className="w-32 h-32 object-contain transition-transform duration-75"
        style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }}
      />
    </div>
  );
}

export function VirtualWooferRight() {
  const speakerRRef = useRef(null);

  useEffect(() => {
    if (!speakerRRef.current) return;

    const wooferMotor = WooferBassSync({
      speakerL: document.getElementById('speaker-l'),
      speakerR: speakerRRef.current,
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
    <div className="flex items-center justify-center">
      <img 
        id="speaker-r"
        ref={speakerRRef}
        src="/images/speaker/falante.png"
        alt="Speaker R"
        className="w-32 h-32 object-contain transition-transform duration-75"
        style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }}
      />
    </div>
  );
}
