import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Square, Volume2, VolumeX,
  Repeat, Repeat1, Shuffle, ChevronUp, ChevronDown, X,
  Music, Disc3, Headphones, Sliders, BarChart3, ChevronDown as ChevronDownIcon
} from 'lucide-react';
import { useSuperPlayer } from '../hooks/useSuperPlayer';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

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

  const [isExpanded, setIsExpanded] = useState(false);
  const [activePanel, setActivePanel] = useState('eq');
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [trackUrls, setTrackUrls] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [debug, setDebug] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('Flat');
  const [showPresetMenu, setShowPresetMenu] = useState(false);

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
    eqFrequencies,
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
  } = useSuperPlayer();

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
      console.log('[SUPER PLAYER] Invalid index:', index);
      return;
    }
    
    const track = queue[index];
    if (!track) {
      console.log('[SUPER PLAYER] No track at index:', index);
      return;
    }
    
    if (!track.audioPath) {
      console.log('[SUPER PLAYER] No audioPath for track:', track.title);
      toast.error('Este álbum não tem arquivo de áudio');
      return;
    }

    console.log('[SUPER PLAYER] Hydrating:', track.title, '| path:', track.audioPath);
    setIsLoading(true);
    setDebug(`Carregando: ${track.title}`);
    
    try {
      let url = trackUrls[track.audioPath];
      
      if (!url) {
        console.log('[SUPER PLAYER] Getting presigned URL...');
        url = await getPresignedUrl(track.audioPath);
        
        if (!url) {
          console.error('[SUPER PLAYER] Failed to get presigned URL');
          setDebug('Erro de URL');
          toast.error('Erro ao acessar arquivo de áudio');
          return;
        }
        
        console.log('[SUPER PLAYER] Presigned URL received');
        setTrackUrls(prev => ({ ...prev, [track.audioPath]: url }));
      }
      
      console.log('[SUPER PLAYER] Loading audio...');
      await loadTrack(url);
      
      console.log('[SUPER PLAYER] Starting playback...');
      await play();
      
      setDebug('');
      console.log('[SUPER PLAYER] Playback started!');
    } catch (e) {
      console.error('[SUPER PLAYER] Error:', e);
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
      console.log('[SUPER PLAYER] Skipping: no track or empty queue');
      return;
    }
    
    const idx = queue.findIndex(t => t.id === currentTrack?.id);
    if (idx < 0) {
      console.log('[SUPER PLAYER] Track not found in queue:', currentTrack?.id);
      return;
    }
    
    console.log('[SUPER PLAYER] Track changed:', currentTrack?.title, '| index:', idx, '| playing:', globalIsPlaying);
    setCurrentQueueIndex(idx);
    
    if (globalIsPlaying) {
      const playCurrentTrack = async () => {
        try {
          if (hydrateAndPlayRef.current) {
            console.log('[SUPER PLAYER] Calling hydrateAndPlay...');
            await hydrateAndPlayRef.current(idx);
          }
        } catch (e) {
          console.error('[SUPER PLAYER] Play error:', e);
          toast.error('Erro ao reproduzir');
        }
      };
      playCurrentTrack();
    }
  }, [currentTrack?.id, queue]);

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
      case 'track': return <Repeat1 className="w-4 h-4" />;
      case 'playlist': return <Repeat className="w-4 h-4" />;
      default: return <Repeat className="w-4 h-4 opacity-50" />;
    }
  };

  const hasTrack = queue.length > 0 && currentTrack;

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <div
        className={`fixed bottom-4 right-4 z-[99999] transition-all duration-300 ${
          isExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <div className="flex items-center gap-3 bg-black/60 backdrop-blur-xl border border-yellow-500/40 rounded-2xl px-4 py-3 shadow-2xl shadow-yellow-500/10">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
            <Music className={`w-5 h-5 text-yellow-400 ${isPlaying ? 'animate-pulse' : ''}`} />
          </div>
          
          <div className="min-w-0 max-w-[150px]">
            <p className="text-white text-xs font-bold truncate">{currentTrack?.title || (debug ? `... ${debug}` : 'Grooveflix')}</p>
            <p className="text-white/50 text-[10px] truncate">{currentTrack?.artist || (userId ? 'Pronto para tocar' : 'Aguardando...')}</p>
            {queue.length > 1 && (
              <p className="text-yellow-400/70 text-[9px]">{currentQueueIndex + 1}/{queue.length}</p>
            )}
            {!userId && (
              <p className="text-red-400/70 text-[9px]">Sem userId</p>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handlePlayPause}
              className="w-8 h-8 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 flex items-center justify-center text-yellow-300 transition"
              title={isPlaying ? 'Pausar' : 'Reproduzir'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setIsExpanded(true)}
              className="w-8 h-8 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 flex items-center justify-center text-yellow-300 transition"
              title="Player Completo"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="fixed bottom-4 right-4 z-[99998] w-[420px] bg-black/70 backdrop-blur-xl border border-yellow-500/30 rounded-2xl shadow-2xl shadow-yellow-500/20 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Headphones className="w-4 h-4 text-yellow-400" />
              <span className="text-white font-bold text-sm">GrooveGroove Player</span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          <div className="flex border-b border-white/10">
            <button
              onClick={() => setActivePanel('eq')}
              className={`flex-1 py-2 text-xs font-medium transition ${
                activePanel === 'eq' 
                  ? 'text-yellow-400 border-b-2 border-yellow-400 bg-yellow-500/10' 
                  : 'text-white/50 hover:text-white/70'
              }`}
            >
              <Sliders className="w-4 h-4 mx-auto mb-1" />
              Equalizador
            </button>
            <button
              onClick={() => setActivePanel('visualizer')}
              className={`flex-1 py-2 text-xs font-medium transition ${
                activePanel === 'visualizer' 
                  ? 'text-yellow-400 border-b-2 border-yellow-400 bg-yellow-500/10' 
                  : 'text-white/50 hover:text-white/70'
              }`}
            >
              <BarChart3 className="w-4 h-4 mx-auto mb-1" />
              Visualizador
            </button>

          </div>

          {activePanel === 'eq' && (
            <div className="p-4 space-y-4">
              <div className="relative">
                <button
                  onClick={() => setShowPresetMenu(!showPresetMenu)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition"
                >
                  <span className="text-white font-medium">Preset: <span className="text-yellow-400">{selectedPreset}</span></span>
                  <ChevronDownIcon className={`w-4 h-4 text-white/50 transition-transform ${showPresetMenu ? 'rotate-180' : ''}`} />
                </button>
                
                {showPresetMenu && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-white/20 rounded-lg overflow-hidden z-50 shadow-xl">
                    {Object.keys(EQ_PRESETS).map((presetName) => (
                      <button
                        key={presetName}
                        onClick={() => applyPreset(presetName)}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-yellow-500/20 transition ${
                          selectedPreset === presetName ? 'text-yellow-400 bg-yellow-500/10' : 'text-white/80'
                        }`}
                      >
                        {presetName}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-white/50">
                <span>Pré-Amp</span>
                <span>{preAmp > 0 ? '+' : ''}{preAmp.toFixed(1)} dB</span>
              </div>
              <input
                type="range"
                min="-12"
                max="12"
                step="0.5"
                value={preAmp}
                onChange={handlePreAmpChange}
                className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-yellow-500"
              />

              <div className="grid grid-cols-10 gap-1">
                {eqFrequencies.map((freq) => (
                  <div key={freq} className="flex flex-col items-center">
                    <span className="text-[8px] text-white/40 mb-1">
                      {freq >= 1000 ? `${freq/1000}k` : freq}
                    </span>
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="0.5"
                      value={eqBands[freq]}
                      onChange={(e) => handleEqChange(freq, e.target.value)}
                      className="w-4 h-24 bg-white/10 rounded-full appearance-none cursor-pointer accent-yellow-500 writing-mode-vertical"
                      style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                    />
                    <span className="text-[8px] text-white/60 mt-1">
                      {eqBands[freq] > 0 ? '+' : ''}{eqBands[freq].toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs text-white/50 mb-1">
                    <span>Volume</span>
                    <span>{(volume * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-yellow-500"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs text-white/50 mb-1">
                    <span>Balanco</span>
                    <span>{pan === 0 ? 'C' : pan < 0 ? `E${Math.abs(pan * 100).toFixed(0)}` : `D${(pan * 100).toFixed(0)}`}</span>
                  </div>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={pan}
                    onChange={handlePanChange}
                    className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-yellow-500"
                  />
                </div>
              </div>
            </div>
          )}

          {activePanel === 'visualizer' && (
            <div className="p-4">
              <div className="h-32 bg-black/40 rounded-lg flex items-end justify-center gap-1 p-2">
                {Array.from(analyserData).slice(0, 32).map((value, i) => (
                  <div
                    key={i}
                    className="w-1.5 bg-gradient-to-t from-yellow-600 to-yellow-300 rounded-sm transition-all duration-75"
                    style={{ 
                      height: `${Math.max(4, (value / 255) * 100)}%`,
                      opacity: 0.5 + (value / 510)
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center justify-center gap-4 mt-3">
                <button
                  onClick={toggleShuffle}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${
                    shuffle 
                      ? 'bg-yellow-500/30 text-yellow-300' 
                      : 'bg-white/10 text-white/50 hover:text-white'
                  }`}
                  title="Aleatório"
                >
                  <Shuffle className="w-4 h-4" />
                </button>
                <button
                  onClick={toggleLoop}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${
                    loopMode !== 'none' 
                      ? 'bg-yellow-500/30 text-yellow-300' 
                      : 'bg-white/10 text-white/50 hover:text-white'
                  }`}
                  title={`Loop: ${loopMode}`}
                >
                  {getLoopIcon()}
                </button>
              </div>
            </div>
          )}

          <div className="p-4 border-t border-white/10">
            <div 
              className="h-2 bg-white/10 rounded-full cursor-pointer mb-2"
              onClick={handleSeek}
            >
              <div 
                className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-full transition-all"
                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-white/50">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>

            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={toggleShuffle}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition ${
                  shuffle 
                    ? 'bg-yellow-500/30 text-yellow-300' 
                    : 'bg-white/10 text-white/50 hover:text-white'
                }`}
                title="Aleatório"
              >
                <Shuffle className="w-4 h-4" />
              </button>
              <button
                onClick={handlePrev}
                className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
                title="Anterior"
              >
                <SkipBack className="w-5 h-5" />
              </button>
              <button
                onClick={handlePlayPause}
                className="w-14 h-14 rounded-xl bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 flex items-center justify-center text-white shadow-lg shadow-yellow-500/30 transition"
                title={isPlaying ? 'Pausar' : 'Reproduzir'}
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
              </button>
              <button
                onClick={handleNext}
                className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
                title="Próxima"
              >
                <SkipForward className="w-5 h-5" />
              </button>
              <button
                onClick={handleStop}
                className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/50 hover:text-white transition"
                title="Parar"
              >
                <Square className="w-4 h-4" />
              </button>
              <button
                onClick={toggleLoop}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition ${
                  loopMode !== 'none' 
                    ? 'bg-yellow-500/30 text-yellow-300' 
                    : 'bg-white/10 text-white/50 hover:text-white'
                }`}
                title={`Loop: ${loopMode}`}
              >
                {getLoopIcon()}
              </button>
            </div>

            <div className="flex items-center gap-3 mt-4">
              {volume === 0 ? (
                <VolumeX className="w-4 h-4 text-white/40" />
              ) : (
                <Volume2 className="w-4 h-4 text-white/40" />
              )}
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-yellow-500"
              />
            </div>
          </div>

          {isLoading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}
    </>
  );
}
