import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Square, Disc3,
  Repeat, Repeat1, Shuffle
} from 'lucide-react';
import { useAudioEngine } from '../hooks/useAudioEngine';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { VUMeter } from './VUMeter';
import { DigitalDisplay } from './DigitalDisplay';

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
    setCurrentTrack,
    isPlaying: globalIsPlaying,
    setIsPlaying: setGlobalIsPlaying,
    getPresignedUrl,
  } = useAudioPlayer();

  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [trackUrls, setTrackUrls] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [debug, setDebug] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('Flat');
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [showEq, setShowEq] = useState(false);

  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    preAmp,
    eqBands,
    loopMode,
    shuffle,
    isReady,
    eqFrequencies,
    vuMeterData,
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
    if (index < 0 || index >= queue.length) return;
    const track = queue[index];
    if (!track) return;
    
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
    if (!currentTrack || queue.length === 0) return;
    const idx = queue.findIndex(t => t.id === currentTrack?.id);
    if (idx >= 0) setCurrentQueueIndex(idx);
  }, [currentTrack, queue]);

  useEffect(() => {
    if (!currentTrack || queue.length === 0) return;
    const idx = queue.findIndex(t => t.id === currentTrack?.id);
    if (idx < 0) return;
    
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

  const getLoopIcon = () => {
    switch (loopMode) {
      case 'track': return <Repeat1 className="w-3.5 h-3.5" />;
      case 'playlist': return <Repeat className="w-3.5 h-3.5" />;
      default: return <Repeat className="w-3.5 h-3.5 opacity-40" />;
    }
  };

  const getVolumeDb = () => {
    if (volume <= 0) return '-∞';
    const db = 20 * Math.log10(volume);
    return db.toFixed(1);
  };

  const getPanDisplay = (pan) => {
    if (pan === 0) return 'C';
    if (pan < 0) return `L${Math.abs(Math.round(pan * 10))}`;
    return `R${Math.round(pan * 10)}`;
  };

  if (!isAuthenticated || !isGrooveflix) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[99999] w-[420px] bg-gradient-to-b from-zinc-900 via-zinc-950 to-black border border-amber-600/30 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden"
      style={{
        boxShadow: '0 0 30px rgba(180, 83, 9, 0.15), inset 0 1px 0 rgba(251, 191, 36, 0.1)',
      }}
    >
      <div className="relative px-4 pt-3 pb-2 bg-gradient-to-b from-zinc-900 to-transparent">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-700 via-amber-600 to-yellow-600 p-[2px] shadow-lg shadow-amber-900/50">
              <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center overflow-hidden">
                <Disc3 className={`w-7 h-7 text-amber-500 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '2.5s' }} />
              </div>
            </div>
            {isPlaying && (
              <div className="absolute inset-0 rounded-full border-2 border-amber-400/50 animate-ping" style={{ animationDuration: '1.5s' }} />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-amber-100/90 text-sm font-bold truncate drop-shadow-sm">
              {currentTrack?.title || (debug ? `... ${debug}` : 'Grooveflix Hi-Fi')}
            </p>
            <p className="text-amber-200/50 text-[10px] truncate">{currentTrack?.artist || 'Selecione uma faixa'}</p>
          </div>

          <div className="flex items-center gap-1.5">
            <button onClick={handlePrev} className="w-8 h-8 rounded-full bg-zinc-800/80 hover:bg-zinc-700 border border-amber-700/30 flex items-center justify-center text-amber-200/70 hover:text-amber-300 transition-all">
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button onClick={handlePlayPause} className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 flex items-center justify-center text-black shadow-lg shadow-amber-900/30 transition-all active:scale-95">
              {isPlaying ? <Pause className="w-5 h-5 ml-0.5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            <button onClick={handleNext} className="w-8 h-8 rounded-full bg-zinc-800/80 hover:bg-zinc-700 border border-amber-700/30 flex items-center justify-center text-amber-200/70 hover:text-amber-300 transition-all">
              <SkipForward className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleStop} className="w-8 h-8 rounded-full bg-zinc-800/80 hover:bg-zinc-700 border border-amber-700/30 flex items-center justify-center text-amber-200/50 hover:text-amber-400 transition-all">
              <Square className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <button onClick={toggleShuffle} className={`w-7 h-7 rounded flex items-center justify-center transition ${shuffle ? 'bg-amber-600/40 text-amber-300' : 'text-amber-200/40'}`}>
            <Shuffle className="w-3 h-3" />
          </button>
          <button onClick={toggleLoop} className={`w-7 h-7 rounded flex items-center justify-center transition ${loopMode !== 'none' ? 'bg-amber-600/40 text-amber-300' : 'text-amber-200/40'}`}>
            {getLoopIcon()}
          </button>
          <button onClick={() => setShowEq(!showEq)} className={`w-7 h-7 rounded flex items-center justify-center transition text-[10px] font-bold ${showEq ? 'bg-amber-600/40 text-amber-300' : 'text-amber-200/40'}`}>
            EQ
          </button>
        </div>
      </div>

      <div className="px-4 py-3 bg-gradient-to-b from-amber-950/20 to-transparent">
        <VUMeter vuMeterData={vuMeterData} isPlaying={isPlaying} />
      </div>

      <div className="px-4 pb-3">
        <DigitalDisplay 
          currentTrack={currentTrack}
          loopMode={loopMode}
          shuffle={shuffle}
          showEq={showEq}
        />
      </div>

      <div className="px-4 py-2">
        <div className="flex items-center justify-between text-[10px] text-amber-200/60 font-mono">
          <span>{formatTime(currentTime)}</span>
          <span className="px-2 py-0.5 bg-amber-900/30 rounded text-amber-400 font-bold">{currentQueueIndex + 1}/{queue.length}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <div 
          className="h-2 bg-zinc-800/50 rounded-full cursor-pointer mt-1.5 overflow-hidden border border-zinc-700/50"
          onClick={handleSeek}
        >
          <div 
            className="h-full bg-gradient-to-r from-amber-700 to-yellow-500 rounded-full transition-all duration-100"
            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="px-4 py-3 bg-zinc-900/50 border-t border-amber-900/20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-[9px] text-amber-200/50 w-6">VOL</span>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={volume} 
              onChange={handleVolumeChange} 
              className="flex-1 h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-amber-500"
            />
            <span className="text-[9px] text-amber-400 font-mono w-10 text-right">{getVolumeDb()}dB</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-amber-200/50 w-5">BAL</span>
            <input 
              type="range" 
              min="-1" 
              max="1" 
              step="0.1" 
              value={0} 
              onChange={handlePanChange}
              className="w-16 h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-amber-500"
            />
            <span className="text-[9px] text-amber-400 font-mono w-6">{getPanDisplay(0)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <span className="text-[9px] text-amber-200/50 w-6">PRE</span>
          <input 
            type="range" 
            min="-12" 
            max="12" 
            step="0.5" 
            value={preAmp} 
            onChange={handlePreAmpChange} 
            className="flex-1 h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-amber-500"
          />
          <span className="text-[9px] text-amber-400 font-mono w-8 text-right">{preAmp > 0 ? '+' : ''}{preAmp.toFixed(1)}</span>
        </div>
      </div>

      {showEq && (
        <div className="px-4 py-3 bg-zinc-900/80 border-t border-amber-900/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-amber-200/70 font-medium">EQUALIZADOR</span>
            <div className="relative">
              <button
                onClick={() => setShowPresetMenu(!showPresetMenu)}
                className="px-2 py-0.5 text-[9px] bg-amber-800/40 hover:bg-amber-700/50 text-amber-300 rounded transition"
              >
                {selectedPreset}
              </button>
              
              {showPresetMenu && (
                <div className="absolute bottom-full right-0 mb-1 w-32 bg-zinc-900 border border-amber-700/40 rounded-lg overflow-hidden shadow-xl z-50">
                  {Object.keys(EQ_PRESETS).map((presetName) => (
                    <button
                      key={presetName}
                      onClick={() => {
                        applyPreset(presetName);
                        setShowPresetMenu(false);
                      }}
                      className={`w-full px-2 py-1 text-left text-[10px] hover:bg-amber-700/30 transition ${
                        selectedPreset === presetName ? 'text-amber-400 bg-amber-800/30' : 'text-amber-200/80'
                      }`}
                    >
                      {presetName}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-end justify-between gap-1 h-20 px-1">
            {eqFrequencies.map((freq) => (
              <div key={freq} className="flex flex-col items-center flex-1">
                <div className="relative w-4 h-full flex flex-col justify-end">
                  <div 
                    className="w-full bg-gradient-to-t from-amber-600 to-yellow-500 rounded-sm transition-all"
                    style={{ 
                      height: `${Math.abs(eqBands[freq]) * 4}px`,
                      marginBottom: eqBands[freq] < 0 ? 0 : 'auto',
                      marginTop: eqBands[freq] >= 0 ? 0 : 'auto',
                      minHeight: '2px'
                    }}
                  />
                  <div className="absolute left-0 right-0 top-1/2 h-px bg-zinc-600" />
                </div>
                <span className="text-[7px] text-amber-200/50 mt-1">{freq >= 1000 ? `${freq/1000}k` : freq}</span>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={eqBands[freq]}
                  onChange={(e) => handleEqChange(freq, parseInt(e.target.value))}
                  className="w-full h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-amber-500 mt-0.5"
                  style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center backdrop-blur-sm">
          <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
