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

let audioContext = null;
let mediaSourceNode = null;
let splitterNode = null;
let analyserLeft = null;
let analyserRight = null;
let masterGainNode = null;
let preAmpNode = null;
let eqFilters = [];
let isAudioContextInitialized = false;

function initAudioContextGlobal() {
  if (isAudioContextInitialized) return audioContext;

  audioContext = Howler.ctx || new (window.AudioContext || window.webkitAudioContext)();
  
  if (Howler.ctx) {
    Howler.ctx = audioContext;
  }

  masterGainNode = audioContext.createGain();
  masterGainNode.gain.value = 0.8;
  masterGainNode.connect(audioContext.destination);

  splitterNode = audioContext.createChannelSplitter(2);
  
  analyserLeft = audioContext.createAnalyser();
  analyserRight = audioContext.createAnalyser();
  analyserLeft.fftSize = ANSI.FFT_SIZE;
  analyserLeft.smoothingTimeConstant = ANSI.SMOOTHING;
  analyserRight.fftSize = ANSI.FFT_SIZE;
  analyserRight.smoothingTimeConstant = ANSI.SMOOTHING;

  preAmpNode = audioContext.createGain();
  preAmpNode.gain.value = 1;

  eqFilters = EQ_FREQUENCIES.map((freq, i) => {
    const filter = audioContext.createBiquadFilter();
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

  for (let i = 0; i < eqFilters.length - 1; i++) {
    eqFilters[i].connect(eqFilters[i + 1]);
  }

  preAmpNode.connect(eqFilters[0]);
  eqFilters[eqFilters.length - 1].connect(masterGainNode);
  masterGainNode.connect(splitterNode);
  splitterNode.connect(analyserLeft, 0);
  splitterNode.connect(analyserRight, 1);

  isAudioContextInitialized = true;
  return audioContext;
}

function getAudioBuffer() {
  if (!analyserLeft || !analyserRight) return null;
  return {
    bufferL: new Float32Array(analyserLeft.fftSize),
    bufferR: new Float32Array(analyserRight.fftSize),
    analyserL: analyserLeft,
    analyserR: analyserRight,
  };
}

export function useAudioEngine() {
  const howlRef = useRef(null);
  const audioElementRef = useRef(null);
  
  const animationFrameRef = useRef(null);
  const isLoopRunningRef = useRef(false);

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
  const eqBandsRef = useRef(Object.fromEntries(EQ_FREQUENCIES.map(f => [f, 0])));
  const mediaSourceConnectedRef = useRef(false);

  const startLoop = useCallback(() => {
    if (isLoopRunningRef.current) return;
    isLoopRunningRef.current = true;

    const ctx = audioContext;
    if (!ctx || ctx.state !== 'running') {
      animationFrameRef.current = requestAnimationFrame(startLoop);
      return;
    }

    const bufferData = getAudioBuffer();
    if (!bufferData) {
      animationFrameRef.current = requestAnimationFrame(startLoop);
      return;
    }

    const loop = () => {
      if (!isLoopRunningRef.current) return;

      const localCtx = audioContext;
      if (!localCtx || localCtx.state !== 'running') {
        animationFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      const data = getAudioBuffer();
      if (!data) {
        animationFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      data.analyserL.getFloatTimeDomainData(data.bufferL);
      data.analyserR.getFloatTimeDomainData(data.bufferR);

      const combinedTime = new Float32Array(data.bufferL.length + data.bufferR.length);
      combinedTime.set(data.bufferL, 0);
      combinedTime.set(data.bufferR, data.bufferL.length);
      setTimeDomainData(combinedTime);

      const freqL = new Uint8Array(data.analyserL.frequencyBinCount);
      const freqR = new Uint8Array(data.analyserR.frequencyBinCount);
      data.analyserL.getByteFrequencyData(freqL);
      data.analyserR.getByteFrequencyData(freqR);

      const combinedFreq = new Uint8Array(freqL.length);
      for (let i = 0; i < combinedFreq.length; i++) {
        combinedFreq[i] = Math.max(freqL[i], freqR[i]);
      }
      setAnalyserData(combinedFreq);

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);
  }, []);

  const stopLoop = useCallback(() => {
    isLoopRunningRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const initAudioContext = useCallback(() => {
    if (isAudioContextInitialized) return;

    Howler.autoSuspend = false;
    Howler.volume(0.8);

    const ctx = initAudioContextGlobal();
    if (ctx?.state === 'suspended') {
      ctx.resume();
    }

    setIsReady(true);
  }, []);

  const connectMediaSource = useCallback(() => {
    if (mediaSourceConnectedRef.current) return;
    if (!audioContext || !audioElementRef.current) return;

    try {
      if (mediaSourceNode) {
        try { mediaSourceNode.disconnect(); } catch (e) {}
      }
      
      mediaSourceNode = audioContext.createMediaElementSource(audioElementRef.current);
      mediaSourceNode.connect(preAmpNode);
      mediaSourceConnectedRef.current = true;
    } catch (e) {
      console.log('[Audio] MediaSource already exists or error:', e.message);
    }
  }, []);

  const loadTrack = useCallback(async (url, autoplay = true) => {
    if (howlRef.current) {
      howlRef.current.unload();
      howlRef.current = null;
    }

    initAudioContext();

    const ctx = audioContext || Howler.ctx;
    if (ctx?.state === 'suspended') {
      await ctx.resume();
    }

    return new Promise((resolve, reject) => {
      const howl = new Howl({
        src: [url],
        html5: true,
        format: ['mp3'],
        xhr: { withCredentials: false },
        volume: volumeRef.current,
        loop: loopMode === 'track',
        pool: 1,
        autoplay: false,
        preload: true,
        onplay: () => {
          setIsPlaying(true);
          
          if (!mediaSourceConnectedRef.current && audioElementRef.current) {
            const element = howl._sounds[0]?._node;
            if (element && element !== audioElementRef.current) {
              audioElementRef.current = element;
            }
            connectMediaSource();
          }

          const currentCtx = audioContext || Howler.ctx;
          if (currentCtx?.state === 'suspended') {
            currentCtx.resume();
          }

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
          
          const element = howl._sounds[0]?._node;
          if (element) {
            audioElementRef.current = element;
            if (audioContext && audioContext.state === 'running') {
              connectMediaSource();
            }
          }
          
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
  }, [loopMode, initAudioContext, startLoop, stopLoop, connectMediaSource]);

  const play = useCallback(async () => {
    const ctx = audioContext || Howler.ctx;
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
    if (masterGainNode) {
      masterGainNode.gain.setTargetAtTime(vol, audioContext.currentTime, 0.01);
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
    if (preAmpNode) {
      preAmpNode.gain.setTargetAtTime(gain, audioContext.currentTime, 0.01);
    }
    setPreAmpState(dbValue);
  }, []);

  const setEqBand = useCallback((frequency, value) => {
    const dbValue = Math.max(-12, Math.min(12, value));
    eqBandsRef.current[frequency] = dbValue;
    const filter = eqFilters.find(f => f.frequency.value === frequency);
    if (filter) {
      filter.gain.setTargetAtTime(dbValue, audioContext.currentTime, 0.01);
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
    stopLoop();
    if (howlRef.current) {
      howlRef.current.unload();
      howlRef.current = null;
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsReady(false);
    mediaSourceConnectedRef.current = false;
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

export { ANSI, dbToLinear, linearToDb, calculateRMS, calculatePeak };
