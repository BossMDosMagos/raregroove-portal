import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioPlayer } from '../contexts/AudioPlayerContext.jsx';
import { registerAnalysers, unregisterAnalysers } from './useGlobalAudioAnalyser.js';
import { initEqualizer, getEqualizerFilters } from './useEqualizer.js';

let audioContextInstance = null;
let sharedAnalyserL = null;
let sharedAnalyserR = null;
let sharedSplitter = null;
let sharedMerger = null;
let sharedGain = null;

function initAudioGraph() {
  if (audioContextInstance) return audioContextInstance;
  
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  audioContextInstance = ctx;
  
  initEqualizer(ctx);
  
  const splitter = ctx.createChannelSplitter(2);
  sharedSplitter = splitter;
  
  const analyserL = ctx.createAnalyser();
  analyserL.fftSize = 2048;
  analyserL.smoothingTimeConstant = 0.8;
  sharedAnalyserL = analyserL;
  
  const analyserR = ctx.createAnalyser();
  analyserR.fftSize = 2048;
  analyserR.smoothingTimeConstant = 0.8;
  sharedAnalyserR = analyserR;
  
  const merger = ctx.createChannelMerger(2);
  sharedMerger = merger;
  
  const gain = ctx.createGain();
  gain.gain.value = 1;
  sharedGain = gain;
  
  const eqFilters = getEqualizerFilters();
  
  splitter.connect(analyserL, 0);
  splitter.connect(analyserR, 1);
  
  analyserL.connect(merger, 0, 0);
  analyserR.connect(merger, 0, 1);
  
  if (eqFilters?.length > 0) {
    merger.connect(eqFilters[0]);
    eqFilters[eqFilters.length - 1].connect(gain);
  } else {
    merger.connect(gain);
  }
  
  gain.connect(ctx.destination);
  
  registerAnalysers({ analyserL, analyserR, splitter, merger });
  
  return ctx;
}

export function useGrooveflixPlayer() {
  const audioPlayer = useAudioPlayer();
  
  const audioElementRef = useRef(null);
  const mediaSourceRef = useRef(null);
  const audioEventsRef = useRef([]);
  const isConnectedRef = useRef(false);
  const isLoadingRef = useRef(false);
  const loadAndPlayTrackRef = useRef(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const ensureContextRunning = useCallback(async () => {
    const ctx = audioContextInstance;
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch { return false; }
    }
    return ctx.state === 'running';
  }, []);
  
  const connectMediaSource = useCallback((audioElement) => {
    if (isConnectedRef.current || !audioContextInstance || !audioElement) return;
    
    try {
      if (mediaSourceRef.current) {
        mediaSourceRef.current.disconnect();
      }
      
      const mediaSource = audioContextInstance.createMediaElementSource(audioElement);
      mediaSource.connect(sharedSplitter);
      mediaSourceRef.current = mediaSource;
      isConnectedRef.current = true;
    } catch {
      // Silently handle - already connected
    }
  }, []);
  
  const removeAudioEvents = useCallback(() => {
    const audio = audioElementRef.current;
    if (!audio) return;
    
    audioEventsRef.current.forEach(({ event, handler }) => {
      audio.removeEventListener(event, handler);
    });
    audioEventsRef.current = [];
  }, []);
  
  const cleanup = useCallback(() => {
    removeAudioEvents();
    
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.src = '';
      audioElementRef.current = null;
    }
    
    if (mediaSourceRef.current) {
      try { mediaSourceRef.current.disconnect(); } catch {}
      mediaSourceRef.current = null;
    }
    
    isConnectedRef.current = false;
    isLoadingRef.current = false;
  }, [removeAudioEvents]);
  
  const loadAndPlayTrack = useCallback(async (track) => {
    if (!track?.audioPath) return;
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    
    cleanup();
    setIsPlaying(false);
    setCurrentTime(0);
    
    const ctx = initAudioGraph();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    
    const url = await audioPlayer.getPresignedUrl(track.audioPath);
    if (!url) {
      isLoadingRef.current = false;
      return;
    }
    
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'none';
    
    const events = [];
    
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => {
      setIsPlaying(false);
      const queue = audioPlayer?.queue || [];
      const currentTrackId = audioPlayer?.currentTrack?.id;
      
      if (queue.length > 0 && currentTrackId) {
        const currentIdx = queue.findIndex(t => t.id === currentTrackId);
        if (currentIdx >= 0 && currentIdx < queue.length - 1) {
          const nextTrack = queue[currentIdx + 1];
          if (nextTrack && audioPlayer?.setCurrentTrack && loadAndPlayTrackRef.current) {
            audioPlayer.setCurrentTrack(nextTrack);
            loadAndPlayTrackRef.current(nextTrack);
          }
        }
      }
    };
    const onPlay = () => {
      setIsPlaying(true);
      connectMediaSource(audio);
    };
    const onPause = () => setIsPlaying(false);
    const onError = () => { isLoadingRef.current = false; };
    
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);
    
    events.push(
      { event: 'timeupdate', handler: onTimeUpdate },
      { event: 'loadedmetadata', handler: onLoadedMetadata },
      { event: 'ended', handler: onEnded },
      { event: 'play', handler: onPlay },
      { event: 'pause', handler: onPause },
      { event: 'error', handler: onError }
    );
    
    audioEventsRef.current = events;
    audioElementRef.current = audio;
    audio.src = url;
    audio.load();
    
    audio.play().catch(() => {
      isLoadingRef.current = false;
    });
    
  }, [audioPlayer, cleanup, connectMediaSource]);

  useEffect(() => {
    loadAndPlayTrackRef.current = loadAndPlayTrack;
  }, [loadAndPlayTrack]);

  const play = useCallback(async () => {
    const audio = audioElementRef.current;
    if (!audio) return;
    await ensureContextRunning();
    audio.play().catch(() => {});
  }, [ensureContextRunning]);
  
  const pause = useCallback(() => {
    audioElementRef.current?.pause();
  }, []);
  
  const stop = useCallback(() => {
    const audio = audioElementRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.pause();
    setCurrentTime(0);
  }, []);
  
  const seek = useCallback((time) => {
    const audio = audioElementRef.current;
    if (!audio) return;
    const clampedTime = Math.max(0, Math.min(time, duration));
    audio.currentTime = clampedTime;
    setCurrentTime(clampedTime);
  }, [duration]);
  
  const setVolume = useCallback((value) => {
    const vol = Math.max(0, Math.min(1, value));
    if (audioElementRef.current) {
      audioElementRef.current.volume = vol;
    }
    if (sharedGain) {
      sharedGain.gain.value = vol;
    }
    audioPlayer.setVolume(vol);
  }, [audioPlayer]);
  
  const dispose = useCallback(() => {
    cleanup();
    if (mediaSourceRef.current) {
      try { mediaSourceRef.current.disconnect(); } catch {}
      mediaSourceRef.current = null;
    }
    unregisterAnalysers();
  }, [cleanup]);
  
  useEffect(() => {
    return () => { dispose(); };
  }, [dispose]);
  
  return {
    ...audioPlayer,
    isPlaying,
    currentTime,
    duration,
    volume: 0.8,
    setVolume,
    play,
    pause,
    stop,
    seek,
    loadAndPlayTrack,
    dispose,
    queue: audioPlayer?.queue || [],
    playTrackFromQueue: audioPlayer?.playTrackFromQueue,
  };
}
