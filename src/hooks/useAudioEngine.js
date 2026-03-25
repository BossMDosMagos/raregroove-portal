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
  const eqFiltersRef = useRef([]);
  const preAmpRef = useRef(null);
  const volumeRef = useRef(0.8);
  const isPlayingRef = useRef(false);
  
  const splitterRef = useRef(null);
  const analyserLeftRef = useRef(null);
  const analyserRightRef = useRef(null);
  const masterGainRef = useRef(null);
  const timeDomainLeftRef = useRef(null);
  const timeDomainRightRef = useRef(null);

  const requestRef = useRef(null);
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
  const [loopMode, setLoopModeState] = useState('none');
  const [shuffle, setShuffleState] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [analyserData, setAnalyserData] = useState(new Uint8Array(128));
  const [timeDomainData, setTimeDomainData] = useState(new Float32Array(256));
  
  const panRef = useRef(0);
  const preAmpRefState = useRef(0);
  const eqBandsRef = useRef(Object.fromEntries(EQ_FREQUENCIES.map(f => [f, 0])));

  const startAnimationLoop = useCallback(() => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }

    const loop = () => {
      const ctx = Howler.ctx;
      if (!ctx) {
        requestRef.current = requestAnimationFrame(loop);
        return;
      }

      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
        requestRef.current = requestAnimationFrame(loop);
        return;
      }

      if (ctx.state !== 'running') {
        requestRef.current = requestAnimationFrame(loop);
        return;
      }

      const analyserL = analyserLeftRef.current;
      const analyserR = analyserRightRef.current;

      if (!analyserL || !analyserR) {
        requestRef.current = requestAnimationFrame(loop);
        return;
      }

      const timeL = timeDomainLeftRef.current;
      const timeR = timeDomainRightRef.current;

      if (timeL && timeR) {
        analyserL.getFloatTimeDomainData(timeL);
        analyserR.getFloatTimeDomainData(timeR);

        const combinedTime = new Float32Array(timeL.length + timeR.length);
        combinedTime.set(timeL, 0);
        combinedTime.set(timeR, timeL.length);
        setTimeDomainData(combinedTime);

        const freqL = new Uint8Array(analyserL.frequencyBinCount);
        const freqR = new Uint8Array(analyserR.frequencyBinCount);
        analyserL.getByteFrequencyData(freqL);
        analyserR.getByteFrequencyData(freqR);

        const combinedFreq = new Uint8Array(freqL.length);
        for (let i = 0; i < combinedFreq.length; i++) {
          combinedFreq[i] = Math.max(freqL[i], freqR[i]);
        }
        setAnalyserData(combinedFreq);
      }

      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);
  }, []);

  const stopAnimationLoop = useCallback(() => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
  }, []);

  const initAudioContext = useCallback(() => {
    if (isInitializedRef.current && audioContextRef.current) return audioContextRef.current;

    Howler.autoSuspend = false;
    let ctx = Howler.ctx;
    if (!ctx) {
      Howler.volume(0.8);
      ctx = Howler.ctx;
    }
    if (!ctx) {
      return null;
    }

    audioContextRef.current = ctx;

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const splitter = ctx.createChannelSplitter(2);
    splitterRef.current = splitter;

    const analyserL = ctx.createAnalyser();
    analyserL.fftSize = ANSI.FFT_SIZE;
    analyserL.smoothingTimeConstant = ANSI.SMOOTHING;
    analyserLeftRef.current = analyserL;

    const analyserR = ctx.createAnalyser();
    analyserR.fftSize = ANSI.FFT_SIZE;
    analyserR.smoothingTimeConstant = ANSI.SMOOTHING;
    analyserRightRef.current = analyserR;

    timeDomainLeftRef.current = new Float32Array(analyserL.fftSize);
    timeDomainRightRef.current = new Float32Array(analyserR.fftSize);

    splitter.connect(analyserL, 0);
    splitter.connect(analyserR, 1);

    const masterGain = ctx.createGain();
    masterGain.gain.value = Howler.volume();
    masterGainRef.current = masterGain;

    masterGain.connect(ctx.destination);
    masterGain.connect(splitter);

    const preAmp = ctx.createGain();
    preAmp.gain.value = 1;
    preAmpRef.current = preAmp;

    if (Howler.masterGain && !Howler.masterGain._connectedToSplitter) {
      Howler.masterGain.disconnect();
      Howler.masterGain.connect(preAmp);
      Howler.masterGain._connectedToSplitter = true;
    }

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

    preAmp.connect(eqFilters[0]);
    eqFilters[eqFilters.length - 1].connect(masterGain);

    isInitializedRef.current = true;
    setIsReady(true);
    return ctx;
  }, []);

  const loadTrack = useCallback(async (url, autoplay = true) => {
    if (howlRef.current) {
      howlRef.current.unload();
      howlRef.current = null;
    }

    Howler.autoSuspend = false;
    const ctx = initAudioContext();
    if (!ctx) return Promise.reject(new Error('Audio context not ready'));

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    return new Promise((resolve, reject) => {
      const howl = new Howl({
        src: [url],
        html5: false,
        xhr: { withCredentials: false },
        volume: volumeRef.current,
        loop: loopMode === 'track',
        pool: 1,
        autoplay: false,
        preload: true,
        onplay: async () => {
          setIsPlaying(true);
          isPlayingRef.current = true;
          
          const ctx = Howler.ctx;
          if (ctx?.state === 'suspended') {
            try {
              await ctx.resume();
            } catch {
              // ignore resume failures; loop will retry
            }
          }

          if (Howler.masterGain && !Howler.masterGain._connectedToSplitter) {
            const masterGain = masterGainRef.current;
            if (masterGain) {
              Howler.masterGain.disconnect();
              Howler.masterGain.connect(masterGain);
              Howler.masterGain._connectedToSplitter = true;
            }
          }

          startAnimationLoop();
        },
        onpause: () => {
          setIsPlaying(false);
          isPlayingRef.current = false;
          stopAnimationLoop();
        },
        onstop: () => {
          setIsPlaying(false);
          isPlayingRef.current = false;
          setCurrentTime(0);
          stopAnimationLoop();
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
  }, [loopMode, initAudioContext, startAnimationLoop, stopAnimationLoop]);

  const play = useCallback(async () => {
    const ctx = Howler.ctx;
    if (ctx?.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // ignore resume failures; startAnimationLoop treats suspended state
      }
    }

    if (Howler.masterGain && !Howler.masterGain._connectedToSplitter) {
      const masterGain = masterGainRef.current;
      if (masterGain) {
        Howler.masterGain.disconnect();
        Howler.masterGain.connect(masterGain);
        Howler.masterGain._connectedToSplitter = true;
      }
    }

    if (howlRef.current) {
      howlRef.current.play();
      setIsPlaying(true);
      isPlayingRef.current = true;
      startAnimationLoop();
    }
  }, [startAnimationLoop]);

  const pause = useCallback(() => {
    if (!howlRef.current) return;
    howlRef.current.pause();
    setIsPlaying(false);
    isPlayingRef.current = false;
    stopAnimationLoop();
  }, [stopAnimationLoop]);

  const stop = useCallback(() => {
    if (!howlRef.current) return;
    howlRef.current.stop();
    setIsPlaying(false);
    isPlayingRef.current = false;
    setCurrentTime(0);
    stopAnimationLoop();
  }, [stopAnimationLoop]);

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
      masterGainRef.current.gain.setTargetAtTime(vol, audioContextRef.current?.currentTime || 0, 0.01);
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
      return { track: queue[nextIndex % queue.length], index: nextIndex % queue.length };
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
      return { track: queue[(prevIndex + queue.length) % queue.length], index: (prevIndex + queue.length) % queue.length };
    }
    return null;
  }, [shuffle, loopMode]);

  const dispose = useCallback(() => {
    stopAnimationLoop();
    if (howlRef.current) {
      howlRef.current.unload();
      howlRef.current = null;
    }
    setIsPlaying(false);
    isPlayingRef.current = false;
    setCurrentTime(0);
    setDuration(0);
    setIsReady(false);
  }, [stopAnimationLoop]);

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
    loopMode, shuffle, isReady, analyserData, timeDomainData,
    eqFrequencies: EQ_FREQUENCIES, vuMeterData,
    loadTrack, play, pause, stop, seek, setVolume, setPan, setPreAmp,
    setEqBand, toggleLoop, toggleShuffle, getNextTrack, getPrevTrack,
    dispose, initAudioContext,
  };
}

export { ANSI, dbToLinear, linearToDb, rmsToVu, vuToAngle, calculateRMS, calculatePeak };
