import { useRef, useState, useCallback } from 'react';
import { Howl, Howler } from 'howler';

const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

const ANSI = {
  FFT_SIZE: 2048,
  SMOOTHING: 0.85,
};

function dbToLinear(db) {
  return Math.pow(10, db / 20);
}

export function useAudioEngine() {
  const ctxRef = useRef(null);
  const howlRef = useRef(null);
  const volumeRef = useRef(0.8);
  const isInitializedRef = useRef(false);
  const isConnectedRef = useRef(false);

  const masterGainRef = useRef(null);
  const inputGainRef = useRef(null);
  const eqFiltersRef = useRef([]);
  const toneFiltersRef = useRef({});
  const analyserLRef = useRef(null);
  const analyserRRef = useRef(null);
  const splitterRef = useRef(null);
  const mergerRef = useRef(null);
  const vuGainRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [isReady, setIsReady] = useState(false);
  const [eqBands, setEqBands] = useState(() => 
    Object.fromEntries(EQ_FREQUENCIES.map(f => [f, 0]))
  );
  const [toneSettings, setToneSettings] = useState({ bass: 0, mid: 0, treble: 0 });

  const ensureContextRunning = useCallback(async () => {
    const ctx = Howler.ctx;
    if (!ctx) return false;
    if (ctx.state === 'closed') return false;
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch (e) { return false; }
    }
    return true;
  }, []);

  const createNodeChain = useCallback(() => {
    const ctx = Howler.ctx;
    if (!ctx || isInitializedRef.current) return;

    ctxRef.current = ctx;
    if (ctx.state === 'suspended') ctx.resume();

    const chain = {};

    chain.input = ctx.createGain();
    chain.input.gain.value = 1;
    inputGainRef.current = chain.input;

    chain.eqFilters = EQ_FREQUENCIES.map((freq, i) => {
      const filter = ctx.createBiquadFilter();
      if (i === 0) filter.type = 'lowshelf';
      else if (i === EQ_FREQUENCIES.length - 1) filter.type = 'highshelf';
      else filter.type = 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1.4;
      filter.gain.value = 0;
      return filter;
    });
    eqFiltersRef.current = chain.eqFilters;

    chain.bassFilter = ctx.createBiquadFilter();
    chain.bassFilter.type = 'lowshelf';
    chain.bassFilter.frequency.value = 100;
    chain.bassFilter.gain.value = 0;

    chain.midFilter = ctx.createBiquadFilter();
    chain.midFilter.type = 'peaking';
    chain.midFilter.frequency.value = 1000;
    chain.midFilter.Q.value = 1.0;
    chain.midFilter.gain.value = 0;

    chain.trebleFilter = ctx.createBiquadFilter();
    chain.trebleFilter.type = 'highshelf';
    chain.trebleFilter.frequency.value = 4000;
    chain.trebleFilter.gain.value = 0;

    toneFiltersRef.current = { bass: chain.bassFilter, mid: chain.midFilter, treble: chain.trebleFilter };

    chain.vuGain = ctx.createGain();
    chain.vuGain.gain.value = 1;
    vuGainRef.current = chain.vuGain;

    chain.splitter = ctx.createChannelSplitter(2);
    splitterRef.current = chain.splitter;

    chain.analyserL = ctx.createAnalyser();
    chain.analyserL.fftSize = ANSI.FFT_SIZE;
    chain.analyserL.smoothingTimeConstant = ANSI.SMOOTHING;
    analyserLRef.current = chain.analyserL;

    chain.analyserR = ctx.createAnalyser();
    chain.analyserR.fftSize = ANSI.FFT_SIZE;
    chain.analyserR.smoothingTimeConstant = ANSI.SMOOTHING;
    analyserRRef.current = chain.analyserR;

    chain.merger = ctx.createChannelMerger(2);
    mergerRef.current = chain.merger;

    chain.masterGain = Howler.masterGain || ctx.createGain();
    chain.masterGain.gain.value = volumeRef.current;
    masterGainRef.current = chain.masterGain;

    chain.input.connect(chain.eqFilters[0]);
    for (let i = 0; i < chain.eqFilters.length - 1; i++) {
      chain.eqFilters[i].connect(chain.eqFilters[i + 1]);
    }

    const lastEq = chain.eqFilters[chain.eqFilters.length - 1];
    lastEq.connect(chain.bassFilter);
    lastEq.connect(chain.vuGain);

    chain.bassFilter.connect(chain.midFilter);
    chain.midFilter.connect(chain.trebleFilter);
    chain.trebleFilter.connect(chain.masterGain);
    chain.masterGain.connect(ctx.destination);

    chain.vuGain.connect(chain.splitter);
    chain.splitter.connect(chain.analyserL, 0);
    chain.splitter.connect(chain.analyserR, 1);
    chain.analyserL.connect(chain.merger, 0, 0);
    chain.analyserR.connect(chain.merger, 0, 1);

    isInitializedRef.current = true;
    setIsReady(true);
  }, []);

  const disconnectNodeChain = useCallback(() => {
    try {
      splitterRef.current?.disconnect();
      analyserLRef.current?.disconnect();
      analyserRRef.current?.disconnect();
      mergerRef.current?.disconnect();
      eqFiltersRef.current.forEach(f => f.disconnect());
      Object.values(toneFiltersRef.current).forEach(f => f.disconnect());
      vuGainRef.current?.disconnect();
    } catch (e) {}
    isInitializedRef.current = false;
    isConnectedRef.current = false;
  }, []);

  const loadTrack = useCallback(async (url, autoplay = false) => {
    const ctx = Howler.ctx;
    if (!ctx) return null;
    
    await ensureContextRunning();
    if (!isInitializedRef.current) createNodeChain();

    if (howlRef.current) howlRef.current.unload();

    const howl = new Howl({
      src: [url],
      html5: false,
      volume: volumeRef.current,
      pool: 1,
      preload: true,
      onload: () => { setDuration(howl.duration()); if (autoplay) howl.play(); },
      onplay: () => { setIsPlaying(true); ensureContextRunning(); },
      onpause: () => setIsPlaying(false),
      onstop: () => { setIsPlaying(false); setCurrentTime(0); },
      onend: () => { setIsPlaying(false); setCurrentTime(0); },
      onseek: () => setCurrentTime(howl.seek()),
    });
    
    howlRef.current = howl;
    return howl;
  }, [ensureContextRunning, createNodeChain]);

  const play = useCallback(async () => {
    if (howlRef.current) { await ensureContextRunning(); howlRef.current.play(); }
  }, [ensureContextRunning]);

  const pause = useCallback(() => { howlRef.current?.pause(); }, []);
  const stop = useCallback(() => { howlRef.current?.stop(); setCurrentTime(0); setIsPlaying(false); }, []);
  
  const seek = useCallback((time) => {
    if (howlRef.current) { howlRef.current.seek(time); setCurrentTime(time); }
  }, []);

  const setVolume = useCallback((value) => {
    volumeRef.current = value;
    setVolumeState(value);
    if (masterGainRef.current && ctxRef.current) {
      masterGainRef.current.gain.setTargetAtTime(value, ctxRef.current.currentTime, 0.01);
    }
  }, []);

  const setEqBand = useCallback((frequency, value) => {
    const dbValue = Math.max(-12, Math.min(12, value));
    const filter = eqFiltersRef.current.find(f => f.frequency.value === frequency);
    if (filter && ctxRef.current) {
      filter.gain.setTargetAtTime(dbValue, ctxRef.current.currentTime, 0.01);
    }
    setEqBands(prev => ({ ...prev, [frequency]: dbValue }));
  }, []);

  const setTone = useCallback((tone, value) => {
    const dbValue = Math.max(-12, Math.min(12, value));
    const filter = toneFiltersRef.current[tone];
    if (filter && ctxRef.current) {
      filter.gain.setTargetAtTime(dbValue, ctxRef.current.currentTime, 0.01);
    }
    setToneSettings(prev => ({ ...prev, [tone]: dbValue }));
  }, []);

  const setVuSensitivity = useCallback((value) => {
    if (vuGainRef.current && ctxRef.current) {
      const gain = dbToLinear(value);
      vuGainRef.current.gain.setTargetAtTime(gain, ctxRef.current.currentTime, 0.01);
    }
  }, []);

  const dispose = useCallback(() => {
    if (howlRef.current) { howlRef.current.unload(); howlRef.current = null; }
    disconnectNodeChain();
    setIsPlaying(false); setCurrentTime(0); setDuration(0); setIsReady(false);
  }, [disconnectNodeChain]);

  return {
    isPlaying, currentTime, duration, volume, eqBands, toneSettings,
    isReady,
    analyserL: analyserLRef.current, analyserR: analyserRRef.current, vuGain: vuGainRef.current,
    loadTrack, play, pause, stop, seek, setVolume,
    setEqBand, setTone, setVuSensitivity,
    dispose, ensureContextRunning,
  };
}

export { ANSI };