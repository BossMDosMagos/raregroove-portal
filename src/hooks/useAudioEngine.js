import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Howl, Howler } from 'howler';

const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

const ANSI = {
  ZERO_VU_DB: -18,
  PEAK_THRESHOLD_DB: -0.5,
  RISE_TIME_MS: 300,
  PEAK_HOLD_MS: 500,
  OVERSHOOT: 0.015,
  FFT_SIZE: 2048,
  SMOOTHING: 0.85,
  MIN_DB: -60,
  MAX_DB: 3,
  ARC_START_DEG: -55,
  ARC_RANGE_DEG: 110,
};

function dbToLinear(db) {
  return Math.pow(10, db / 20);
}

function linearToDb(linear) {
  if (linear <= 0) return -Infinity;
  return 20 * Math.log10(linear);
}

function calculateRMS(data) {
  if (!data || data.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = (data[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / data.length);
}

function calculatePeak(data) {
  if (!data || data.length === 0) return 0;
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const abs = Math.abs((data[i] - 128) / 128);
    if (abs > peak) peak = abs;
  }
  return peak;
}

function rmsToPos(rms) {
  if (rms < 0.0001) return 0;
  const db = 20 * Math.log10(rms);
  const MIN = -60;
  return Math.max(0, Math.min(1, (db - MIN) / (0 - MIN)));
}

export function useAudioEngine() {
  const howlRef = useRef(null);
  const animFrameRef = useRef(null);
  const isPlayingRef = useRef(false);
  
  const ctxRef = useRef(null);
  const sourceRef = useRef(null);
  
  const eqFiltersRef = useRef([]);
  const toneFiltersRef = useRef({});
  const masterGainRef = useRef(null);
  const vuGainRef = useRef(null);
  const analyserLRef = useRef(null);
  const analyserRRef = useRef(null);
  const splitterRef = useRef(null);
  const mergerRef = useRef(null);
  const dataLRef = useRef(null);
  const dataRRef = useRef(null);
  const isConnectedRef = useRef(false);
  const isInitializedRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [pan, setPanState] = useState(0);
  const [preAmp, setPreAmpState] = useState(0);
  const [eqBands, setEqBands] = useState(() => 
    Object.fromEntries(EQ_FREQUENCIES.map(f => [f, 0]))
  );
  const [toneSettings, setToneSettings] = useState({ bass: 0, mid: 0, treble: 0 });
  const [loopMode, setLoopModeState] = useState('none');
  const [shuffle, setShuffleState] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [analyserData, setAnalyserData] = useState(new Uint8Array(128));
  const [timeDomainData, setTimeDomainData] = useState(new Float32Array(256));
  const [spectrumL, setSpectrumL] = useState(new Uint8Array(64));
  const [spectrumR, setSpectrumR] = useState(new Uint8Array(64));
  const [timeDomainBytesL, setTimeDomainBytesL] = useState(new Uint8Array(512));
  const [timeDomainBytesR, setTimeDomainBytesR] = useState(new Uint8Array(512));
  const [bassDataL, setBassDataL] = useState(new Uint8Array(8));
  const [bassDataR, setBassDataR] = useState(new Uint8Array(8));
  
  const volumeRef = useRef(0.8);
  const panRef = useRef(0);
  const loopModeRef = useRef('none');
  const shuffleRef = useRef(false);
  const preAmpRef = useRef(null);
  const eqBandsRef = useRef(Object.fromEntries(EQ_FREQUENCIES.map(f => [f, 0])));
  const toneSettingsRef = useRef({ bass: 0, mid: 0, treble: 0 });

  const ensureContextRunning = useCallback(async () => {
    const ctx = Howler.ctx;
    if (!ctx) return false;
    if (ctx.state === 'closed') return false;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (e) {
        return false;
      }
    }
    return true;
  }, []);

  const createNodeChain = useCallback(() => {
    const ctx = Howler.ctx;
    if (!ctx || isInitializedRef.current) return;

    ctxRef.current = ctx;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const chain = {};

    chain.input = ctx.createGain();
    chain.input.gain.value = 1;

    chain.eqFilters = EQ_FREQUENCIES.map((freq, i) => {
      const filter = ctx.createBiquadFilter();
      if (i === 0) {
        filter.type = 'lowshelf';
      } else if (i === EQ_FREQUENCIES.length - 1) {
        filter.type = 'highshelf';
      } else {
        filter.type = 'peaking';
      }
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

    toneFiltersRef.current = {
      bass: chain.bassFilter,
      mid: chain.midFilter,
      treble: chain.trebleFilter,
    };

    chain.vuGain = ctx.createGain();
    chain.vuGain.gain.value = 1;
    vuGainRef.current = chain.vuGain;

    chain.splitter = ctx.createChannelSplitter(2);
    splitterRef.current = chain.splitter;

    chain.analyserL = ctx.createAnalyser();
    chain.analyserL.fftSize = ANSI.FFT_SIZE;
    chain.analyserL.smoothingTimeConstant = ANSI.SMOOTHING;
    analyserLRef.current = chain.analyserL;
    dataLRef.current = new Uint8Array(chain.analyserL.frequencyBinCount);

    chain.analyserR = ctx.createAnalyser();
    chain.analyserR.fftSize = ANSI.FFT_SIZE;
    chain.analyserR.smoothingTimeConstant = ANSI.SMOOTHING;
    analyserRRef.current = chain.analyserR;
    dataRRef.current = new Uint8Array(chain.analyserR.frequencyBinCount);

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
      if (splitterRef.current) {
        splitterRef.current.disconnect();
      }
      if (analyserLRef.current) {
        analyserLRef.current.disconnect();
      }
      if (analyserRRef.current) {
        analyserRRef.current.disconnect();
      }
      if (mergerRef.current) {
        mergerRef.current.disconnect();
      }
      eqFiltersRef.current.forEach(f => f.disconnect());
      Object.values(toneFiltersRef.current).forEach(f => f.disconnect());
      if (vuGainRef.current) {
        vuGainRef.current.disconnect();
      }
    } catch (e) {}
    isInitializedRef.current = false;
    isConnectedRef.current = false;
  }, []);

  const stopAnimLoop = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  const animLoop = useCallback(() => {
    stopAnimLoop();

    const ctx = Howler.ctx;
    const ctxOk = ctx && ctx.state === 'running' && analyserLRef.current && analyserRRef.current;

    if (ctxOk) {
      try {
        const dataL = dataLRef.current;
        const dataR = dataRRef.current;
        
        analyserLRef.current.getByteTimeDomainData(dataL);
        analyserRRef.current.getByteTimeDomainData(dataR);

        const rmsL = calculateRMS(dataL);
        const rmsR = calculateRMS(dataR);

        const combinedTime = new Float32Array(dataL.length + dataR.length);
        combinedTime.set(dataL, 0);
        combinedTime.set(dataR, dataL.length);
        setTimeDomainData(combinedTime);

        const timeBytesL = new Uint8Array(dataL.length);
        const timeBytesR = new Uint8Array(dataR.length);
        for (let i = 0; i < dataL.length; i++) {
          timeBytesL[i] = dataL[i];
          timeBytesR[i] = dataR[i];
        }
        setTimeDomainBytesL(timeBytesL);
        setTimeDomainBytesR(timeBytesR);

        const freqL = new Uint8Array(analyserLRef.current.frequencyBinCount);
        const freqR = new Uint8Array(analyserRRef.current.frequencyBinCount);
        analyserLRef.current.getByteFrequencyData(freqL);
        analyserRRef.current.getByteFrequencyData(freqR);

        const combinedFreq = new Uint8Array(freqL.length);
        for (let i = 0; i < combinedFreq.length; i++) {
          combinedFreq[i] = Math.max(freqL[i], freqR[i]);
        }
        setAnalyserData(combinedFreq);
        
        const reducedL = new Uint8Array(64);
        const reducedR = new Uint8Array(64);
        const stepL = Math.floor(freqL.length / 64);
        const stepR = Math.floor(freqR.length / 64);
        for (let i = 0; i < 64; i++) {
          reducedL[i] = freqL[i * stepL] || 0;
          reducedR[i] = freqR[i * stepR] || 0;
        }
        setSpectrumL(reducedL);
        setSpectrumR(reducedR);
        
        const bassL = new Uint8Array(8);
        const bassR = new Uint8Array(8);
        for (let i = 0; i < 8; i++) {
          bassL[i] = freqL[i] || 0;
          bassR[i] = freqR[i] || 0;
        }
        setBassDataL(bassL);
        setBassDataR(bassR);
      } catch (e) {}
    }

    if (isPlayingRef.current) {
      animFrameRef.current = requestAnimationFrame(animLoop);
    }
  }, [stopAnimLoop]);

  const loadTrack = useCallback(async (url, autoplay = true) => {
    if (howlRef.current) {
      howlRef.current.unload();
      howlRef.current = null;
    }

    Howler.autoSuspend = false;
    createNodeChain();

    const ctx = Howler.ctx;
    if (ctx?.state === 'suspended') {
      await ctx.resume();
    }

    return new Promise((resolve, reject) => {
      const howl = new Howl({
        src: [url],
        html5: false,
        volume: volumeRef.current,
        loop: loopModeRef.current === 'track',
        pool: 1,
        autoplay: false,
        preload: true,
        onload: () => {
          const dur = howl.duration();
          setDuration(dur);
          
          if (autoplay) {
            howl.play();
          }
          resolve(howl);
        },
        onplay: () => {
          setIsPlaying(true);
          isPlayingRef.current = true;
          
          ensureContextRunning();
          stopAnimLoop();
          animFrameRef.current = requestAnimationFrame(animLoop);
        },
        onpause: () => {
          setIsPlaying(false);
          isPlayingRef.current = false;
          stopAnimLoop();
        },
        onstop: () => {
          setIsPlaying(false);
          isPlayingRef.current = false;
          setCurrentTime(0);
          stopAnimLoop();
        },
        onseek: (id) => {
          const pos = howl.seek(id);
          if (typeof pos === 'number') {
            setCurrentTime(pos);
          }
        },
        onloaderror: (id, err) => {
          reject(new Error('Failed to load audio: ' + err));
        },
        onplayerror: (id, err) => {
          reject(new Error('Playback error: ' + err));
        },
      });

      howlRef.current = howl;
      setCurrentTime(0);
      setDuration(0);
    });
  }, [createNodeChain, ensureContextRunning, stopAnimLoop, animLoop]);

  const play = useCallback(async () => {
    const ctx = Howler.ctx;
    if (ctx?.state === 'suspended') {
      await ctx.resume();
    }
    if (howlRef.current) {
      howlRef.current.play();
      setIsPlaying(true);
      isPlayingRef.current = true;
      startAnimLoop();
    }
  }, []);

  const pause = useCallback(() => {
    if (!howlRef.current) return;
    howlRef.current.pause();
    setIsPlaying(false);
    isPlayingRef.current = false;
    stopAnimLoop();
  }, [stopAnimLoop]);

  const stop = useCallback(() => {
    if (!howlRef.current) return;
    howlRef.current.stop();
    setIsPlaying(false);
    isPlayingRef.current = false;
    setCurrentTime(0);
    stopAnimLoop();
  }, [stopAnimLoop]);

  const seek = useCallback((time) => {
    if (!howlRef.current) return;
    const clampedTime = Math.max(0, Math.min(time, duration));
    howlRef.current.seek(clampedTime);
    setCurrentTime(clampedTime);
  }, [duration]);

  const setVolume = useCallback((value) => {
    const vol = Math.max(0, Math.min(1, value));
    volumeRef.current = vol;
    if (masterGainRef.current) {
      masterGainRef.current.gain.setTargetAtTime(vol, ctxRef.current?.currentTime || 0, 0.01);
    }
    Howler.volume(vol);
    if (howlRef.current) {
      howlRef.current.volume(vol);
    }
    setVolumeState(vol);
  }, []);

  const setPan = useCallback((value) => {
    panRef.current = Math.max(-1, Math.min(1, value));
    setPanState(panRef.current);
  }, []);

  const setPreAmp = useCallback((value) => {
    const dbValue = Math.max(-12, Math.min(12, value));
    preAmpRef.current = dbValue;
    setPreAmpState(dbValue);
  }, []);

  const setEqBand = useCallback((frequency, value) => {
    const dbValue = Math.max(-12, Math.min(12, value));
    eqBandsRef.current[frequency] = dbValue;
    const filter = eqFiltersRef.current.find(f => f.frequency.value === frequency);
    if (filter && ctxRef.current) {
      filter.gain.setTargetAtTime(dbValue, ctxRef.current.currentTime, 0.01);
    }
    setEqBands(prev => ({ ...prev, [frequency]: dbValue }));
  }, []);

  const setTone = useCallback((tone, value) => {
    const dbValue = Math.max(-12, Math.min(12, value));
    toneSettingsRef.current[tone] = dbValue;
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

  const toggleLoop = useCallback(() => {
    setLoopModeState(prev => {
      const next = prev === 'none' ? 'track' : prev === 'track' ? 'playlist' : 'none';
      loopModeRef.current = next;
      if (howlRef.current) {
        howlRef.current.loop(next === 'track');
      }
      return next;
    });
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffleState(prev => {
      shuffleRef.current = !prev;
      return !prev;
    });
  }, []);

  const getNextTrack = useCallback((queue, currentIndex) => {
    if (queue.length === 0) return null;
    if (shuffleRef.current) {
      let nextIndex;
      do {
        nextIndex = Math.floor(Math.random() * queue.length);
      } while (nextIndex === currentIndex && queue.length > 1);
      return { track: queue[nextIndex], index: nextIndex };
    }
    const nextIndex = currentIndex + 1;
    if (loopModeRef.current === 'playlist' || nextIndex < queue.length) {
      return { track: queue[nextIndex % queue.length], index: nextIndex % queue.length };
    }
    return null;
  }, []);

  const getPrevTrack = useCallback((queue, currentIndex) => {
    if (queue.length === 0) return null;
    if (shuffleRef.current) {
      let prevIndex;
      do {
        prevIndex = Math.floor(Math.random() * queue.length);
      } while (prevIndex === currentIndex && queue.length > 1);
      return { track: queue[prevIndex], index: prevIndex };
    }
    const prevIndex = currentIndex - 1;
    if (loopModeRef.current === 'playlist' || prevIndex >= 0) {
      return { track: queue[(prevIndex + queue.length) % queue.length], index: (prevIndex + queue.length) % queue.length };
    }
    return null;
  }, []);

  const dispose = useCallback(() => {
    stopAnimLoop();
    disconnectNodeChain();
    if (howlRef.current) {
      howlRef.current.unload();
      howlRef.current = null;
    }
    setIsPlaying(false);
    isPlayingRef.current = false;
    setCurrentTime(0);
    setDuration(0);
    setIsReady(false);
  }, [stopAnimLoop, disconnectNodeChain]);

  const startAnimLoop = useCallback(() => {
    stopAnimLoop();
    const ctx = Howler.ctx;
    if (!ctx || ctx.state !== 'running') return;
    
    animFrameRef.current = requestAnimationFrame(animLoop);
  }, [stopAnimLoop, animLoop]);

  useEffect(() => {
    return () => {
      dispose();
    };
  }, [dispose]);

  useEffect(() => {
    if (!howlRef.current) return;
    const interval = setInterval(() => {
      if (howlRef.current && howlRef.current.playing()) {
        const pos = howlRef.current.seek();
        if (typeof pos === 'number') {
          setCurrentTime(pos);
        }
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const vuMeterData = useMemo(() => {
    const timeData = timeDomainData;
    if (!timeData || timeData.length === 0) {
      return { 
        leftRMS: 0, rightRMS: 0, leftPeak: 0, rightPeak: 0,
        leftRMSDb: -60, rightRMSDb: -60, leftPeakDb: -60, rightPeakDb: -60 
      };
    }

    const halfLen = Math.floor(timeData.length / 2);
    const leftData = timeData.slice(0, halfLen);
    const rightData = timeData.slice(halfLen);

    const leftRMS = calculateRMS(leftData);
    const rightRMS = calculateRMS(rightData);
    const leftPeak = calculatePeak(leftData);
    const rightPeak = calculatePeak(rightData);

    const leftRMSDb = linearToDb(leftRMS);
    const rightRMSDb = linearToDb(rightRMS);
    const leftPeakDb = linearToDb(leftPeak);
    const rightPeakDb = linearToDb(rightPeak);

    return {
      leftRMS, rightRMS, leftPeak, rightPeak,
      leftRMSDb, rightRMSDb, leftPeakDb, rightPeakDb,
    };
  }, [timeDomainData]);

  return {
    isPlaying, currentTime, duration, volume, pan, preAmp, eqBands,
    toneSettings, loopMode, shuffle, isReady, analyserData, timeDomainData,
    spectrumL, spectrumR, timeDomainBytesL, timeDomainBytesR,
    bassDataL, bassDataR,
    eqFrequencies: EQ_FREQUENCIES, vuMeterData,
    analyserL: analyserLRef.current, analyserR: analyserRRef.current, vuGain: vuGainRef.current,
    loadTrack, play, pause, stop, seek, setVolume, setPan, setPreAmp,
    setEqBand, setTone, setVuSensitivity, toggleLoop, toggleShuffle,
    getNextTrack, getPrevTrack, dispose,
    ensureContextRunning: ensureContextRunning,
  };
}

export { ANSI, dbToLinear, linearToDb, calculateRMS, calculatePeak };