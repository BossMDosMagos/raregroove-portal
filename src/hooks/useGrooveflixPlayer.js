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
  
  const volumeRef = useRef(0.8);
  const isInitializedRef = useRef(false);
  const isLoadingRef = useRef(false);
  const sourceConnectedRef = useRef(false);
  const blobUrlRef = useRef(null);
  
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
    try { splitterRef.current?.disconnect(); } catch {}
    try { analyserLRef.current?.disconnect(); } catch {}
    try { analyserRRef.current?.disconnect(); } catch {}
    try { mergerRef.current?.disconnect(); } catch {}
    splitterRef.current = null;
    analyserLRef.current = null;
    analyserRRef.current = null;
    mergerRef.current = null;
    unregisterAnalysers();
  }, []);
  
  const connectMediaSource = useCallback(() => {
    const ctx = audioContextRef.current;
    const audio = audioRef.current;
    
    if (!ctx || !audio || sourceConnectedRef.current) return;
    
    try { mediaSourceRef.current?.disconnect(); } catch {}
    
    const mediaSource = ctx.createMediaElementSource(audio);
    mediaSource.connect(stereoGainRef.current);
    mediaSourceRef.current = mediaSource;
    sourceConnectedRef.current = true;
  }, []);
  
  const loadAndPlayTrack = useCallback(async (track) => {
    if (!track?.audioPath) return;
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    
    disconnectAnalysers();
    setIsPlaying(false);
    isLoadingRef.current = false;
    sourceConnectedRef.current = false;
    
    const ctx = initAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    
    const url = await audioPlayer.getPresignedUrl(track.audioPath);
    if (!url) {
      console.log('[GrooveflixPlayer] No URL');
      isLoadingRef.current = false;
      return;
    }
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Fetch failed');
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      blobUrlRef.current = blobUrl;
      
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.preload = 'metadata';
      
      audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime));
      audio.addEventListener('loadedmetadata', () => setDuration(audio.duration));
      audio.addEventListener('ended', () => {
        setIsPlaying(false);
      });
      audio.addEventListener('play', () => setIsPlaying(true));
      audio.addEventListener('pause', () => setIsPlaying(false));
      
      audioRef.current = audio;
      
      audio.addEventListener('canplay', () => {
        connectMediaSource();
        audio.volume = volumeRef.current;
        audio.play().catch(console.error);
        isLoadingRef.current = false;
      }, { once: true });
      
      audio.addEventListener('error', () => {
        console.log('[GrooveflixPlayer] Audio error');
        isLoadingRef.current = false;
      }, { once: true });
      
      audio.src = blobUrl;
      audio.load();
      
    } catch (err) {
      console.log('[GrooveflixPlayer] Fetch error:', err);
      isLoadingRef.current = false;
    }
    
  }, [audioPlayer, initAudioContext, connectMediaSource, disconnectAnalysers]);
  
  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio?.src) return;
    const ctx = audioContextRef.current;
    if (ctx?.state === 'suspended') await ctx.resume();
    try { await audio.play(); } catch (err) { console.error(err); }
  }, []);
  
  const pause = useCallback(() => {
    audioRef.current?.pause();
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
    audio.currentTime = Math.max(0, Math.min(time, duration));
    setCurrentTime(audio.currentTime);
  }, [duration]);
  
  const setVolume = useCallback((value) => {
    const vol = Math.max(0, Math.min(1, value));
    volumeRef.current = vol;
    if (audioRef.current) audioRef.current.volume = vol;
    audioPlayer.setVolume(vol);
  }, [audioPlayer]);
  
  const dispose = useCallback(() => {
    disconnectAnalysers();
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    
    try { mediaSourceRef.current?.disconnect(); } catch {}
    mediaSourceRef.current = null;
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    isInitializedRef.current = false;
    sourceConnectedRef.current = false;
  }, [disconnectAnalysers]);
  
  useEffect(() => {
    return () => { dispose(); };
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
