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
  const isConnectedRef = useRef(false);
  const currentTrackIdRef = useRef(null);
  const pendingTrackIdRef = useRef(null);
  
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
      // Silently handle
    }
  }, []);
  
  const stopAudio = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.src = '';
    }
    
    if (mediaSourceRef.current) {
      try { mediaSourceRef.current.disconnect(); } catch {}
      mediaSourceRef.current = null;
    }
    
    isConnectedRef.current = false;
    currentTrackIdRef.current = null;
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
  }, []);
  
  const loadAndPlayTrack = useCallback(async (track) => {
    if (!track?.audioPath) return;
    
    const trackId = track.id;
    pendingTrackIdRef.current = trackId;
    
    if (audioElementRef.current && currentTrackIdRef.current === trackId) {
      return;
    }
    
    stopAudio();
    setCurrentTime(0);
    setDuration(0);
    
    const ctx = initAudioGraph();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    
    const url = await audioPlayer.getPresignedUrl(track.audioPath);
    if (!url) return;
    if (pendingTrackIdRef.current !== trackId) return;
    
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'metadata';
    
    currentTrackIdRef.current = trackId;
    
    const onTimeUpdate = () => {
      if (currentTrackIdRef.current === trackId) {
        setCurrentTime(audio.currentTime);
      }
    };
    
    const onLoadedMetadata = () => {
      if (currentTrackIdRef.current === trackId) {
        setDuration(audio.duration);
      }
    };
    
    const onEnded = () => {
      if (currentTrackIdRef.current !== trackId) return;
      
      const queue = audioPlayer?.queue || [];
      const currentTrackId = audioPlayer?.currentTrack?.id;
      
      if (queue.length > 0 && currentTrackId) {
        const currentIdx = queue.findIndex(t => t.id === currentTrackId);
        if (currentIdx >= 0 && currentIdx < queue.length - 1) {
          const nextTrack = queue[currentIdx + 1];
          if (nextTrack && audioPlayer?.setCurrentTrack) {
            audioPlayer.setCurrentTrack(nextTrack);
          }
        }
      }
    };
    
    const onPlay = () => {
      if (currentTrackIdRef.current === trackId) {
        setIsPlaying(true);
        connectMediaSource(audio);
      }
    };
    
    const onPause = () => {
      if (currentTrackIdRef.current === trackId) {
        setIsPlaying(false);
      }
    };
    
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    
    audioElementRef.current = audio;
    audio.src = url;
    
    try {
      await audio.play();
    } catch (err) {
      console.error('[Player] Play error:', err);
    }
    
  }, [audioPlayer, stopAudio, connectMediaSource]);

  const play = useCallback(async () => {
    const audio = audioElementRef.current;
    if (!audio) return;
    await ensureContextRunning();
    try { await audio.play(); } catch {}
  }, [ensureContextRunning]);
  
  const pause = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }
  }, []);
  
  const stop = useCallback(() => {
    stopAudio();
    if (audioPlayer?.setIsPlaying) {
      audioPlayer.setIsPlaying(false);
    }
  }, [stopAudio, audioPlayer]);
  
  const seek = useCallback((time) => {
    const audio = audioElementRef.current;
    if (!audio) return;
    const maxTime = audio.duration || duration;
    const clampedTime = Math.max(0, Math.min(time, maxTime));
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
    stopAudio();
    unregisterAnalysers();
  }, [stopAudio]);
  
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
