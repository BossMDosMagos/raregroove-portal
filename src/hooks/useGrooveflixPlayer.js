import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioPlayer } from '../contexts/AudioPlayerContext.jsx';
import { registerAnalysers, unregisterAnalysers } from './useGlobalAudioAnalyser.js';

let sharedAudioContext = null;
let sharedSplitter = null;
let sharedAnalyserL = null;
let sharedAnalyserR = null;
let sharedMerger = null;
let sharedStereoGain = null;

function initSharedAudioGraph() {
  if (sharedAudioContext) return sharedAudioContext;
  
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  sharedAudioContext = ctx;
  
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
  
  const stereoGain = ctx.createGain();
  stereoGain.gain.value = 1;
  sharedStereoGain = stereoGain;
  
  stereoGain.connect(splitter);
  splitter.connect(analyserL, 0);
  splitter.connect(analyserR, 1);
  analyserL.connect(merger, 0, 0);
  analyserR.connect(merger, 0, 1);
  merger.connect(ctx.destination);
  
  registerAnalysers({
    analyserL: sharedAnalyserL,
    analyserR: sharedAnalyserR,
    splitter: sharedSplitter,
    merger: sharedMerger,
  });
  
  return ctx;
}

export function useGrooveflixPlayer() {
  const audioPlayer = useAudioPlayer();
  
  const audioRef = useRef(null);
  const mediaSourceRef = useRef(null);
  const isConnectedRef = useRef(false);
  const isLoadingRef = useRef(false);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const connectMediaSource = useCallback((audio) => {
    if (isConnectedRef.current) return;
    
    const ctx = initSharedAudioGraph();
    if (!ctx || !audio) return;
    
    try {
      const mediaSource = ctx.createMediaElementSource(audio);
      mediaSource.connect(sharedStereoGain);
      mediaSourceRef.current = mediaSource;
      isConnectedRef.current = true;
    } catch (err) {
      console.log('[GrooveflixPlayer] MediaSource error:', err);
    }
  }, []);
  
  const loadAndPlayTrack = useCallback(async (track) => {
    if (!track?.audioPath) return;
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    
    const ctx = initSharedAudioGraph();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = '';
      audio.load();
    }
    
    const url = await audioPlayer.getPresignedUrl(track.audioPath);
    if (!url) {
      console.log('[GrooveflixPlayer] No URL');
      isLoadingRef.current = false;
      return;
    }
    
    const newAudio = new Audio();
    newAudio.crossOrigin = 'anonymous';
    newAudio.preload = 'metadata';
    
    newAudio.addEventListener('timeupdate', () => setCurrentTime(newAudio.currentTime));
    newAudio.addEventListener('loadedmetadata', () => setDuration(newAudio.duration));
    newAudio.addEventListener('ended', () => setIsPlaying(false));
    newAudio.addEventListener('play', () => setIsPlaying(true));
    newAudio.addEventListener('pause', () => setIsPlaying(false));
    
    newAudio.addEventListener('canplay', () => {
      connectMediaSource(newAudio);
      newAudio.volume = 0.8;
      newAudio.play().catch(console.error);
      isLoadingRef.current = false;
    }, { once: true });
    
    newAudio.addEventListener('error', () => {
      console.log('[GrooveflixPlayer] Audio error');
      isLoadingRef.current = false;
    }, { once: true });
    
    audioRef.current = newAudio;
    newAudio.src = url;
    newAudio.load();
    
  }, [audioPlayer, connectMediaSource]);
  
  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio?.src) return;
    const ctx = sharedAudioContext;
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
    if (audioRef.current) audioRef.current.volume = vol;
    audioPlayer.setVolume(vol);
  }, [audioPlayer]);
  
  const dispose = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    isConnectedRef.current = false;
    isLoadingRef.current = false;
  }, []);
  
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
  };
}
