import { useCallback, useEffect, useRef } from 'react';
import { Howler, Howl } from 'howler';
import { useAudioPlayer } from '../contexts/AudioPlayerContext.jsx';
import { registerAnalysers, unregisterAnalysers } from './useGlobalAudioAnalyser.js';

const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export function useGrooveflixPlayer() {
  const audioPlayer = useAudioPlayer();
  
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
  
  const analyserDataRef = useRef(new Uint8Array(128));
  const timeDomainDataRef = useRef(new Float32Array(256));
  const spectrumLRef = useRef(new Uint8Array(64));
  const spectrumRRef = useRef(new Uint8Array(64));
  const bassDataLRef = useRef(new Uint8Array(8));
  const bassDataRRef = useRef(new Uint8Array(8));
  
  const volumeRef = useRef(0.8);
  const isInitializedRef = useRef(false);
  
  const calculateRMS = useCallback((data) => {
    if (!data || data.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / data.length);
  }, []);
  
  const ensureContextRunning = useCallback(async () => {
    const ctx = Howler.ctx;
    if (!ctx) return false;
    if (ctx.state === 'closed') return false;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return false;
      }
    }
    return ctx.state === 'running';
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
    dataLRef.current = null;
    dataRRef.current = null;
    isConnectedRef.current = false;
    unregisterAnalysers();
  }, []);
  
  const connectAnalysers = useCallback(() => {
    const ctx = Howler.ctx;
    if (!ctx) return;
    
    disconnectAnalysers();
    
    const FFT_SIZE = 4096;
    
    splitterRef.current = ctx.createChannelSplitter(2);
    
    analyserLRef.current = ctx.createAnalyser();
    analyserLRef.current.fftSize = FFT_SIZE;
    analyserLRef.current.smoothingTimeConstant = 0.92;
    dataLRef.current = new Uint8Array(analyserLRef.current.frequencyBinCount);
    
    analyserRRef.current = ctx.createAnalyser();
    analyserRRef.current.fftSize = FFT_SIZE;
    analyserRRef.current.smoothingTimeConstant = 0.92;
    dataRRef.current = new Uint8Array(analyserRRef.current.frequencyBinCount);
    
    mergerRef.current = ctx.createChannelMerger(2);
    
    Howler.masterGain.connect(splitterRef.current);
    
    splitterRef.current.connect(analyserLRef.current, 0);
    splitterRef.current.connect(analyserRRef.current, 1);
    
    analyserLRef.current.connect(mergerRef.current, 0, 0);
    analyserRRef.current.connect(mergerRef.current, 0, 1);
    
    mergerRef.current.connect(ctx.destination);
    
    isConnectedRef.current = true;
    
    registerAnalysers({
      analyserL: analyserLRef.current,
      analyserR: analyserRRef.current,
      splitter: splitterRef.current,
      merger: mergerRef.current,
    });
  }, [disconnectAnalysers]);
  
  const stopAnimLoop = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);
  
  const animLoop = useCallback(() => {
    stopAnimLoop();
    
    const ctx = Howler.ctx;
    const ctxOk = ctx && ctx.state === 'running' && analyserLRef.current && analyserRRef.current;
    
    if (ctxOk) {
      try {
        analyserLRef.current.getByteTimeDomainData(dataLRef.current);
        analyserRRef.current.getByteTimeDomainData(dataRRef.current);
        
        const freqL = new Uint8Array(analyserLRef.current.frequencyBinCount);
        const freqR = new Uint8Array(analyserRRef.current.frequencyBinCount);
        analyserLRef.current.getByteFrequencyData(freqL);
        analyserRRef.current.getByteFrequencyData(freqR);
        
        const combinedFreq = new Uint8Array(freqL.length);
        for (let i = 0; i < combinedFreq.length; i++) {
          combinedFreq[i] = Math.max(freqL[i], freqR[i]);
        }
        analyserDataRef.current = combinedFreq;
        
        const reducedL = new Uint8Array(64);
        const reducedR = new Uint8Array(64);
        const stepL = Math.floor(freqL.length / 64);
        const stepR = Math.floor(freqR.length / 64);
        for (let i = 0; i < 64; i++) {
          reducedL[i] = freqL[i * stepL] || 0;
          reducedR[i] = freqR[i * stepR] || 0;
        }
        spectrumLRef.current = reducedL;
        spectrumRRef.current = reducedR;
        
        const bassL = new Uint8Array(8);
        const bassR = new Uint8Array(8);
        for (let i = 0; i < 8; i++) {
          bassL[i] = freqL[i] || 0;
          bassR[i] = freqR[i] || 0;
        }
        bassDataLRef.current = bassL;
        bassDataRRef.current = bassR;
        
        const combinedTime = new Float32Array(dataLRef.current.length + dataRRef.current.length);
        combinedTime.set(dataLRef.current, 0);
        combinedTime.set(dataRRef.current, dataLRef.current.length);
        timeDomainDataRef.current = combinedTime;
      } catch (e) {
        console.log('[GrooveflixPlayer] Analyser read error:', e.message);
      }
    }
    
    if (isPlayingRef.current) {
      animFrameRef.current = requestAnimationFrame(animLoop);
    }
  }, [stopAnimLoop]);
  
  const initAudioContext = useCallback(() => {
    if (isInitializedRef.current) return;
    
    Howler.autoSuspend = false;
    Howler.volume(volumeRef.current);
    
    const ctx = Howler.ctx;
    if (!ctx) return;
    
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    
    isInitializedRef.current = true;
  }, []);
  
  const isLoadingRef = useRef(false);
  
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
    
    if (howlRef.current) {
      howlRef.current.stop();
      howlRef.current.unload();
      howlRef.current = null;
    }
    
    stopAnimLoop();
    disconnectAnalysers();
    isPlayingRef.current = false;
    audioPlayer.setIsPlaying(false);
    
    initAudioContext();
    
    const ctx = Howler.ctx;
    if (ctx?.state === 'suspended') {
      await ctx.resume();
    }
    
    const url = await audioPlayer.getPresignedUrl(track.audioPath);
    if (!url) {
      console.log('[GrooveflixPlayer] Failed to get presigned URL');
      isLoadingRef.current = false;
      return;
    }
    
    const ext = track.audioPath.split('.').pop()?.toLowerCase() || 'mp3';
    const format = ext === 'flac' ? ['flac'] : ext === 'wav' ? ['wav'] : ext === 'ogg' ? ['ogg'] : ext === 'm4a' ? ['m4a'] : ['mp3'];
    
    const howl = new Howl({
      src: [url],
      html5: false,
      format: format,
      xhr: { method: 'GET', withCredentials: false },
      volume: volumeRef.current,
      loop: false,
      pool: 1,
      autoplay: true,
      preload: true,
      onload: () => {
        connectAnalysers();
        window.dispatchEvent(new CustomEvent('grooveflix-track-loaded'));
      },
      onplay: () => {
        audioPlayer.setIsPlaying(true);
        isPlayingRef.current = true;
        
        ensureContextRunning();
        stopAnimLoop();
        animFrameRef.current = requestAnimationFrame(animLoop);
        
        window.dispatchEvent(new CustomEvent('grooveflix-play'));
      },
      onpause: () => {
        audioPlayer.setIsPlaying(false);
        isPlayingRef.current = false;
        stopAnimLoop();
        window.dispatchEvent(new CustomEvent('grooveflix-pause'));
      },
      onstop: () => {
        audioPlayer.setIsPlaying(false);
        isPlayingRef.current = false;
        stopAnimLoop();
        window.dispatchEvent(new CustomEvent('grooveflix-stop'));
      },
      onend: () => {
        audioPlayer.setIsPlaying(false);
        isPlayingRef.current = false;
        stopAnimLoop();
        window.dispatchEvent(new CustomEvent('grooveflix-end'));
      },
      onloaderror: (id, err) => {
        console.log('[GrooveflixPlayer] Load error:', err);
        isLoadingRef.current = false;
      },
      onplayerror: (id, err) => {
        console.log('[GrooveflixPlayer] Play error:', err);
        isLoadingRef.current = false;
        Howler.ctx?.resume().then(() => howl?.play());
      },
    });
    
    howlRef.current = howl;
    isLoadingRef.current = false;
  }, [audioPlayer, initAudioContext, ensureContextRunning, stopAnimLoop, animLoop, connectAnalysers, disconnectAnalysers]);
  
  const play = useCallback(async () => {
    const ctx = Howler.ctx;
    if (ctx?.state === 'suspended') {
      await ctx.resume();
    }
    
    if (howlRef.current) {
      howlRef.current.play();
    }
  }, []);
  
  const pause = useCallback(() => {
    if (!howlRef.current) return;
    howlRef.current.pause();
  }, []);
  
  const stop = useCallback(() => {
    if (!howlRef.current) return;
    howlRef.current.stop();
  }, []);
  
  const seek = useCallback((time) => {
    if (!howlRef.current) return;
    howlRef.current.seek(time);
  }, []);
  
  const setVolume = useCallback((value) => {
    const vol = Math.max(0, Math.min(1, value));
    volumeRef.current = vol;
    Howler.volume(vol);
    audioPlayer.setVolume(vol);
  }, [audioPlayer]);
  
  const dispose = useCallback(() => {
    isPlayingRef.current = false;
    stopAnimLoop();
    disconnectAnalysers();
    if (howlRef.current) {
      howlRef.current.unload();
      howlRef.current = null;
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
    volume: volumeRef.current,
    setVolume,
    play,
    pause,
    stop,
    seek,
    loadAndPlayTrack,
    analyserData: analyserDataRef.current,
    timeDomainData: timeDomainDataRef.current,
    spectrumL: spectrumLRef.current,
    spectrumR: spectrumRRef.current,
    bassDataL: bassDataLRef.current,
    bassDataR: bassDataRRef.current,
    dispose,
  };
}
