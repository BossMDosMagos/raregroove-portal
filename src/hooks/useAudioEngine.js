import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Howl, Howler } from 'howler';

const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

const ANSI = {
  ZERO_VU_DB: -18,
  PEAK_THRESHOLD_DB: -0.5,
  RISE_TIME_MS: 300,
  PEAK_HOLD_MS: 500,
  OVERSHOOT: 0.015,
  FFT_SIZE: 4096,
  SMOOTHING: 0.92,
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
  
  const analyserLRef = useRef(null);
  const analyserRRef = useRef(null);
  const splitterRef = useRef(null);
  const mergerRef = useRef(null);
  const dataLRef = useRef(null);
  const dataRRef = useRef(null);
  const isConnectedRef = useRef(false);

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
  const [spectrumL, setSpectrumL] = useState(new Uint8Array(64));
  const [spectrumR, setSpectrumR] = useState(new Uint8Array(64));
  const [timeDomainBytesL, setTimeDomainBytesL] = useState(new Uint8Array(512));
  const [timeDomainBytesR, setTimeDomainBytesR] = useState(new Uint8Array(512));
  
  const volumeRef = useRef(0.8);
  const panRef = useRef(0);
  const loopModeRef = useRef('none');
  const shuffleRef = useRef(false);
  const preAmpRef = useRef(null);
  const eqFiltersRef = useRef([]);
  const masterGainRef = useRef(null);
  const isInitializedRef = useRef(false);

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
    return ctx.state === 'running';
  }, []);

  const disconnectAnalysers = useCallback(() => {
    try { if (splitterRef.current) splitterRef.current.disconnect(); } catch (e) {}
    try { if (analyserLRef.current) analyserLRef.current.disconnect(); } catch (e) {}
    try { if (analyserRRef.current) analyserRRef.current.disconnect(); } catch (e) {}
    try { if (mergerRef.current) mergerRef.current.disconnect(); } catch (e) {}
    splitterRef.current = null;
    analyserLRef.current = null;
    analyserRRef.current = null;
    mergerRef.current = null;
    dataLRef.current = null;
    dataRRef.current = null;
    isConnectedRef.current = false;
  }, []);

  const connectAnalysers = useCallback(() => {
    const ctx = Howler.ctx;
    if (!ctx) return;

    disconnectAnalysers();

    const FFT_SIZE = ANSI.FFT_SIZE;

    splitterRef.current = ctx.createChannelSplitter(2);

    analyserLRef.current = ctx.createAnalyser();
    analyserLRef.current.fftSize = FFT_SIZE;
    analyserLRef.current.smoothingTimeConstant = ANSI.SMOOTHING;
    dataLRef.current = new Uint8Array(analyserLRef.current.frequencyBinCount);

    analyserRRef.current = ctx.createAnalyser();
    analyserRRef.current.fftSize = FFT_SIZE;
    analyserRRef.current.smoothingTimeConstant = ANSI.SMOOTHING;
    dataRRef.current = new Uint8Array(analyserRRef.current.frequencyBinCount);

    mergerRef.current = ctx.createChannelMerger(2);

    Howler.masterGain.connect(splitterRef.current);

    splitterRef.current.connect(analyserLRef.current, 0);
    splitterRef.current.connect(analyserRRef.current, 1);

    analyserLRef.current.connect(mergerRef.current, 0, 0);
    analyserRRef.current.connect(mergerRef.current, 0, 1);

    mergerRef.current.connect(ctx.destination);

    isConnectedRef.current = true;
  }, [disconnectAnalysers]);

  const stopAnimLoop = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  const animLoop = useCallback(() => {
    stopAnimLoop();

    if (!isPlayingRef.current) return;

    const ctx = Howler.ctx;
    if (!ctx || ctx.state === 'closed' || !analyserLRef.current || !analyserRRef.current) {
      animFrameRef.current = requestAnimationFrame(animLoop);
      return;
    }

    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        if (isPlayingRef.current) {
          animFrameRef.current = requestAnimationFrame(animLoop);
        }
      });
      return;
    }

    try {
      analyserLRef.current.getByteTimeDomainData(dataLRef.current);
      analyserRRef.current.getByteTimeDomainData(dataRRef.current);

      const rmsL = calculateRMS(dataLRef.current);
      const rmsR = calculateRMS(dataRRef.current);

      const combinedTime = new Float32Array(dataLRef.current.length + dataRRef.current.length);
      combinedTime.set(dataLRef.current, 0);
      combinedTime.set(dataRRef.current, dataLRef.current.length);
      setTimeDomainData(combinedTime);

      const timeBytesL = new Uint8Array(dataLRef.current.length);
      const timeBytesR = new Uint8Array(dataRRef.current.length);
      analyserLRef.current.getByteTimeDomainData(timeBytesL);
      analyserRRef.current.getByteTimeDomainData(timeBytesR);
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
    } catch (e) {
      console.log('[Audio] Analyser read error:', e.message);
    }

    if (isPlayingRef.current) {
      animFrameRef.current = requestAnimationFrame(animLoop);
    }
  }, [stopAnimLoop]);

  const initAudioContext = useCallback(() => {
    if (isInitializedRef.current) return;

    Howler.autoSuspend = false;
    Howler.volume(0.8);

    const ctx = Howler.ctx;
    if (!ctx) return;

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

  const loadTrack = useCallback(async (url, autoplay = true) => {
    if (howlRef.current) {
      howlRef.current.unload();
      howlRef.current = null;
    }

    stopAnimLoop();
    disconnectAnalysers();
    isPlayingRef.current = false;

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
        onseek: () => {
          const pos = howl.seek();
          if (typeof pos === 'number') {
            setCurrentTime(pos);
          }
        },
        onload: () => {
          const dur = howl.duration();
          setDuration(dur);
          
          connectAnalysers();
          
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
          Howler.ctx?.resume().then(() => howl?.play());
        },
      });

      howlRef.current = howl;
      setCurrentTime(0);
      setDuration(0);
    });
  }, [initAudioContext, ensureContextRunning, stopAnimLoop, animLoop, connectAnalysers]);

  const play = useCallback(async () => {
    const ctx = Howler.ctx;
    if (ctx?.state === 'suspended') {
      await ctx.resume();
    }

    if (howlRef.current) {
      howlRef.current.play();
      setIsPlaying(true);
      isPlayingRef.current = true;
      
      ensureContextRunning();
      stopAnimLoop();
      animFrameRef.current = requestAnimationFrame(animLoop);
    }
  }, [ensureContextRunning, stopAnimLoop, animLoop]);

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
    isPlayingRef.current = false;
    stopAnimLoop();
    disconnectAnalysers();
    if (howlRef.current) {
      howlRef.current.unload();
      howlRef.current = null;
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsReady(false);
    isInitializedRef.current = false;
  }, [stopAnimLoop, disconnectAnalysers]);

  useEffect(() => {
    return () => {
      dispose();
    };
  }, [dispose]);

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
    eqFrequencies: EQ_FREQUENCIES, vuMeterData, spectrumL, spectrumR,
    timeDomainBytesL, timeDomainBytesR,
    loadTrack, play, pause, stop, seek, setVolume, setPan, setPreAmp,
    setEqBand, toggleLoop, toggleShuffle, getNextTrack, getPrevTrack,
    dispose, initAudioContext,
  };
}

export { ANSI, dbToLinear, linearToDb, calculateRMS, calculatePeak };
