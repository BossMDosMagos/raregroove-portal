import { useCallback, useEffect, useRef, useState } from 'react';
import { Howler } from 'howler';
import { useAudioPlayer } from '../contexts/AudioPlayerContext.jsx';
import { registerAnalysers, unregisterAnalysers } from './useGlobalAudioAnalyser.js';

let state = {
  sound: null,
  analyserL: null,
  analyserR: null,
  splitter: null,
  merger: null,
  dataL: null,
  dataR: null,
  animFrameId: null,
  isPlaying: false,
};

export function useGrooveflixPlayer() {
  const audioPlayer = useAudioPlayer();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const ensureContextRunning = useCallback(async () => {
    const ctx = Howler.ctx;
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch { return false; }
    }
    return ctx.state === 'running';
  }, []);
  
  const disconnectAnalysers = useCallback(() => {
    try { if (state.splitter) state.splitter.disconnect(); } catch {}
    try { if (state.analyserL) state.analyserL.disconnect(); } catch {}
    try { if (state.analyserR) state.analyserR.disconnect(); } catch {}
    try { if (state.merger) state.merger.disconnect(); } catch {}
    state.splitter = null;
    state.analyserL = null;
    state.analyserR = null;
    state.merger = null;
    state.dataL = null;
    state.dataR = null;
    unregisterAnalysers();
  }, []);
  
  const stopAnimLoop = useCallback(() => {
    if (state.animFrameId !== null) {
      cancelAnimationFrame(state.animFrameId);
      state.animFrameId = null;
    }
  }, []);
  
  const connectAnalysers = useCallback(() => {
    const ctx = Howler.ctx;
    if (!ctx) { console.error('[Player] Howler.ctx indisponível'); return; }
    
    disconnectAnalysers();
    
    const FFT_SIZE = 2048;
    
    state.splitter = ctx.createChannelSplitter(2);
    
    state.analyserL = ctx.createAnalyser();
    state.analyserL.fftSize = FFT_SIZE;
    state.analyserL.smoothingTimeConstant = 0.8;
    state.dataL = new Uint8Array(state.analyserL.frequencyBinCount);
    
    state.analyserR = ctx.createAnalyser();
    state.analyserR.fftSize = FFT_SIZE;
    state.analyserR.smoothingTimeConstant = 0.8;
    state.dataR = new Uint8Array(state.analyserR.frequencyBinCount);
    
    state.merger = ctx.createChannelMerger(2);
    
    Howler.masterGain.connect(state.splitter);
    
    state.splitter.connect(state.analyserL, 0);
    state.splitter.connect(state.analyserR, 1);
    
    state.analyserL.connect(state.merger, 0, 0);
    state.analyserR.connect(state.merger, 0, 1);
    
    state.merger.connect(ctx.destination);
    
    registerAnalysers({
      analyserL: state.analyserL,
      analyserR: state.analyserR,
      splitter: state.splitter,
      merger: state.merger,
    });
    
    console.log('[Player] Analysers conectados. ctx.state =', ctx.state);
  }, [disconnectAnalysers]);
  
  const animLoop = useCallback(async () => {
    stopAnimLoop();
    
    const ctxOk = await ensureContextRunning();
    if (!ctxOk || !state.analyserL || !state.analyserR) {
      if (state.isPlaying) {
        state.animFrameId = requestAnimationFrame(animLoop);
      }
      return;
    }
    
    if (state.isPlaying) {
      state.animFrameId = requestAnimationFrame(animLoop);
    }
  }, [stopAnimLoop, ensureContextRunning]);
  
  const loadAndPlayTrack = useCallback(async (track) => {
    if (!track?.audioPath) return;
    
    if (state.sound) {
      state.sound.stop();
      state.sound.unload();
      state.sound = null;
    }
    
    stopAnimLoop();
    disconnectAnalysers();
    state.isPlaying = false;
    setIsPlaying(false);
    
    Howler.autoSuspend = false;
    Howler.volume(0.8);
    
    const url = await audioPlayer.getPresignedUrl(track.audioPath);
    if (!url) {
      console.log('[Player] Sem URL');
      return;
    }
    
    state.sound = new Howl({
      src: [url],
      html5: false,
      format: ['mp3', 'flac', 'wav'],
      volume: 0.8,
      preload: true,
      
      onload: () => {
        setDuration(state.sound.duration());
        connectAnalysers();
        state.sound.play();
      },
      
      onloaderror: (id, err) => {
        console.error('[Player] Load error:', err);
      },
      
      onplay: () => {
        state.isPlaying = true;
        setIsPlaying(true);
        stopAnimLoop();
        ensureContextRunning();
        state.animFrameId = requestAnimationFrame(animLoop);
      },
      
      onpause: () => {
        state.isPlaying = false;
        setIsPlaying(false);
        stopAnimLoop();
      },
      
      onstop: () => {
        state.isPlaying = false;
        setIsPlaying(false);
        stopAnimLoop();
      },
      
      onend: () => {
        state.isPlaying = false;
        setIsPlaying(false);
        stopAnimLoop();
      },
      
      onplayerror: (id, err) => {
        console.error('[Player] Play error:', err);
        Howler.ctx?.resume().then(() => state.sound?.play());
      },
    });
    
  }, [audioPlayer, connectAnalysers, disconnectAnalysers, stopAnimLoop, ensureContextRunning, animLoop]);
  
  const play = useCallback(async () => {
    if (!state.sound) return;
    await ensureContextRunning();
    state.sound.play();
  }, [ensureContextRunning]);
  
  const pause = useCallback(() => {
    if (!state.sound) return;
    state.sound.pause();
  }, []);
  
  const stop = useCallback(() => {
    if (!state.sound) return;
    state.sound.stop();
  }, []);
  
  const seek = useCallback((time) => {
    if (!state.sound) return;
    state.sound.seek(time);
    setCurrentTime(time);
  }, []);
  
  const setVolume = useCallback((value) => {
    const vol = Math.max(0, Math.min(1, value));
    Howler.volume(vol);
    audioPlayer.setVolume(vol);
  }, [audioPlayer]);
  
  const dispose = useCallback(() => {
    stopAnimLoop();
    if (state.sound) {
      state.sound.stop();
      state.sound.unload();
      state.sound = null;
    }
    disconnectAnalysers();
    state.isPlaying = false;
  }, [stopAnimLoop, disconnectAnalysers]);
  
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
