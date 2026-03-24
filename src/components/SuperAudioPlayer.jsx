import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Square, Volume2, VolumeX,
  Repeat, Repeat1, Shuffle, Disc3
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

  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [trackUrls, setTrackUrls] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [debug, setDebug] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('Flat');
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [vuLeft, setVuLeft] = useState(-50);
  const [vuRight, setVuRight] = useState(-50);
  
  const vuLeftRef = useRef(null);
  const vuRightRef = useRef(null);

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

  useEffect(() => {
    if (!analyserData || analyserData.length === 0) {
      setVuLeft(-50);
      setVuRight(-50);
      return;
    }
    
    const leftAvg = Array.from(analyserData).slice(0, 16).reduce((a, v) => a + v, 0) / 16;
    const rightAvg = Array.from(analyserData).slice(16, 32).reduce((a, v) => a + v, 0) / 16;
    
    const leftDeg = -50 + (leftAvg / 255) * 100;
    const rightDeg = -50 + (rightAvg / 255) * 100;
    
    setVuLeft(leftDeg);
    setVuRight(rightDeg);
    
    if (vuLeftRef.current) {
      vuLeftRef.current.style.transform = `rotate(${leftDeg}deg)`;
    }
    if (vuRightRef.current) {
      vuRightRef.current.style.transform = `rotate(${rightDeg}deg)`;
    }
  }, [analyserData]);

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
    <div className="fixed bottom-4 right-4 z-[99999] w-[400px] bg-black/90 backdrop-blur-xl border border-yellow-500/40 rounded-2xl shadow-2xl shadow-yellow-500/20 overflow-hidden">
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
        </div>
      </div>

      <div className="px-3 py-2 border-t border-white/5 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center justify-center gap-4">
          <div className="relative w-[145px] h-[75px] rounded-lg overflow-hidden shadow-lg" style={{
            background: 'linear-gradient(180deg, #f5f5dc 0%, #e8e8d0 50%, #d4d4c0 100%)',
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.3), 0 0 15px rgba(255,220,100,0.2), 0 0 30px rgba(255,200,50,0.1)'
          }}>
            <div className="absolute inset-x-2 top-2 flex justify-between text-[7px] text-black font-bold tracking-tight">
              <span>+3</span>
              <span>0</span>
              <span>-3</span>
              <span>-6</span>
              <span>-12</span>
              <span>-20</span>
            </div>
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 145 75">
              <defs>
                <filter id="redGlow">
                  <feGaussianBlur stdDeviation="1.5" result="blur"/>
                  <feMerge>
                    <feMergeNode in="blur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              <path d="M 20 68 Q 72 8 124 68" fill="none" stroke="#1a1a1a" strokeWidth="0.8" opacity="0.4"/>
              <path d="M 20 68 Q 72 12 124 68" fill="none" stroke="#333" strokeWidth="0.5" opacity="0.2"/>
              <line 
                ref={vuLeftRef}
                x1="72" y1="68" x2="72" y2="10" 
                stroke="#ff0000" 
                strokeWidth="2.5" 
                strokeLinecap="round"
                filter="url(#redGlow)"
                style={{
                  transform: `rotate(${vuLeft}deg)`,
                  transformOrigin: '72px 68px',
                  transition: 'transform 0.08s ease-out'
                }}
              />
              <circle cx="72" cy="68" r="4" fill="#ff0000" filter="url(#redGlow)"/>
              <circle cx="72" cy="68" r="2" fill="#ff3333"/>
            </svg>
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-black text-red-700 tracking-widest">L</div>
          </div>

          <div className="relative w-[145px] h-[75px] rounded-lg overflow-hidden shadow-lg" style={{
            background: 'linear-gradient(180deg, #f5f5dc 0%, #e8e8d0 50%, #d4d4c0 100%)',
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.3), 0 0 15px rgba(255,220,100,0.2), 0 0 30px rgba(255,200,50,0.1)'
          }}>
            <div className="absolute inset-x-2 top-2 flex justify-between text-[7px] text-black font-bold tracking-tight">
              <span>+3</span>
              <span>0</span>
              <span>-3</span>
              <span>-6</span>
              <span>-12</span>
              <span>-20</span>
            </div>
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 145 75">
              <path d="M 20 68 Q 72 8 124 68" fill="none" stroke="#1a1a1a" strokeWidth="0.8" opacity="0.4"/>
              <path d="M 20 68 Q 72 12 124 68" fill="none" stroke="#333" strokeWidth="0.5" opacity="0.2"/>
              <line 
                ref={vuRightRef}
                x1="72" y1="68" x2="72" y2="10" 
                stroke="#ff0000" 
                strokeWidth="2.5" 
                strokeLinecap="round"
                filter="url(#redGlow)"
                style={{
                  transform: `rotate(${vuRight}deg)`,
                  transformOrigin: '72px 68px',
                  transition: 'transform 0.08s ease-out'
                }}
              />
              <circle cx="72" cy="68" r="4" fill="#ff0000" filter="url(#redGlow)"/>
              <circle cx="72" cy="68" r="2" fill="#ff3333"/>
            </svg>
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-black text-red-700 tracking-widest">R</div>
          </div>
        </div>
        <div className="flex justify-center gap-4 mt-1">
          <span className="text-[8px] text-yellow-500/70 font-bold tracking-widest">◉ VU STEREO ◉</span>
        </div>
      </div>

      <div className="px-3 py-1.5 border-t border-white/5">
        <div className="flex items-center justify-between text-[10px] text-white/40">
          <span>{formatTime(currentTime)}</span>
          <span className="text-yellow-400 font-bold">{currentQueueIndex + 1}/{queue.length}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <div 
          className="h-1.5 bg-white/10 rounded-full cursor-pointer mt-1"
          onClick={handleSeek}
        >
          <div 
            className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-full"
            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="px-3 py-2 border-t border-white/5">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={toggleShuffle} className={`w-6 h-6 rounded flex items-center justify-center transition ${shuffle ? 'bg-yellow-500/30 text-yellow-300' : 'text-white/40'}`}>
            <Shuffle className="w-3 h-3" />
          </button>
          {volume === 0 ? <VolumeX className="w-4 h-4 text-white/40" /> : <Volume2 className="w-4 h-4 text-white/40" />}
          <input type="range" min="0" max="1" step="0.01" value={volume} onChange={handleVolumeChange} className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-yellow-500" />
          <button onClick={toggleLoop} className={`w-6 h-6 rounded flex items-center justify-center transition ${loopMode !== 'none' ? 'bg-yellow-500/30 text-yellow-300' : 'text-white/40'}`}>
            {getLoopIcon()}
          </button>
        </div>

        <div className="flex items-center gap-2 text-[9px] text-white/40">
          <span>Pré:</span>
          <input type="range" min="-12" max="12" step="0.5" value={preAmp} onChange={handlePreAmpChange} className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-yellow-500" />
          <span className="w-8 text-right">{preAmp > 0 ? '+' : ''}{preAmp.toFixed(1)}</span>
        </div>
      </div>

      <div className="px-3 pb-2">
        <div className="grid grid-cols-10 gap-[2px]">
          {eqFrequencies.map((freq) => (
            <div key={freq} className="flex flex-col items-center">
              <span className="text-[7px] text-white/30 mb-0.5">{freq >= 1000 ? `${freq/1000}k` : freq}</span>
              <input
                type="range"
                min="-12"
                max="12"
                step="1"
                value={eqBands[freq]}
                onChange={(e) => handleEqChange(freq, parseInt(e.target.value))}
                className="w-3 h-12 bg-white/10 rounded-full appearance-none cursor-pointer accent-yellow-500"
                style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
              />
              <span className="text-[7px] text-white/40 mt-0.5">{eqBands[freq] > 0 ? '+' : ''}{eqBands[freq]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative border-t border-white/5">
        <button
          onClick={() => setShowPresetMenu(!showPresetMenu)}
          className="w-full px-3 py-2 text-center text-[10px] bg-white/5 hover:bg-white/10 text-yellow-400 transition"
        >
          EQ: {selectedPreset}
        </button>
        
        {showPresetMenu && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-gray-900 border border-yellow-500/30 rounded-lg overflow-hidden z-50 shadow-xl">
            {Object.keys(EQ_PRESETS).map((presetName) => (
              <button
                key={presetName}
                onClick={() => {
                  applyPreset(presetName);
                  setShowPresetMenu(false);
                }}
                className={`w-full px-3 py-1.5 text-left text-xs hover:bg-yellow-500/20 transition ${
                  selectedPreset === presetName ? 'text-yellow-400 bg-yellow-500/10' : 'text-white/80'
                }`}
              >
                {presetName}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
