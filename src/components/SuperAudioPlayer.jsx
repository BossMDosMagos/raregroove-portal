import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Square,
  Repeat, Repeat1, Shuffle, Disc3, Minus
} from 'lucide-react';
import { useAudioEngine, ANSI } from '../hooks/useAudioEngine';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { VUMeter } from './VUMeter';
import { AudioControlsPanel } from './AudioControlsPanel';
import KnobPanel from './KnobPanel';

const EQ_PRESETS = {
  Flat: { preAmp: 0, bands: { 32: 0, 64: 0, 125: 0, 250: 0, 500: 0, 1000: 0, 2000: 0, 4000: 0, 8000: 0, 16000: 0 } },
  Rock: { preAmp: 2, bands: { 32: 5, 64: 4, 125: 3, 250: 1, 500: -1, 1000: 0, 2000: 2, 4000: 4, 8000: 5, 16000: 5 } },
  Jazz: { preAmp: 1, bands: { 32: 3, 64: 2, 125: 1, 250: 0, 500: 0, 1000: 1, 2000: 2, 4000: 3, 8000: 2, 16000: 3 } },
  Electronic: { preAmp: 3, bands: { 32: 6, 64: 5, 125: 4, 250: 2, 500: 0, 1000: -1, 2000: 1, 4000: 3, 8000: 5, 16000: 6 } },
  Pop: { preAmp: 2, bands: { 32: -1, 64: 0, 125: 2, 250: 4, 500: 5, 1000: 4, 2000: 2, 4000: 1, 8000: 2, 16000: 3 } },
  Classical: { preAmp: 1, bands: { 32: 3, 64: 2, 125: 2, 250: 1, 500: 0, 1000: 0, 2000: 1, 4000: 2, 8000: 3, 16000: 4 } },
  BassBoost: { preAmp: 4, bands: { 32: 8, 64: 7, 125: 6, 250: 4, 500: 2, 1000: 0, 2000: 0, 4000: 0, 8000: 0, 16000: 0 } },
  Acoustic: { preAmp: 1, bands: { 32: 3, 64: 2, 125: 1, 250: 1, 500: 0, 1000: 1, 2000: 2, 4000: 3, 8000: 3, 16000: 2 } },
};

export function SuperAudioPlayer() {
  const [currentPath, setCurrentPath] = useState('/');

  useEffect(() => {
    setCurrentPath(window.location.pathname);
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    const originalPushState = window.history.pushState;
    window.history.pushState = (...args) => {
      originalPushState.apply(window.history, args);
      setCurrentPath(window.location.pathname);
    };
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.history.pushState = originalPushState;
    };
  }, []);

  const isGrooveflix = currentPath === '/grooveflix';

  const {
    currentTrack,
    queue,
    userId,
    setCurrentTrack,
    isPlaying: globalIsPlaying,
    setIsPlaying: setGlobalIsPlaying,
    getPresignedUrl,
    expandAlbumTracks,
  } = useAudioPlayer();

  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [trackUrls, setTrackUrls] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [debug, setDebug] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('Flat');
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [showEq, setShowEq] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    pan,
    preAmp,
    eqBands,
    loopMode,
    shuffle,
    isReady,
    analyserData,
    timeDomainData,
    eqFrequencies,
    vuMeterData,
    spectrumL,
    spectrumR,
    loadTrack,
    play,
    pause,
    stop,
    seek,
    setVolume,
    setPan,
    setPreAmp,
    setEqBand,
    toggleLoop,
    toggleShuffle,
    getNextTrack,
    getPrevTrack,
    initAudioContext,
  } = useAudioEngine();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    };
    checkAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });
    
    return () => subscription.unsubscribe();
  }, []);

  const hydrateAndPlayRef = useRef(null);

  const hydrateAndPlay = useCallback(async (index) => {
    if (index < 0 || index >= queue.length) {
      return;
    }
    
    const track = queue[index];
    if (!track) {
      return;
    }
    
    if (!track.audioPath) {
      toast.error('Este álbum não tem arquivo de áudio');
      return;
    }

    setIsLoading(true);
    setDebug(`Carregando: ${track.title}`);
    
    try {
      let url = trackUrls[track.audioPath];
      
      if (!url) {
        url = await getPresignedUrl(track.audioPath);
        
        if (!url) {
          setDebug('Erro de URL');
          toast.error('Erro ao acessar arquivo de áudio');
          return;
        }
        
        setTrackUrls(prev => ({ ...prev, [track.audioPath]: url }));
      }
      
      await loadTrack(url);
      await play();
      
      setDebug('');
    } catch (e) {
      setDebug('Erro: ' + e.message);
      toast.error('Erro ao reproduzir: ' + e.message);
    } finally {
      setIsLoading(false);
    }
  }, [queue, trackUrls, getPresignedUrl, loadTrack, play]);

  hydrateAndPlayRef.current = hydrateAndPlay;

  useEffect(() => {
    const ht = queue.length > 0 && currentTrack;
    if (!ht || queue.length === 0) return;
    
    const idx = queue.findIndex(t => t.id === currentTrack?.id);
    if (idx >= 0) {
      setCurrentQueueIndex(idx);
    }
  }, [currentTrack, queue]);

  useEffect(() => {
    if (!currentTrack || queue.length === 0) {
      return;
    }
    
    const idx = queue.findIndex(t => t.id === currentTrack?.id);
    if (idx < 0) {
      return;
    }
    
    setCurrentQueueIndex(idx);
    
    if (globalIsPlaying) {
      const playCurrentTrack = async () => {
        try {
          if (hydrateAndPlayRef.current) {
            await hydrateAndPlayRef.current(idx);
          }
        } catch {
          toast.error('Erro ao reproduzir');
        }
      };
      playCurrentTrack();
    }
  }, [currentTrack?.id, queue, globalIsPlaying]);

  const handlePlayPause = useCallback(async () => {
    if (!isReady) {
      initAudioContext();
      await new Promise(r => setTimeout(r, 100));
    }
    
    if (isPlaying) {
      pause();
      setGlobalIsPlaying(false);
    } else {
      if (queue.length > 0 && currentTrack) {
        const idx = queue.findIndex(t => t.id === currentTrack?.id);
        if (idx >= 0) {
          hydrateAndPlayRef.current?.(idx);
        }
      }
      await play();
      setGlobalIsPlaying(true);
    }
  }, [isReady, isPlaying, queue, currentTrack, initAudioContext, play, pause, setGlobalIsPlaying]);

  const handleStop = useCallback(() => {
    stop();
    setGlobalIsPlaying(false);
  }, [stop, setGlobalIsPlaying]);

  const handleNext = useCallback(async () => {
    const next = getNextTrack(queue, currentQueueIndex);
    if (next) {
      hydrateAndPlayRef.current?.(next.index);
    } else if (loopMode === 'playlist' && queue.length > 0) {
      hydrateAndPlayRef.current?.(0);
    }
  }, [queue, currentQueueIndex, getNextTrack, loopMode]);

  const handlePrev = useCallback(async () => {
    if (currentTime > 3) {
      seek(0);
      return;
    }
    
    const prev = getPrevTrack(queue, currentQueueIndex);
    if (prev) {
      hydrateAndPlayRef.current?.(prev.index);
    } else {
      seek(0);
    }
  }, [currentTime, seek, queue, currentQueueIndex, getPrevTrack]);

  const handleSeek = useCallback(async (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const time = percent * duration;
    seek(time);
  }, [duration, seek]);

  const handleVolumeChange = useCallback((e) => {
    setVolume(parseFloat(e.target.value));
  }, [setVolume]);

  const handlePanChange = useCallback((e) => {
    setPan(parseFloat(e.target.value));
  }, [setPan]);

  const handlePreAmpChange = useCallback((e) => {
    setPreAmp(parseFloat(e.target.value));
  }, [setPreAmp]);

  const handleEqChange = useCallback((freq, value) => {
    setEqBand(freq, parseFloat(value));
    setSelectedPreset('Custom');
  }, [setEqBand]);

  const applyPreset = useCallback((presetName) => {
    const preset = EQ_PRESETS[presetName];
    if (!preset) return;
    
    setSelectedPreset(presetName);
    setPreAmp(preset.preAmp);
    
    Object.entries(preset.bands).forEach(([freq, gain]) => {
      setEqBand(parseInt(freq), gain);
    });
    
    setShowPresetMenu(false);
    toast.success(`Preset "${presetName}" aplicado`, { duration: 1500 });
  }, [setPreAmp, setEqBand]);

  const formatTime = (t) => {
    if (!t || isNaN(t)) return '0:00';
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getVolumeDb = () => {
    if (volume <= 0) return '-∞';
    const db = 20 * Math.log10(volume);
    return db.toFixed(1);
  };

  const getLoopIcon = () => {
    switch (loopMode) {
      case 'track': return <Repeat1 className="w-4 h-4" />;
      case 'playlist': return <Repeat className="w-4 h-4" />;
      default: return <Repeat className="w-4 h-4 opacity-50" />;
    }
  };

  const hasTrack = queue.length > 0 && currentTrack;

  if (!isAuthenticated || !isGrooveflix) {
    return null;
  }

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-4 right-4 z-[99999] w-14 h-14 bg-black/90 backdrop-blur-xl border border-yellow-500/40 rounded-full shadow-2xl shadow-yellow-500/20 flex items-center justify-center hover:bg-black/95 hover:scale-105 transition-all"
      >
        <Disc3 className={`w-6 h-6 text-yellow-400 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '2s' }} />
      </button>
    );
  }

  return (
    <div 
      className="fixed bottom-4 right-4 z-[99999] w-[400px] bg-black/90 backdrop-blur-xl border border-yellow-500/40 rounded-2xl shadow-2xl shadow-yellow-500/20 overflow-hidden"
    >
      <div className="flex items-center gap-3 px-3 py-2 border-b border-white/10 bg-gradient-to-r from-black/90 to-yellow-900/10">
        <div className="w-9 h-9 rounded-lg bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
          <Disc3 className={`w-5 h-5 text-yellow-400 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '2s' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-bold truncate">{currentTrack?.title || (debug ? `... ${debug}` : 'Grooveflix')}</p>
          <p className="text-white/50 text-[10px] truncate">{currentTrack?.artist || 'Pronto'}</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handlePrev} className="w-7 h-7 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70">
            <SkipBack className="w-3.5 h-3.5" />
          </button>
          <button onClick={handlePlayPause} className="w-9 h-9 rounded-lg bg-yellow-500 hover:bg-yellow-400 flex items-center justify-center text-black transition">
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <button onClick={handleNext} className="w-7 h-7 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70">
            <SkipForward className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleStop} className="w-7 h-7 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/50">
            <Square className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setIsMinimized(true)} className="w-7 h-7 rounded bg-white/10 hover:bg-yellow-500/30 flex items-center justify-center text-white/50 hover:text-yellow-400 transition-colors">
            <Minus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="px-3 pt-2 pb-1 bg-gradient-to-b from-black/80 to-transparent">
        <VUMeter vuMeterData={vuMeterData} isPlaying={isPlaying} />
      </div>

      <KnobPanel 
        volume={volume}
        handleVolumeChange={handleVolumeChange}
        eqBands={eqBands}
        handleEqBand={setEqBand}
        getVolumeDb={getVolumeDb}
        spectrumL={spectrumL}
        spectrumR={spectrumR}
        isPlaying={isPlaying}
      />

      <div className="px-3 pb-3">
        <AudioControlsPanel 
          currentTrack={currentTrack}
          loopMode={loopMode}
          shuffle={shuffle}
          showEq={showEq}
          toggleShuffle={toggleShuffle}
          toggleLoop={toggleLoop}
          setShowEq={setShowEq}
          volume={volume}
          handleVolumeChange={handleVolumeChange}
          getVolumeDb={getVolumeDb}
          preAmp={preAmp}
          handlePreAmpChange={handlePreAmpChange}
          currentTime={currentTime}
          duration={duration}
          handleSeek={handleSeek}
          formatTime={formatTime}
          currentQueueIndex={currentQueueIndex}
          queue={queue}
          eqBands={eqBands}
          eqFrequencies={eqFrequencies}
          handleEqChange={handleEqChange}
          eqPreset={selectedPreset}
          setEqPreset={setSelectedPreset}
          showPresetMenu={showPresetMenu}
          setShowPresetMenu={setShowPresetMenu}
          EQ_PRESETS={EQ_PRESETS}
          applyPreset={applyPreset}
        />
      </div>

      {isLoading && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
