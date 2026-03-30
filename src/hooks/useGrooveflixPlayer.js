import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioPlayer } from '../contexts/AudioPlayerContext.jsx';
import { registerAnalysers, unregisterAnalysers } from './useGlobalAudioAnalyser.js';

export function useGrooveflixPlayer() {
  const audioPlayer = useAudioPlayer();
  
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaSourceRef = useRef(null);
  const stereoGainRef = useRef(null);
  const analyserLRef = useRef(null);
  const analyserRRef = useRef(null);
  const splitterRef = useRef(null);
  const mergerRef = useRef(null);
  const animFrameRef = useRef(null);
  
  const volumeRef = useRef(0.8);
  const isInitializedRef = useRef(false);
  const isLoadingRef = useRef(false);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const initAudioContext = useCallback(() => {
    if (isInitializedRef.current && audioContextRef.current) return audioContextRef.current;
    
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioContextRef.current = ctx;
    
    const splitter = ctx.createChannelSplitter(2);
    splitterRef.current = splitter;
    
    const analyserL = ctx.createAnalyser();
    analyserL.fftSize = 2048;
    analyserL.smoothingTimeConstant = 0.8;
    analyserLRef.current = analyserL;
    
    const analyserR = ctx.createAnalyser();
    analyserR.fftSize = 2048;
    analyserR.smoothingTimeConstant = 0.8;
    analyserRRef.current = analyserR;
    
    const merger = ctx.createChannelMerger(2);
    mergerRef.current = merger;
    
    const stereoGain = ctx.createGain();
    stereoGain.gain.value = 1;
    stereoGainRef.current = stereoGain;
    
    stereoGain.connect(splitter);
    
    splitter.connect(analyserL, 0);
    splitter.connect(analyserR, 1);
    
    analyserL.connect(merger, 0, 0);
    analyserR.connect(merger, 0, 1);
    
    merger.connect(ctx.destination);
    
    isInitializedRef.current = true;
    
    registerAnalysers({
      analyserL: analyserLRef.current,
      analyserR: analyserRRef.current,
      splitter: splitterRef.current,
      merger: mergerRef.current,
    });
    
    return ctx;
  }, []);
  
  const disconnectAnalysers = useCallback(() => {
    try { if (splitterRef.current) splitterRef.current.disconnect(); } catch {}
    try { if (analyserLRef.current) analyserLRef.current.disconnect(); } catch {}
    try { if (analyserRRef.current) analyserRRef.current.disconnect(); } catch {}
    try { if (mergerRef.current) mergerRef.current.disconnect(); } catch {}
    splitterRef.current = null;
    analyserLRef.current = null;
    analyserRRef.current = null;
    mergerRef.current = null;
    unregisterAnalysers();
  }, []);
  
  const stopAnimLoop = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);
  
  const createAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeEventListener('error', () => {});
      audioRef.current.removeEventListener('canplay', () => {});
      audioRef.current.src = '';
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
      stopAnimLoop();
      window.dispatchEvent(new CustomEvent('grooveflix-end'));
    });
    
    audio.addEventListener('play', () => {
      setIsPlaying(true);
    });
    
    audio.addEventListener('pause', () => {
      setIsPlaying(false);
    });
    
    audioRef.current = audio;
    return audio;
  }, [stopAnimLoop]);
  
  const connectSource = useCallback((audio) => {
    const ctx = audioContextRef.current;
    if (!ctx || !audio) return;
    
    if (mediaSourceRef.current) {
      try {
        mediaSourceRef.current.disconnect();
      } catch {}
    }
    
    const mediaSource = ctx.createMediaElementSource(audio);
    mediaSource.connect(stereoGainRef.current);
    mediaSourceRef.current = mediaSource;
  }, []);
  
  const loadAndPlayTrack = useCallback(async (track) => {
    if (!track || !track.audioPath) {
      console.log('[GrooveflixPlayer] No audioPath in track');
      return;
    }
    
    if (isLoadingRef.current) {
      console.log('[GrooveflixPlayer] Already loading, skipping...');
      return;
    }
    isLoadingRef.current = true;
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    
    stopAnimLoop();
    disconnectAnalysers();
    setIsPlaying(false);
    isLoadingRef.current = false;
    
    const ctx = initAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    
    const audio = createAudio();
    connectSource(audio);
    
    const url = await audioPlayer.getPresignedUrl(track.audioPath);
    if (!url) {
      console.log('[GrooveflixPlayer] Failed to get presigned URL');
      isLoadingRef.current = false;
      return;
    }
    
    audio.volume = volumeRef.current;
    audio.src = url;
    audio.load();
    
    const onCanPlay = () => {
      isLoadingRef.current = false;
      audio.play().catch(err => {
        console.log('[GrooveflixPlayer] Play error:', err);
      });
    };
    
    const onError = () => {
      if (audio.error?.code === 4) return;
      console.log('[GrooveflixPlayer] Load error:', audio.error);
      isLoadingRef.current = false;
    };
    
    audio.addEventListener('canplay', onCanPlay, { once: true });
    audio.addEventListener('error', onError, { once: true });
    
  }, [audioPlayer, initAudioContext, createAudio, connectSource, stopAnimLoop, disconnectAnalysers]);
  
  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    
    const ctx = audioContextRef.current;
    if (ctx?.state === 'suspended') {
      await ctx.resume();
    }
    
    try {
      await audio.play();
    } catch (err) {
      console.log('[GrooveflixPlayer] Play error:', err);
    }
  }, []);
  
  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
  }, []);
  
  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.pause();
    setCurrentTime(0);
  }, []);
  
  const seek = useCallback((time) => {
    const audio = audioRef.current;
    if (!audio) return;
    const clampedTime = Math.max(0, Math.min(time, duration));
    audio.currentTime = clampedTime;
    setCurrentTime(clampedTime);
  }, [duration]);
  
  const setVolume = useCallback((value) => {
    const vol = Math.max(0, Math.min(1, value));
    volumeRef.current = vol;
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
    audioPlayer.setVolume(vol);
  }, [audioPlayer]);
  
  const dispose = useCallback(() => {
    stopAnimLoop();
    disconnectAnalysers();
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    
    if (mediaSourceRef.current) {
      try {
        mediaSourceRef.current.disconnect();
      } catch {}
      mediaSourceRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    isInitializedRef.current = false;
  }, [stopAnimLoop, disconnectAnalysers]);
  
  useEffect(() => {
    return () => {
      dispose();
    };
  }, [dispose]);
  
  return {
    ...audioPlayer,
    isPlaying,
    currentTime,
    duration,
    volume: volumeRef.current,
    setVolume,
    play,
    pause,
    stop,
    seek,
    loadAndPlayTrack,
    dispose,
  };
}
