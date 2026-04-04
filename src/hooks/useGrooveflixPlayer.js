import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioPlayer } from '../contexts/AudioPlayerContext.jsx';
import { registerAnalysers, unregisterAnalysers, resetAnalysers } from './useGlobalAudioAnalyser.js';
import { initToneFilters, getToneFilters, initEqFilters, getEqFilters, getSharedGain, getVuGainNode, applyAllSettings, loadSettings, resetAudioSettings } from './useGrooveflixSettings.js';

let audioContextInstance = null;
let sharedAnalyserL = null;
let sharedAnalyserR = null;
let sharedSplitter = null;
let sharedMerger = null;
let sharedGain = null;
let vuGainNode = null;
let connectionLogPrinted = false;

function printAudioPathDiagnostics() {
  if (connectionLogPrinted) return;
  connectionLogPrinted = true;
  
  console.log('%c🎛️ RAREGROOVE AUDIO PATH DIAGNOSTIC', 'background: #222; color: #0ff; font-size: 14px; font-weight: bold; padding: 5px;');
  
  console.log('%c─── NODE STATUS ───', 'color: #ff0');
  console.log('  audioContextInstance:', audioContextInstance ? '✅ OK' : '❌ NULL');
  console.log('  sharedAnalyserL:', sharedAnalyserL ? '✅ OK' : '❌ NULL');
  console.log('  sharedAnalyserR:', sharedAnalyserR ? '✅ OK' : '❌ NULL');
  console.log('  sharedGain:', sharedGain ? '✅ OK' : '❌ NULL');
  console.log('  vuGainNode:', vuGainNode ? '✅ OK' : '❌ NULL');
  
  if (audioContextInstance) {
    console.log('%c─── CONTEXT STATE ───', 'color: #ff0');
    console.log('  State:', audioContextInstance.state);
    console.log('  Sample Rate:', audioContextInstance.sampleRate);
    
    if (audioContextInstance.state === 'suspended') {
      console.warn('⚠️  AUDIO CONTEXT IS SUSPENDED - attempting resume...');
      audioContextInstance.resume().then(() => {
        console.log('[ AUDIO CONTEXT RESUMED ]');
      }).catch(err => {
        console.error('Failed to resume:', err);
      });
    }
  }
  
  if (vuGainNode) {
    console.log('%c─── VU SENS ───', 'color: #ff0');
    console.log('  vuGainNode.gain.value:', vuGainNode.gain.value);
    if (vuGainNode.gain.value === 0) {
      console.warn('⚠️  VU SENS ESTÁ EM ZERO (MUDO) - Audio vai chegar mas VU não vai mostrar nada!');
    }
  }
  
  console.log('%c✅ DIAGNOSTIC COMPLETE', 'color: #0f0; font-weight: bold');
}

function checkAnalyserSignal() {
  if (!sharedAnalyserL) {
    console.warn('⚠️  ANALYSER L É NULL');
    return { hasSignal: false, rms: 0 };
  }
  
  try {
    const dataArrayL = new Uint8Array(sharedAnalyserL.frequencyBinCount);
    sharedAnalyserL.getByteTimeDomainData(dataArrayL);
    
    const isSilent = dataArrayL.every(v => v === 0 || v === 128);
    
    if (isSilent) {
      console.warn('⚠️  ANALYSER L RECEBENDO SILÊNCIO TOTAL - verificar source.connect(vuGainNode)');
    }
    
    let sum = 0;
    for (let i = 0; i < dataArrayL.length; i++) {
      const v = (dataArrayL[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / dataArrayL.length);
    
    return { hasSignal: !isSilent, rms };
  } catch (e) {
    console.error('Error reading analyser:', e);
    return { hasSignal: false, rms: 0 };
  }
}

function resetAudioGraph() {
  if (audioContextInstance && audioContextInstance.state !== 'closed') {
    audioContextInstance.close().catch(() => {});
  }
  resetAudioSettings();
  resetAnalysers();
  audioContextInstance = null;
  sharedAnalyserL = null;
  sharedAnalyserR = null;
  sharedSplitter = null;
  sharedMerger = null;
  sharedGain = null;
  vuGainNode = null;
}

function initAudioGraph() {
  if (audioContextInstance && audioContextInstance.state !== 'closed') {
    return audioContextInstance;
  }
  
  resetAudioGraph();
  
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  audioContextInstance = ctx;
  
  initToneFilters(ctx);
  initEqFilters(ctx);
  
  const analyserL = ctx.createAnalyser();
  analyserL.fftSize = 2048;
  analyserL.smoothingTimeConstant = 0.8;
  sharedAnalyserL = analyserL;
  
  const analyserR = ctx.createAnalyser();
  analyserR.fftSize = 2048;
  analyserR.smoothingTimeConstant = 0.8;
  sharedAnalyserR = analyserR;
  
  const gain = getSharedGain();
  sharedGain = gain;
  
  vuGainNode = getVuGainNode();
  
  const eqFilters = getEqFilters();
  const toneFilters = getToneFilters();
  
  registerAnalysers({ analyserL, analyserR, vuGainNode });
  
  const savedSettings = loadSettings();
  applyAllSettings(savedSettings);
  
  printAudioPathDiagnostics();
  
  return ctx;
}

function connectSourceToAudioGraph(source) {
  // 1. LIMPEZA TOTAL (Obrigatório para não estourar o áudio)
  try { source.disconnect(); } catch(e) {}

  const eqFilters = getEqFilters();
  const toneFilters = getToneFilters();
  const gain = getSharedGain();
  
  // 2. ROTA DO SOM (Saída para as caixas)
  let lastNode = source;

  // Conecta Tone (Grave/Médio/Agudo)
  if (toneFilters.bass && toneFilters.mid && toneFilters.treble) {
    lastNode.connect(toneFilters.bass);
    toneFilters.bass.connect(toneFilters.mid);
    toneFilters.mid.connect(toneFilters.treble);
    lastNode = toneFilters.treble;
  }

  // Conecta Equalizador de 10 bandas
  if (eqFilters && eqFilters.length > 0) {
    lastNode.connect(eqFilters[0]);
    for (let i = 0; i < eqFilters.length - 1; i++) {
      eqFilters[i].connect(eqFilters[i + 1]);
    }
    lastNode = eqFilters[eqFilters.length - 1];
  }

  // Finaliza no Volume Master e Destination
  lastNode.connect(gain);
  gain.connect(audioContextInstance.destination);
  
  // 3. ROTA DO VU (Independente e Blindada)
  if (vuGainNode && sharedAnalyserL && sharedAnalyserR) {
    source.connect(vuGainNode);
    
    // Separador de Canais para VU Independente (L e R reais)
    const splitter = audioContextInstance.createChannelSplitter(2);
    vuGainNode.connect(splitter);
    
    splitter.connect(sharedAnalyserL, 0); // Canal Esquerdo no VU L
    splitter.connect(sharedAnalyserR, 1); // Canal Direito no VU R
    
    console.log("✅ VUs Conectados e Calibrados!");
    console.log("  - vuGainNode:", vuGainNode);
    console.log("  - sharedAnalyserL:", sharedAnalyserL);
    console.log("  - sharedAnalyserR:", sharedAnalyserR);
    console.log("  - source:", source);
  } else {
    console.log("❌ VUs NÃO conectados! Verificar:");
    console.log("  - vuGainNode:", vuGainNode);
    console.log("  - sharedAnalyserL:", sharedAnalyserL);
    console.log("  - sharedAnalyserR:", sharedAnalyserR);
  }
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
  
  useEffect(() => {
    const handleBeforeUnload = () => {
      resetAudioGraph();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
  
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
      connectSourceToAudioGraph(mediaSource);
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
    const gainNode = getSharedGain();
    if (gainNode) {
      gainNode.gain.setTargetAtTime(vol, audioContextInstance?.currentTime || 0, 0.01);
    }
    audioPlayer.setVolume(vol);
  }, [audioPlayer]);
  
  const dispose = useCallback(() => {
    stopAudio();
    unregisterAnalysers();
    resetAudioGraph();
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

// DEBUG FUNCTIONS - Access via window.RareGrooveDebug
window.RareGrooveDebug = {
  printDiagnostics: printAudioPathDiagnostics,
  checkSignal: checkAnalyserSignal,
  getNodes: () => ({
    audioContext: audioContextInstance,
    analyserL: sharedAnalyserL,
    analyserR: sharedAnalyserR,
    vuGainNode: vuGainNode,
    gain: sharedGain,
  }),
  forceResumeContext: async () => {
    if (audioContextInstance && audioContextInstance.state === 'suspended') {
      await audioContextInstance.resume();
      console.log('[ AUDIO CONTEXT RESUMED ]');
    }
  },
  setVuSensitivity: (value) => {
    if (vuGainNode) {
      vuGainNode.gain.value = value;
      console.log('VU SENS set to:', value);
    }
  },
};
