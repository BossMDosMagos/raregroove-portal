import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioPlayer } from '../contexts/AudioPlayerContext.jsx';
import { initAudioAnalysers, getAnalysers, connectToAnalysers, resetAnalysers } from './useGlobalAudioAnalyser.js';
import { initToneFilters, getToneFilters, initEqFilters, getEqFilters, getSharedGain, applyAllSettings, loadSettings, resetAudioSettings } from './useGrooveflixSettings.js';

let audioContextInstance = null;
let sharedGain = null;
let connectionLogPrinted = false;

function printAudioPathDiagnostics() {
  if (connectionLogPrinted) return;
  connectionLogPrinted = true;
  
  console.log('%c🎛️ RAREGROOVE AUDIO PATH DIAGNOSTIC', 'background: #222; color: #0ff; font-size: 14px; font-weight: bold; padding: 5px;');
  
  const { analyserL, analyserR, vuGainNode: vg } = getAnalysers();
  
  console.log('%c─── NODE STATUS ───', 'color: #ff0');
  console.log('  audioContextInstance:', audioContextInstance ? '✅ OK' : '❌ NULL');
  console.log('  analyserL (from getAnalysers):', analyserL ? '✅ OK' : '❌ NULL');
  console.log('  analyserR (from getAnalysers):', analyserR ? '✅ OK' : '❌ NULL');
  console.log('  sharedGain:', sharedGain ? '✅ OK' : '❌ NULL');
  console.log('  vuGainNode:', vg ? '✅ OK' : '❌ NULL');
  
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
  
  if (vg) {
    console.log('%c─── VU SENS ───', 'color: #ff0');
    console.log('  vuGainNode.gain.value:', vg.gain.value);
    if (vg.gain.value === 0) {
      console.warn('⚠️  VU SENS ESTÁ EM ZERO (MUDO)');
    }
  }
  
  console.log('%c✅ DIAGNOSTIC COMPLETE', 'color: #0f0; font-weight: bold');
}

function checkAnalyserSignal() {
  const { analyserL } = getAnalysers();
  
  if (!analyserL) {
    console.warn('⚠️  ANALYSER L É NULL (via getAnalysers)');
    return { hasSignal: false, rms: 0 };
  }
  
  try {
    const dataArrayL = new Uint8Array(analyserL.frequencyBinCount);
    analyserL.getByteTimeDomainData(dataArrayL);
    
    const isSilent = dataArrayL.every(v => v === 0 || v === 128);
    
    if (isSilent) {
      console.warn('⚠️  ANALYSER L RECEBENDO SILÊNCIO TOTAL');
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
  sharedGain = null;
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
  
  const gain = getSharedGain();
  sharedGain = gain;
  
  initAudioAnalysers(ctx, gain);
  
  const savedSettings = loadSettings();
  applyAllSettings(savedSettings);
  
  printAudioPathDiagnostics();
  
  return ctx;
}

function connectSourceToAudioGraph(source) {
  // 1. LIMPEZA TOTAL
  try { source.disconnect(); } catch(e) {}

  const eqFilters = getEqFilters();
  const toneFilters = getToneFilters();
  const gain = getSharedGain();
  
  // 2. ROTA DO SOM (Saída para as caixas)
  let lastNode = source;

  if (toneFilters.bass && toneFilters.mid && toneFilters.treble) {
    lastNode.connect(toneFilters.bass);
    toneFilters.bass.connect(toneFilters.mid);
    toneFilters.mid.connect(toneFilters.treble);
    lastNode = toneFilters.treble;
  }

  if (eqFilters && eqFilters.length > 0) {
    lastNode.connect(eqFilters[0]);
    for (let i = 0; i < eqFilters.length - 1; i++) {
      eqFilters[i].connect(eqFilters[i + 1]);
    }
    lastNode = eqFilters[eqFilters.length - 1];
  }

  lastNode.connect(gain);
  gain.connect(audioContextInstance.destination);
  
  // 3. ROTA DO VU - conecta source no Analyser do useGlobalAudioAnalyser
  const connected = connectToAnalysers(source);
  if (connected) {
    const { analyserL, analyserR, vuGainNode: vg } = getAnalysers();
    console.log("✅ VUs Conectados!");
    console.log("  - analyserL:", analyserL ? 'OK' : 'NULL');
    console.log("  - analyserR:", analyserR ? 'OK' : 'NULL');
    console.log("  - vuGainNode:", vg ? 'OK' : 'NULL');
  } else {
    console.error("❌ Falha ao conectar VUs!");
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
  const [queue, setQueue] = useState([]);
  
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
    console.log('[DEBUG] connectMediaSource called');
    console.log('[DEBUG] isConnectedRef.current:', isConnectedRef.current);
    console.log('[DEBUG] audioContextInstance:', audioContextInstance ? 'OK' : 'NULL');
    console.log('[DEBUG] audioElement:', audioElement ? 'OK' : 'NULL');
    
    if (isConnectedRef.current || !audioContextInstance || !audioElement) {
      console.log('[DEBUG] connectMediaSource: early return');
      return;
    }
    
    try {
      if (mediaSourceRef.current) {
        mediaSourceRef.current.disconnect();
      }
      
      const mediaSource = audioContextInstance.createMediaElementSource(audioElement);
      console.log('[DEBUG] MediaElementSource created:', mediaSource ? 'OK' : 'NULL');
      console.log('[DEBUG] MediaElementSource channelCount:', mediaSource.channelCount);
      
      connectSourceToAudioGraph(mediaSource);
      mediaSourceRef.current = mediaSource;
      isConnectedRef.current = true;
      console.log('[DEBUG] Source connected successfully');
    } catch (err) {
      console.error('[DEBUG] connectMediaSource error:', err);
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
    console.log('===========================================');
    console.log('[Player] loadAndPlayTrack called');
    console.log('[Player] track.title:', track?.title);
    console.log('[Player] track.audioPath:', track?.audioPath);
    console.log('[Player] track.id:', track?.id);
    console.log('===========================================');
    
    if (!track?.audioPath) {
      console.error('[Player] ERROR: No audioPath in track!');
      return;
    }
    
    const trackId = track.id;
    pendingTrackIdRef.current = trackId;
    
    if (audioElementRef.current && currentTrackIdRef.current === trackId) {
      console.log('[Player] Track already loaded, skipping');
      return;
    }
    
    console.log('[Player] Stopping previous audio...');
    stopAudio();
    setCurrentTime(0);
    setDuration(0);
    
    console.log('[Player] Initializing audio context...');
    const ctx = initAudioGraph();
    console.log('[Player] AudioContext state:', ctx.state);
    
    if (ctx.state === 'suspended') {
      console.log('[Player] Resuming suspended AudioContext...');
      await ctx.resume();
      console.log('[Player] AudioContext resumed, state:', ctx.state);
    }
    
    console.log('[Player] Getting presigned URL for:', track.audioPath);
    const url = await audioPlayer.getPresignedUrl(track.audioPath);
    console.log('[Player] Got URL:', url ? url.substring(0, 80) + '...' : 'NULL');
    
    if (!url) {
      console.error('[Player] ERROR: Could not get audio URL!');
      return;
    }
    
    if (pendingTrackIdRef.current !== trackId) {
      console.log('[Player] Track changed during URL fetch, skipping');
      return;
    }
    
    console.log('[Player] Creating new Audio element...');
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'metadata';
    
    const onTimeUpdate = () => {
      if (currentTrackIdRef.current === trackId) {
        setCurrentTime(audio.currentTime);
      }
    };
    
    const onLoadedMetadata = () => {
      console.log('[Player] Metadata loaded! duration:', audio.duration);
      if (currentTrackIdRef.current === trackId) {
        setDuration(audio.duration);
      }
    };
    
    const onEnded = () => {
      console.log('[Player] Track ended');
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
      console.log('[Player] onPlay fired! isPlaying should be true');
      if (currentTrackIdRef.current === trackId) {
        setIsPlaying(true);
        console.log('[Player] Calling connectMediaSource...');
        connectMediaSource(audio);
      }
    };
    
    const onPause = () => {
      console.log('[Player] onPause fired');
      if (currentTrackIdRef.current === trackId) {
        setIsPlaying(false);
      }
    };
    
    const onError = (e) => {
      if (!audio.src || audio.src === '') {
        return;
      }
      console.error('===========================================');
      console.error('[Player] AUDIO ERROR:', e);
      console.error('[Player] audio.error:', audio.error);
      console.error('[Player] audio.src:', audio.src);
      console.error('===========================================');
    };
    
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);
    
    currentTrackIdRef.current = trackId;
    audioElementRef.current = audio;
    audio.src = url;
    
    console.log('[Player] Calling audio.play()...');
    try {
      await audio.play();
      console.log('[Player] audio.play() succeeded!');
    } catch (err) {
      console.error('===========================================');
      console.error('[Player] ERRO DE AUDIO:', err);
      console.error('[Player] Error name:', err.name);
      console.error('[Player] Error message:', err.message);
      console.error('===========================================');
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
  
  const playAlbum = useCallback(async (album, startIndex = 0) => {
    console.log('===========================================');
    console.log('[Player] playAlbum called');
    console.log('[Player] album.title:', album?.title);
    console.log('[Player] album.id:', album?.id);
    console.log('[Player] startIndex:', startIndex);
    console.log('[Player] album.audio_files:', album?.audio_files?.length);
    console.log('[Player] album.tracklist:', album?.tracklist?.length);
    console.log('===========================================');
    
    let audioFiles = album?.audio_files || [];
    let tracklist = album?.tracklist || [];
    
    if (audioFiles.length === 0) {
      audioFiles = album?.metadata?.grooveflix?.audio_files || [];
      console.log('[Player] Trying metadata.grooveflix.audio_files:', audioFiles.length);
    }
    
    if (tracklist.length === 0) {
      tracklist = album?.metadata?.grooveflix?.tracklist || [];
      console.log('[Player] Trying metadata.grooveflix.tracklist:', tracklist.length);
    }
    
    if (audioFiles.length === 0) {
      console.error('[Player] Album has no audio files');
      console.error('[Player] album:', JSON.stringify(album, null, 2).substring(0, 500));
      return;
    }
    
    const tracks = audioFiles.map((file, idx) => {
      const trackInfo = tracklist[idx] || {};
      console.log('[Player] Track', idx, '- file:', file, '| path:', file?.path);
      return {
        id: `${album.id}-${idx}`,
        title: trackInfo.title || `Track ${idx + 1}`,
        artist: album.artist || 'Unknown',
        audioPath: file?.path || file,
        albumId: album.id,
        albumTitle: album.title,
        coverUrl: album.coverUrl || album.image_url || album.cover_path,
        trackIndex: idx,
      };
    });
    
    console.log('[Player] Built', tracks.length, 'tracks');
    console.log('[Player] Track at index', startIndex, ':', tracks[startIndex]?.title, '| audioPath:', tracks[startIndex]?.audioPath);
    
    setQueue(tracks);
    
    if (startIndex >= 0 && startIndex < tracks.length) {
      const track = tracks[startIndex];
      console.log('[Player] Calling loadAndPlayTrack for:', track.title, '| audioPath:', track.audioPath);
      currentTrackIdRef.current = track.id;
      await loadAndPlayTrack(track);
    }
    console.log('===========================================');
  }, [loadAndPlayTrack]);
  
  const playTrackFromQueue = useCallback(async (track) => {
    if (!track) return;
    console.log('[Player] playTrackFromQueue:', track.title);
    currentTrackIdRef.current = track.id;
    await loadAndPlayTrack(track);
  }, [loadAndPlayTrack]);
  
  const clearQueue = useCallback(() => {
    setQueue([]);
    stopAudio();
  }, [stopAudio]);
  
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
    playAlbum,
    playTrackFromQueue,
    clearQueue,
    dispose,
    queue,
  };
}

// DEBUG FUNCTIONS - Access via window.RareGrooveDebug
window.RareGrooveDebug = {
  printDiagnostics: printAudioPathDiagnostics,
  checkSignal: checkAnalyserSignal,
  getNodes: () => ({
    audioContext: audioContextInstance,
    ...getAnalysers(),
    gain: sharedGain,
  }),
  forceResumeContext: async () => {
    if (audioContextInstance && audioContextInstance.state === 'suspended') {
      await audioContextInstance.resume();
      console.log('[ AUDIO CONTEXT RESUMED ]');
    }
  },
  setVuSensitivity: (value) => {
    const { vuGainNode: vg } = getAnalysers();
    if (vg) {
      vg.gain.value = value;
      console.log('VU SENS set to:', value);
    }
  },
};
