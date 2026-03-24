import { useState, useEffect, useRef, useCallback } from 'react';

const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export function useSuperPlayer() {
  const audioContextRef = useRef(null);
  const preAmpRef = useRef(null);
  const eqFiltersRef = useRef([]);
  const masterGainRef = useRef(null);
  const panNodeRef = useRef(null);
  const analyserRef = useRef(null);
  const audioElementRef = useRef(null);
  const mediaSourceRef = useRef(null);
  
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

  const initAudioContext = useCallback(() => {
    if (audioContextRef.current) return audioContextRef.current;
    
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
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

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.8;
    masterGainRef.current = masterGain;

    const panNode = ctx.createStereoPanner();
    panNode.pan.value = 0;
    panNodeRef.current = panNode;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    analyserRef.current = analyser;

    preAmp.connect(eqFilters[0]);
    eqFilters[eqFilters.length - 1].connect(masterGain);
    masterGain.connect(panNode);
    panNode.connect(analyser);
    analyser.connect(ctx.destination);

    setIsReady(true);
    return ctx;
  }, []);

  const createAudioElement = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.src = '';
    }

    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'metadata';
    
    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
    });

    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration);
    });

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
    });

    audio.addEventListener('play', () => {
      setIsPlaying(true);
    });

    audio.addEventListener('pause', () => {
      setIsPlaying(false);
    });

    audioElementRef.current = audio;
    return audio;
  }, []);

  const connectSource = useCallback((audio) => {
    if (!audioContextRef.current || !audio) return;

    if (mediaSourceRef.current) {
      try {
        mediaSourceRef.current.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
    }

    const mediaSource = audioContextRef.current.createMediaElementSource(audio);
    mediaSource.connect(preAmpRef.current);
    mediaSourceRef.current = mediaSource;
  }, []);

  const analyserRafRef = useRef(null);
  const isPlayingRef = useRef(isPlaying);
  const runAnalyserLoopRef = useRef(null);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    runAnalyserLoopRef.current = () => {
      if (!analyserRef.current) return;
      
      const freqData = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(freqData);
      setAnalyserData(new Uint8Array(freqData));
      
      const timeData = new Float32Array(analyserRef.current.fftSize);
      analyserRef.current.getFloatTimeDomainData(timeData);
      setTimeDomainData(new Float32Array(timeData));
      
      if (isPlayingRef.current) {
        analyserRafRef.current = requestAnimationFrame(runAnalyserLoopRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isPlaying) {
      analyserRafRef.current = requestAnimationFrame(runAnalyserLoopRef.current);
    } else {
      if (analyserRafRef.current) {
        cancelAnimationFrame(analyserRafRef.current);
        analyserRafRef.current = null;
      }
    }
    
    return () => {
      if (analyserRafRef.current) {
        cancelAnimationFrame(analyserRafRef.current);
        analyserRafRef.current = null;
      }
    };
  }, [isPlaying]);

  const loadTrack = useCallback(async (url) => {
    console.log('[AUDIO DEBUG] Loading track with URL:', url);
    
    if (!url) {
      console.error('[AUDIO DEBUG] ERROR: URL is null or undefined!');
      return;
    }
    
    const ctx = initAudioContext();
    
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const audio = createAudioElement();
    connectSource(audio);
    
    audio.src = url;
    console.log('[AUDIO DEBUG] Audio src set, loading...');
    audio.load();
    
    setCurrentTime(0);
    setDuration(0);
    
    return new Promise((resolve, reject) => {
      audio.addEventListener('canplay', () => {
        console.log('[AUDIO DEBUG] canplay event fired - ready to play');
        resolve(audio);
      }, { once: true });
      audio.addEventListener('error', (e) => {
        console.error('[AUDIO DEBUG] Audio error:', audio.error);
        reject(audio.error);
      }, { once: true });
    });
  }, [initAudioContext, createAudioElement, connectSource]);

  const play = useCallback(async () => {
    if (!audioElementRef.current) return;
    
    const ctx = audioContextRef.current;
    if (ctx?.state === 'suspended') {
      await ctx.resume();
    }
    
    try {
      await audioElementRef.current.play();
      setIsPlaying(true);
    } catch (e) {
      console.error('[SUPER PLAYER] Play error:', e);
    }
  }, []);

  const pause = useCallback(() => {
    if (!audioElementRef.current) return;
    audioElementRef.current.pause();
    setIsPlaying(false);
  }, []);

  const stop = useCallback(() => {
    if (!audioElementRef.current) return;
    audioElementRef.current.currentTime = 0;
    audioElementRef.current.pause();
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const seek = useCallback((time) => {
    if (!audioElementRef.current) return;
    audioElementRef.current.currentTime = Math.max(0, Math.min(time, duration));
    setCurrentTime(audioElementRef.current.currentTime);
  }, [duration]);

  const setVolume = useCallback((value) => {
    const vol = Math.max(0, Math.min(1, value));
    if (masterGainRef.current) {
      masterGainRef.current.gain.setTargetAtTime(vol, audioContextRef.current.currentTime, 0.01);
    }
    setVolumeState(vol);
  }, []);

  const setPan = useCallback((value) => {
    const panValue = Math.max(-1, Math.min(1, value));
    if (panNodeRef.current) {
      panNodeRef.current.pan.setTargetAtTime(panValue, audioContextRef.current.currentTime, 0.01);
    }
    setPanState(panValue);
  }, []);

  const setPreAmp = useCallback((value) => {
    const dbValue = Math.max(-12, Math.min(12, value));
    const gain = Math.pow(10, dbValue / 20);
    if (preAmpRef.current) {
      preAmpRef.current.gain.setTargetAtTime(gain, audioContextRef.current.currentTime, 0.01);
    }
    setPreAmpState(dbValue);
  }, []);

  const setEqBand = useCallback((frequency, value) => {
    const dbValue = Math.max(-12, Math.min(12, value));
    const filter = eqFiltersRef.current.find(f => f.frequency.value === frequency);
    if (filter) {
      filter.gain.setTargetAtTime(dbValue, audioContextRef.current.currentTime, 0.01);
    }
    setEqBands(prev => ({ ...prev, [frequency]: dbValue }));
  }, []);

  const setLoopMode = useCallback((mode) => {
    setLoopModeState(mode);
    if (audioElementRef.current) {
      audioElementRef.current.loop = mode === 'track';
    }
  }, []);

  const toggleLoop = useCallback(() => {
    setLoopModeState(prev => {
      const next = prev === 'none' ? 'track' : prev === 'track' ? 'playlist' : 'none';
      if (audioElementRef.current) {
        audioElementRef.current.loop = next === 'track';
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
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.src = '';
    }
    
    if (mediaSourceRef.current) {
      try {
        mediaSourceRef.current.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsReady(false);
  }, []);

  useEffect(() => {
    return () => {
      dispose();
    };
  }, [dispose]);

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
    loadTrack,
    play,
    pause,
    stop,
    seek,
    setVolume,
    setPan,
    setPreAmp,
    setEqBand,
    setLoopMode,
    toggleLoop,
    toggleShuffle,
    getNextTrack,
    getPrevTrack,
    dispose,
    initAudioContext,
  };
}
