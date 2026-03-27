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
  
  const requestRef = useRef(null);
  const isLoopRunningRef = useRef(false);
  const analyserRef = useRef(null);

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
  
  const volumeRef = useRef(0.8);
  const panRef = useRef(0);
  const loopModeRef = useRef('none');
  const shuffleRef = useRef(false);
  const preAmpRef = useRef(null);
  const eqFiltersRef = useRef([]);
  const masterGainRef = useRef(null);
  const isInitializedRef = useRef(false);

  const initAudioContext = useCallback(() => {
    if (isInitializedRef.current) return;

    Howler.autoSuspend = false;
    Howler.volume(0.8);

    const ctx = Howler.ctx;
    if (!ctx) return;

    if (ctx.state === 'closed') return;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    masterGainRef.current = ctx.createGain();
    masterGainRef.current.gain.value = 0.8;
    masterGainRef.current.connect(ctx.destination);

    preAmpRef.current = ctx.createGain();
    preAmpRef.current.gain.value = 1;

    eqFiltersRef.current = EQ_FREQUENCIES.map((freq, i) => {
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

    for (let i = 0; i < eqFiltersRef.current.length - 1; i++) {
      eqFiltersRef.current[i].connect(eqFiltersRef.current[i + 1]);
    }

    preAmpRef.current.connect(eqFiltersRef.current[0]);
    eqFiltersRef.current[eqFiltersRef.current.length - 1].connect(masterGainRef.current);

    isInitializedRef.current = true;
    setIsReady(true);
  }, []);

  const startLoop = useCallback(() => {
    if (isLoopRunningRef.current) return;
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    isLoopRunningRef.current = true;

    const ctx = Howler.ctx;
    if (!ctx || ctx.state === 'closed' || ctx.state === 'suspended') {
      return;
    }

    analyserRef.current = ctx.createAnalyser();
    analyserRef.current.fftSize = ANSI.FFT_SIZE;
    analyserRef.current.smoothingTimeConstant = ANSI.SMOOTHING;

    const freqData = new Uint8Array(analyserRef.current.frequencyBinCount);
    const timeData = new Float32Array(analyserRef.current.fftSize);

    if (masterGainRef.current) {
      masterGainRef.current.connect(analyserRef.current);
    }

    const loop = () => {
      if (!isLoopRunningRef.current) return;

      const currentCtx = Howler.ctx;
      if (!currentCtx || currentCtx.state === 'closed' || currentCtx.state === 'suspended') {
        isLoopRunningRef.current = false;
        return;
      }

      const analyser = analyserRef.current;
      if (!analyser) {
        isLoopRunningRef.current = false;
        return;
      }

      try {
        analyser.getFloatTimeDomainData(timeData);
        analyser.getByteFrequencyData(freqData);

        const combinedTime = new Float32Array(timeData.length);
        combinedTime.set(timeData);
        setTimeDomainData(combinedTime);

        const combinedFreq = new Uint8Array(freqData.length);
        combinedFreq.set(freqData);
        setAnalyserData(combinedFreq);
      } catch (e) {
        console.log('[Audio] Analyser error:', e.message);
      }

      if (isLoopRunningRef.current) {
        requestRef.current = requestAnimationFrame(loop);
      }
    };

    requestRef.current = requestAnimationFrame(loop);
  }, []);

  const stopLoop = useCallback(() => {
    isLoopRunningRef.current = false;
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch (e) {}
      analyserRef.current = null;
    }
  }, []);

  const loadTrack = useCallback(async (url, autoplay = true) => {
    if (howlRef.current) {
      howlRef.current.unload();
      howlRef.current = null;
    }

    initAudioContext();

    const ctx = Howler.ctx;
    if (ctx?.state === 'suspended') {
      await ctx.resume();
    }

    return new Promise((resolve, reject) => {
      const howl = new Howl({
        src: [url],
        html5: false,
        format: ['mp3'],
        xhr: { method: 'GET', withCredentials: false },
        volume: volumeRef.current,
        loop: loopModeRef.current === 'track',
        pool: 1,
        autoplay: false,
        preload: true,
        onplay: () => {
          setIsPlaying(true);
          startLoop();
        },
        onpause: () => {
          setIsPlaying(false);
          stopLoop();
        },
        onstop: () => {
          setIsPlaying(false);
          setCurrentTime(0);
          stopLoop();
        },
        onseek: () => {
          const pos = howl.seek();
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
  }, [initAudioContext, startLoop, stopLoop]);

  const play = useCallback(async () => {
    const ctx = Howler.ctx;
    if (ctx?.state === 'suspended') {
      await ctx.resume();
    }

    if (howlRef.current) {
      howlRef.current.play();
      setIsPlaying(true);
      startLoop();
    }
  }, [startLoop]);

  const pause = useCallback(() => {
    if (!howlRef.current) return;
    howlRef.current.pause();
    setIsPlaying(false);
    stopLoop();
  }, [stopLoop]);

  const stop = useCallback(() => {
    if (!howlRef.current) return;
    howlRef.current.stop();
    setIsPlaying(false);
    setCurrentTime(0);
    stopLoop();
  }, [stopLoop]);

  const seek = useCallback((time) => {
    if (!howlRef.current) return;
    const clampedTime = Math.max(0, Math.min(time, duration));
    howlRef.current.seek(clampedTime);
    setCurrentTime(clampedTime);
  }, [duration]);

  const setVolume = useCallback((value) => {
    const vol = Math.max(0, Math.min(1, value));
    volumeRef.current = vol;
    Howler.volume(vol);
    if (masterGainRef.current && Howler.ctx && Howler.ctx.state !== 'closed') {
      masterGainRef.current.gain.setTargetAtTime(vol, Howler.ctx.currentTime, 0.01);
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
    if (preAmpRef.current && Howler.ctx && Howler.ctx.state !== 'closed') {
      preAmpRef.current.gain.setTargetAtTime(gain, Howler.ctx.currentTime, 0.01);
    }
    setPreAmpState(dbValue);
  }, []);

  const setEqBand = useCallback((frequency, value) => {
    const dbValue = Math.max(-12, Math.min(12, value));
    const filter = eqFiltersRef.current.find(f => f.frequency.value === frequency);
    if (filter && Howler.ctx && Howler.ctx.state !== 'closed') {
      filter.gain.setTargetAtTime(dbValue, Howler.ctx.currentTime, 0.01);
    }
    setEqBands(prev => ({ ...prev, [frequency]: dbValue }));
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
    setShuffleState(prev => !prev);
    shuffleRef.current = !shuffleRef.current;
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
    stopLoop();
    if (howlRef.current) {
      howlRef.current.unload();
      howlRef.current = null;
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsReady(false);
    isInitializedRef.current = false;
  }, [stopLoop]);

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

    const leftData = timeData;
    const rightData = timeData;

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
    loopMode, shuffle, isReady, analyserData, timeDomainData,
    eqFrequencies: EQ_FREQUENCIES, vuMeterData,
    loadTrack, play, pause, stop, seek, setVolume, setPan, setPreAmp,
    setEqBand, toggleLoop, toggleShuffle, getNextTrack, getPrevTrack,
    dispose, initAudioContext,
  };
}

export { ANSI, dbToLinear, linearToDb, calculateRMS, calculatePeak };
