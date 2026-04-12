import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { supabase } from '../lib/supabase';

let audioContextInstance = null;
let audioElementInstance = null;
let mediaSourceInstance = null; // Single MediaElementSourceNode - created ONCE
let vuGainNode = null;
let eqFilters = [];
let toneFilters = null;
let sharedGainNode = null;
let sharedAnalyserL = null;
let sharedAnalyserR = null;

const STORAGE_KEY = 'raregroove_settings';

const DEFAULTS = {
  volume: 0.7,
  bass: 0,
  mid: 0,
  treble: 0,
  vuSensitivity: 0.5,
  eq_bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...DEFAULTS, ...JSON.parse(saved) };
  } catch { /* ignore errors */ }
  return DEFAULTS;
}

function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* ignore errors */ }
}

function initToneFilters(ctx) {
  if (toneFilters) return toneFilters;
  
  toneFilters = {
    bass: ctx.createBiquadFilter(),
    mid: ctx.createBiquadFilter(),
    treble: ctx.createBiquadFilter(),
  };
  
  toneFilters.bass.type = 'lowshelf';
  toneFilters.bass.frequency.value = 100;
  toneFilters.bass.gain.value = 0;
  
  toneFilters.mid.type = 'peaking';
  toneFilters.mid.frequency.value = 1000;
  toneFilters.mid.Q.value = 1;
  toneFilters.mid.gain.value = 0;
  
  toneFilters.treble.type = 'highshelf';
  toneFilters.treble.frequency.value = 8000;
  toneFilters.treble.gain.value = 0;
  
  return toneFilters;
}

function initEqFilters(ctx) {
  if (eqFilters.length > 0) return eqFilters;
  
  const bands = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  eqFilters = bands.map((freq) => {
    const filter = ctx.createBiquadFilter();
    filter.type = 'peaking';
    filter.frequency.value = freq;
    filter.Q.value = 1.4;
    filter.gain.value = 0;
    return filter;
  });
  
  return eqFilters;
}

function getSharedGain() {
  if (!audioContextInstance) return null;
  if (!sharedGainNode) {
    sharedGainNode = audioContextInstance.createGain();
    sharedGainNode.gain.value = 0.7;
  }
  return sharedGainNode;
}

function getVuGain() {
  if (!audioContextInstance) return null;
  if (!vuGainNode) {
    vuGainNode = audioContextInstance.createGain();
    vuGainNode.gain.value = 1.0;
  }
  return vuGainNode;
}

function applyAllSettings(settings) {
  if (sharedGainNode) {
    sharedGainNode.gain.value = settings.volume ?? 0.7;
  }
  
  if (toneFilters) {
    toneFilters.bass.gain.value = settings.bass ?? 0;
    toneFilters.mid.gain.value = settings.mid ?? 0;
    toneFilters.treble.gain.value = settings.treble ?? 0;
  }
  
  if (settings.eq_bands && eqFilters.length > 0) {
    settings.eq_bands.forEach((gain, i) => {
      if (eqFilters[i]) eqFilters[i].gain.value = gain;
    });
  }
  
  if (vuGainNode && settings.vuSensitivity !== undefined) {
    vuGainNode.gain.value = settings.vuSensitivity;
  }
}

function connectAudioGraph() {
  if (!audioContextInstance || !mediaSourceInstance) return;
  
  mediaSourceInstance.disconnect();
  
  const gain = getSharedGain();
  const vuGain = getVuGain();
  
  let lastNode = mediaSourceInstance;
  
  if (toneFilters) {
    lastNode.connect(toneFilters.bass);
    toneFilters.bass.connect(toneFilters.mid);
    toneFilters.mid.connect(toneFilters.treble);
    lastNode = toneFilters.treble;
  }
  
  if (eqFilters.length > 0) {
    lastNode.connect(eqFilters[0]);
    for (let i = 0; i < eqFilters.length - 1; i++) {
      eqFilters[i].connect(eqFilters[i + 1]);
    }
    lastNode = eqFilters[eqFilters.length - 1];
  }
  
  lastNode.connect(gain);
  gain.connect(audioContextInstance.destination);
  
  const splitter = audioContextInstance.createChannelSplitter(2);
  lastNode.connect(vuGain);
  vuGain.connect(splitter);
  
  sharedAnalyserL = audioContextInstance.createAnalyser();
  sharedAnalyserL.fftSize = 2048;
  sharedAnalyserL.smoothingTimeConstant = 0.85;
  sharedAnalyserL.minDecibels = -90;
  sharedAnalyserL.maxDecibels = 0;
  
  sharedAnalyserR = audioContextInstance.createAnalyser();
  sharedAnalyserR.fftSize = 2048;
  sharedAnalyserR.smoothingTimeConstant = 0.85;
  sharedAnalyserR.minDecibels = -90;
  sharedAnalyserR.maxDecibels = 0;
  
  splitter.connect(sharedAnalyserL, 0);
  splitter.connect(sharedAnalyserR, 1);
  
  console.log('[GlobalPlayer] Graph connected - analyserL:', !!sharedAnalyserL, 'analyserR:', !!sharedAnalyserR);
}

function initAudioContext() {
  if (audioContextInstance && audioContextInstance.state !== 'closed') {
    return audioContextInstance;
  }
  
  audioContextInstance = new (window.AudioContext || window.webkitAudioContext)();
  console.log('[GlobalPlayer] AudioContext created, state:', audioContextInstance.state);
  
  initToneFilters(audioContextInstance);
  initEqFilters(audioContextInstance);
  
  const settings = loadSettings();
  applyAllSettings(settings);
  
  return audioContextInstance;
}

function getAnalysers() {
  return { analyserL: sharedAnalyserL, analyserR: sharedAnalyserR };
}

let audioPlayerInstance = null;

export function getAudioPlayer() {
  if (!audioPlayerInstance) {
    audioPlayerInstance = {
      getPresignedUrl: async (filePath) => {
        if (!filePath) return null;
        
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) throw new Error('No session');
          
          const { data, error } = await supabase.functions.invoke('b2-presign', {
            body: { file_path: filePath, userId: session.user.id, type: 'audio' },
          });
          
          if (error || !data?.url) return null;
          return data.url;
        } catch (err) {
          console.error('[GlobalPlayer] Error getting URL:', err);
          return null;
        }
      },
    };
  }
  return audioPlayerInstance;
}

export function useGlobalAudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [queue, setQueue] = useState([]);
  const [volume, setVolumeState] = useState(0.7);
  
  const urlCacheRef = useRef(new Map());
  const userIdRef = useRef(null);
  const audioRef = useRef(null);
  const currentTrackIdRef = useRef(null);
  const isConnectedRef = useRef(false);
  const mediaSourceRef = useRef(null);
  const currentTrackIndexRef = useRef(-1);
  const connectedAudioRef = useRef(null);
  const queueRef = useRef([]);
  const loadAndPlayTrackRef = useRef(null);
  
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      userIdRef.current = session?.user?.id || null;
    };
    init();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      userIdRef.current = session?.user?.id || null;
    });
    
    return () => subscription.unsubscribe();
  }, []);
  
  const ensureContextRunning = useCallback(async () => {
    const ctx = audioContextInstance;
    if (!ctx) return false;
    
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (err) {
        return false;
      }
    }
    return ctx.state === 'running';
  }, []);
  
  const getPresignedUrl = useCallback(async (filePath) => {
    if (!filePath) return null;
    if (urlCacheRef.current.has(filePath)) {
      return urlCacheRef.current.get(filePath);
    }
    
    const url = await getAudioPlayer().getPresignedUrl(filePath);
    if (url) urlCacheRef.current.set(filePath, url);
    return url;
  }, []);
  
  const createAudioElement = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = 'anonymous';
      audioRef.current.preload = 'metadata';
    }
    return audioRef.current;
  }, []);
  
  const initAudioGraph = useCallback(() => {
    if (audioContextInstance && audioContextInstance.state !== 'closed') {
      return audioContextInstance;
    }
    return initAudioContext();
  }, []);
  
  // Create audio source ONCE - this is the key!
  const connectMediaSource = useCallback((audioElement) => {
    if (!audioElement) return false;
    
    // Already connected to this element? Skip!
    if (mediaSourceInstance && connectedAudioRef.current === audioElement) {
      return true;
    }
    
    // If source exists but connected to different element, can't reuse - must be same element
    if (mediaSourceInstance && connectedAudioRef.current && connectedAudioRef.current !== audioElement) {
      console.warn('[GlobalPlayer] Cannot reuse sourceNode with different audio element');
    }
    
    try {
      const ctx = audioContextInstance;
      if (!ctx) return false;
      
      // Only create if doesn't exist
      if (!mediaSourceInstance) {
        mediaSourceInstance = ctx.createMediaElementSource(audioElement);
        connectAudioGraph();
        console.log('[GlobalPlayer] MediaElementSource created once');
      }
      
      connectedAudioRef.current = audioElement;
      isConnectedRef.current = true;
      return true;
    } catch (err) {
      console.error('[GlobalPlayer] connectMediaSource error:', err);
      return false;
    }
  }, []);
  
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      if (audioRef.current._cleanupListeners) {
        audioRef.current._cleanupListeners();
        audioRef.current._cleanupListeners = null;
      }
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setCurrentTime(0);
    setIsPlaying(false);
  }, []);
  
  const loadAndPlayTrack = useCallback(async (track) => {
    if (!track?.audioPath) return;
    
    const trackId = track.id;
    const isSameTrack = audioRef.current && currentTrackIdRef.current === trackId && audioRef.current.src;
    
    if (isSameTrack) {
      audioRef.current.currentTime = 0;
      try { await audioRef.current.play(); } catch { /* ignore errors */ }
      return;
    }
    
    currentTrackIdRef.current = trackId;
    setCurrentTime(0);
    setDuration(0);
    setCurrentTrack(track);
    
    // Ensure audioContext is running
    const ctx = initAudioGraph();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    
    const url = await getPresignedUrl(track.audioPath);
    if (!url) return;
    
    // Reuse existing audio element - just change src
    let audio = audioRef.current;
    if (!audio) {
      audio = createAudioElement();
      audioRef.current = audio;
    }
    
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => {
      setIsPlaying(false);
      const q = queueRef.current;
      const nextIndex = currentTrackIndexRef.current + 1;
      if (q.length > 0 && nextIndex < q.length) {
        const nextTrack = q[nextIndex];
        currentTrackIndexRef.current = nextIndex;
        if (nextTrack && loadAndPlayTrackRef.current) {
          loadAndPlayTrackRef.current(nextTrack);
        }
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    
    // Remove old listeners
    audio.removeEventListener('timeupdate', onTimeUpdate);
    audio.removeEventListener('loadedmetadata', onLoadedMetadata);
    audio.removeEventListener('ended', onEnded);
    audio.removeEventListener('play', onPlay);
    audio.removeEventListener('pause', onPause);
    
    // Add listeners
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    
    // KEY CHANGE: Just change src, DON'T reconnect MediaElementSource!
    audio.src = url;
    
    // Resume if suspended, then play with try/catch
    try {
      if (ctx.state === 'suspended') await ctx.resume();
      await audio.play();
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('[GlobalPlayer] Play warning:', err.message);
      }
    }
  }, [initAudioGraph, getPresignedUrl, createAudioElement]);
  
  const playAlbum = useCallback(async (album, startIndex = 0) => {
    const audioFiles = album?.audio_files || album?.metadata?.grooveflix?.audio_files || [];
    const tracklist = album?.tracklist || album?.metadata?.grooveflix?.tracklist || [];
    
    if (audioFiles.length === 0) return;
    
    const tracks = audioFiles.map((file, idx) => ({
      id: `${album.id}-${idx}`,
      title: tracklist[idx]?.title || `Track ${idx + 1}`,
      artist: album.artist || 'Unknown',
      audioPath: file?.path || file,
      albumId: album.id,
      album: album.title,
      albumTitle: album.title,
    }));
    
    queueRef.current = tracks;
    setQueue(tracks);
    currentTrackIndexRef.current = startIndex;
    
    if (tracks[startIndex]) {
      loadAndPlayTrack(tracks[startIndex]);
    }
  }, [loadAndPlayTrack]);
  
  const play = useCallback(async () => {
    await ensureContextRunning();
    if (audioRef.current) {
      try { await audioRef.current.play(); } catch { /* ignore errors */ }
    }
  }, [ensureContextRunning]);
  
  const pause = useCallback(() => {
    if (audioRef.current) audioRef.current.pause();
  }, []);
  
  const updateCurrentTrack = useCallback((track) => {
    currentTrackIdRef.current = track?.id;
    setCurrentTrack(track);
  }, []);
  
  const stop = useCallback(() => {
    stopAudio();
    updateCurrentTrack(null);
    queueRef.current = [];
    setQueue([]);
    currentTrackIndexRef.current = -1;
  }, [stopAudio, updateCurrentTrack]);
  
  const seek = useCallback((time) => {
    if (audioRef.current && audioRef.current.duration) {
      audioRef.current.currentTime = Math.max(0, Math.min(time, audioRef.current.duration));
    }
  }, []);
  
  const setVolume = useCallback((value) => {
    const vol = Math.max(0, Math.min(1, value));
    if (audioRef.current) audioRef.current.volume = vol;
    if (sharedGainNode) sharedGainNode.gain.value = vol;
    setVolumeState(vol);
    const settings = loadSettings();
    saveSettings({ ...settings, volume: vol });
  }, []);
  
  const clearQueue = useCallback(() => {
    queueRef.current = [];
    setQueue([]);
    currentTrackIndexRef.current = -1;
  }, []);

  const playNext = useCallback(() => {
    if (queue.length > 0 && currentTrackIndexRef.current < queue.length - 1) {
      currentTrackIndexRef.current += 1;
      loadAndPlayTrack(queue[currentTrackIndexRef.current]);
    }
  }, [queue, loadAndPlayTrack]);
  
  const playPrevious = useCallback(() => {
    if (currentTrackIndexRef.current > 0) {
      currentTrackIndexRef.current -= 1;
      loadAndPlayTrack(queue[currentTrackIndexRef.current]);
    }
  }, [queue, loadAndPlayTrack]);

  const playTrackFromQueue = useCallback(async (track) => {
    if (!track) return;
    console.log('[GlobalPlayer] playTrackFromQueue:', track.title);
    currentTrackIdRef.current = track.id;
    currentTrackIndexRef.current = queue.findIndex(t => t.id === track.id);
    await loadAndPlayTrack(track);
  }, [loadAndPlayTrack, queue]);
  
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  
  useEffect(() => {
    loadAndPlayTrackRef.current = loadAndPlayTrack;
  }, [loadAndPlayTrack]);
  
  return {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    queue,
    volume,
    loadTrack: loadAndPlayTrack,
    playAlbum,
    play,
    pause,
    stop,
    seek,
    setVolume,
    updateCurrentTrack,
    playNext,
    playPrevious,
    playTrackFromQueue,
    clearQueue,
    getAnalysers,
  };
}

const GlobalPlayerContext = createContext(null);

export function GlobalPlayerProvider({ children }) {
  const player = useGlobalAudioPlayer();
  
  return (
    <GlobalPlayerContext.Provider value={player}>
      {children}
    </GlobalPlayerContext.Provider>
  );
}

export function useGlobalPlayer() {
  const context = useContext(GlobalPlayerContext);
  if (!context) {
    throw new Error('useGlobalPlayer must be used within GlobalPlayerProvider');
  }
  return context;
}