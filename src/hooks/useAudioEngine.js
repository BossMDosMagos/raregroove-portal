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
  SMOOTHING: 0.8,
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

function rmsToVu(rmsDb) {
  return rmsDb - ANSI.ZERO_VU_DB;
}

function vuToAngle(vu) {
  const minVu = ANSI.MIN_DB - ANSI.ZERO_VU_DB;
  const maxVu = ANSI.MAX_DB - ANSI.ZERO_VU_DB;
  const normalized = (vu - minVu) / (maxVu - minVu);
  return ANSI.ARC_START_DEG + normalized * ANSI.ARC_RANGE_DEG;
}

function calculateRMS(data) {
  if (!data || data.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i] * data[i];
  }
  return Math.sqrt(sum / data.length);
}

function calculatePeak(data) {
  if (!data || data.length === 0) return 0;
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const abs = Math.abs(data[i]);
    if (abs > peak) peak = abs;
  }
  return peak;
}

export function useAudioEngine() {
  const howlRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const timeDomainBufferRef = useRef(null);
  const eqFiltersRef = useRef([]);
  const preAmpRef = useRef(null);
  const volumeRef = useRef(0.8);
  const isPlayingRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [pan, setPanState] = useState(0);
  const [preAmp, setPreAmpState] = useState(0);
  const [eqBands, setEqBands] = useState(() => 
    Object.fromEntries(EQ_FREQUENCIES.map(f => [f, 0]))
  );
  const [loopMode, setLoopModeState] = useState('none');
  const [shuffle, setShuffleState] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [analyserData, setAnalyserData] = useState(new Uint8Array(128));
  const [timeDomainData, setTimeDomainData] = useState(new Float32Array(256));
  const panRef = useRef(0);
  const queueRef = useRef([]);
  const preAmpRefState = useRef(0);
  const eqBandsRef = useRef(Object.fromEntries(EQ_FREQUENCIES.map(f => [f, 0])));

  const initAudioContext = useCallback(() => {
    if (audioContextRef.current) return audioContextRef.current;

    let ctx = Howler.ctx;
    if (!ctx) {
      Howler.volume(0.8);
      ctx = Howler.ctx;
    }
    if (!ctx) {
      throw new Error('Howler audio context not initialized');
    }

    console.log('AudioContext initialized, state:', ctx.state);
    audioContextRef.current = ctx;

    const preAmp = ctx.createGain();
    preAmp.gain.value = 1;
    preAmpRef.current = preAmp;

    const eqFilters = EQ_FREQUENCIES.map((freq, i) => {
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
    eqFiltersRef.current = eqFilters;

    for (let i = 0; i < eqFilters.length - 1; i++) {
      eqFilters[i].connect(eqFilters[i + 1]);
    }

    const analyser = ctx.createAnalyser();
    analyser.fftSize = ANSI.FFT_SIZE;
    analyser.smoothingTimeConstant = ANSI.SMOOTHING;
    analyserRef.current = analyser;

    timeDomainBufferRef.current = new Float32Array(analyser.fftSize);

    const masterGain = Howler.masterGain || ctx.createGain();
    masterGain.gain.value = Howler.volume();

    preAmp.connect(eqFilters[0]);
    eqFilters[eqFilters.length - 1].connect(masterGain);
    masterGain.connect(ctx.destination);
    masterGain.connect(analyser);

    setIsReady(true);
    return ctx;
  }, []);

  useEffect(() => {
    let loopId;
    const loop = () => {
      const analyser = analyserRef.current;
      const ctx = Howler.ctx;

      if (!ctx || ctx.state === 'closed') {
        console.log('VU Loop stopping - ctx closed');
        loopId = requestAnimationFrame(loop);
        return;
      }

      console.log('VU Loop running, ctx state:', ctx.state);

      if (analyser && ctx) {
        const freqData = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(freqData);
        setAnalyserData(new Uint8Array(freqData));

        const timeData = timeDomainBufferRef.current;
        analyser.getFloatTimeDomainData(timeData);
        
        const rms = Math.sqrt(timeData.reduce((sum, val) => sum + val * val, 0) / timeData.length);
        const rmsDb = 20 * Math.log10(rms || 0.0001);
        console.log('RMS:', rms.toFixed(4), 'dB:', rmsDb.toFixed(1));

        setTimeDomainData(new Float32Array(timeData));
      }

      loopId = requestAnimationFrame(loop);
    };

    loopId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(loopId);
    };
  }, []);

  const loadTrack = useCallback(async (url, autoplay = true) => {
    if (howlRef.current) {
      howlRef.current.unload();
      howlRef.current = null;
    }

    const ctx = initAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    return new Promise((resolve, reject) => {
      const howl = new Howl({
        src: [url],
        html5: false,
        volume: volumeRef.current,
        loop: loopMode === 'track',
        pool: 5,
        autoplay: false,
        preload: true,
        onplay: () => {
          setIsPlaying(true);
          isPlayingRef.current = true;
        },
        onpause: () => {
          setIsPlaying(false);
          isPlayingRef.current = false;
        },
        onstop: () => {
          setIsPlaying(false);
          isPlayingRef.current = false;
          setCurrentTime(0);
        },
        onseek: (id) => {
          const pos = howl.seek(id);
          if (typeof pos === 'number') {
            setCurrentTime(pos);
          }
        },
        onload: () => {
          const dur = howl.duration();
          setDuration(dur);
          if (autoplay) {
            howl.play();
          }
          resolve(howl);
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
  }, [loopMode, initAudioContext]);

  const play = useCallback(async () => {
    if (!howlRef.current) return;

    const ctx = Howler.ctx;
    if (ctx?.state === 'suspended') {
      await ctx.resume();
    }
    console.log('Play called, ctx state:', ctx?.state);

    howlRef.current.play();
    setIsPlaying(true);
    isPlayingRef.current = true;
  }, []);

  const pause = useCallback(() => {
    if (!howlRef.current) return;
    howlRef.current.pause();
    setIsPlaying(false);
    isPlayingRef.current = false;
  }, []);

  const stop = useCallback(() => {
    if (!howlRef.current) return;
    howlRef.current.stop();
    setIsPlaying(false);
    isPlayingRef.current = false;
    setCurrentTime(0);
  }, []);

  const seek = useCallback((time) => {
    if (!howlRef.current) return;
    const clampedTime = Math.max(0, Math.min(time, duration));
    howlRef.current.seek(clampedTime);
    setCurrentTime(clampedTime);
  }, [duration]);

  const setVolume = useCallback((value) => {
    const vol = Math.max(0, Math.min(1, value));
    volumeRef.current = vol;
    if (Howler.masterGain) {
      Howler.masterGain.gain.setTargetAtTime(vol, audioContextRef.current?.currentTime || 0, 0.01);
    }
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
    const gain = dbToLinear(dbValue);
    preAmpRefState.current = dbValue;
    if (preAmpRef.current) {
      preAmpRef.current.gain.setTargetAtTime(gain, audioContextRef.current?.currentTime || 0, 0.01);
    }
    setPreAmpState(dbValue);
  }, []);

  const setEqBand = useCallback((frequency, value) => {
    const dbValue = Math.max(-12, Math.min(12, value));
    eqBandsRef.current[frequency] = dbValue;
    const filter = eqFiltersRef.current.find(f => f.frequency.value === frequency);
    if (filter && audioContextRef.current) {
      filter.gain.setTargetAtTime(dbValue, audioContextRef.current.currentTime, 0.01);
    }
    setEqBands(prev => ({ ...prev, [frequency]: dbValue }));
  }, []);

  const toggleLoop = useCallback(() => {
    setLoopModeState(prev => {
      const next = prev === 'none' ? 'track' : prev === 'track' ? 'playlist' : 'none';
      if (howlRef.current) {
        howlRef.current.loop(next === 'track');
      }
      return next;
    });
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffleState(prev => !prev);
  }, []);

  const getNextTrack = useCallback((queue, currentIndex) => {
    if (queue.length === 0) return null;

    if (shuffle) {
      let nextIndex;
      do {
        nextIndex = Math.floor(Math.random() * queue.length);
      } while (nextIndex === currentIndex && queue.length > 1);
      return { track: queue[nextIndex], index: nextIndex };
    }

    const nextIndex = currentIndex + 1;
    if (loopMode === 'playlist' || nextIndex < queue.length) {
      return {
        track: queue[nextIndex % queue.length],
        index: nextIndex % queue.length
      };
    }

    return null;
  }, [shuffle, loopMode]);

  const getPrevTrack = useCallback((queue, currentIndex) => {
    if (queue.length === 0) return null;

    if (shuffle) {
      let prevIndex;
      do {
        prevIndex = Math.floor(Math.random() * queue.length);
      } while (prevIndex === currentIndex && queue.length > 1);
      return { track: queue[prevIndex], index: prevIndex };
    }

    const prevIndex = currentIndex - 1;
    if (loopMode === 'playlist' || prevIndex >= 0) {
      return {
        track: queue[(prevIndex + queue.length) % queue.length],
        index: (prevIndex + queue.length) % queue.length
      };
    }

    return null;
  }, [shuffle, loopMode]);

  const dispose = useCallback(() => {
    if (howlRef.current) {
      howlRef.current.unload();
      howlRef.current = null;
    }

    setIsPlaying(false);
    isPlayingRef.current = false;
    setCurrentTime(0);
    setDuration(0);
    setIsReady(false);
  }, []);

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
    const data = timeDomainData;
    if (!data || data.length === 0) {
      return { leftRMS: 0, rightRMS: 0, leftPeak: 0, rightPeak: 0, leftRMSDb: -60, rightRMSDb: -60, leftPeakDb: -60, rightPeakDb: -60 };
    }

    const halfLen = Math.floor(data.length / 2);
    const leftData = data.slice(0, halfLen);
    const rightData = data.slice(halfLen);

    const leftRMS = calculateRMS(leftData);
    const rightRMS = calculateRMS(rightData);
    const leftPeak = calculatePeak(leftData);
    const rightPeak = calculatePeak(rightData);

    const leftRMSDb = linearToDb(leftRMS);
    const rightRMSDb = linearToDb(rightRMS);
    const leftPeakDb = linearToDb(leftPeak);
    const rightPeakDb = linearToDb(rightPeak);

    return {
      leftRMS,
      rightRMS,
      leftPeak,
      rightPeak,
      leftRMSDb,
      rightRMSDb,
      leftPeakDb,
      rightPeakDb,
    };
  }, [timeDomainData]);

  return {
    isPlaying,
    currentTime,
    duration,
    volume,
    pan,
    preAmp,
    eqBands,
    loopMode,
    shuffle,
    isReady,
    analyserData,
    timeDomainData,
    eqFrequencies: EQ_FREQUENCIES,
    vuMeterData,
    loadTrack,
    play,
    pause,
    stop,
    seek,
    setVolume,
    setPan,
    setPreAmp,
    setEqBand,
    toggleLoop,
    toggleShuffle,
    getNextTrack,
    getPrevTrack,
    dispose,
    initAudioContext,
  };
}

export { ANSI, dbToLinear, linearToDb, rmsToVu, vuToAngle, calculateRMS, calculatePeak };
