import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Square,
  Repeat, Repeat1, Shuffle, Disc3, Volume2, VolumeX
} from 'lucide-react';
import { useAudioEngine } from '../hooks/useAudioEngine';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

const EQ_FREQUENCIES_5 = [60, 250, 1000, 4000, 16000];
const EQ_LABELS = ['60', '250', '1K', '4K', '16K'];

export function SuperAudioPlayer() {
  const [currentPath, setCurrentPath] = useState('/');
  const canvasLRef = useRef(null);
  const canvasRRef = useRef(null);

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
  const [isMuted, setIsMuted] = useState(false);
  const [volumeBeforeMute, setVolumeBeforeMute] = useState(0.8);

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
    vuMeterData,
    spectrumL,
    spectrumR,
    timeDomainBytesL,
    timeDomainBytesR,
    loadTrack,
    play,
    pause,
    stop,
    seek,
    setVolume,
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
    if (!track || !track.audioPath) {
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
        if (idx >= 0) hydrateAndPlayRef.current?.(idx);
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

  const handleSeek = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const time = percent * duration;
    seek(time);
  }, [duration, seek]);

  const handleVolumeChange = useCallback((e) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (newVol > 0) setIsMuted(false);
  }, [setVolume]);

  const handlePreAmpChange = useCallback((e) => {
    setPreAmp(parseFloat(e.target.value));
  }, [setPreAmp]);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      setVolume(volumeBeforeMute);
      setIsMuted(false);
    } else {
      setVolumeBeforeMute(volume);
      setVolume(0);
      setIsMuted(true);
    }
  }, [isMuted, volume, volumeBeforeMute, setVolume]);

  const handleEqChange = useCallback((freq, value) => {
    setEqBand(freq, parseFloat(value));
  }, [setEqBand]);

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
      default: return <Repeat className="w-4 h-4" />;
    }
  };

  useEffect(() => {
    const canvasL = canvasLRef.current;
    const canvasR = canvasRRef.current;
    if (!canvasL || !canvasR) return;

    const ctxL = canvasL.getContext('2d');
    const ctxR = canvasR.getContext('2d');
    let animId;

    const drawScope = (ctx, data, w, h) => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, w, h);
      
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      
      if (!data || data.length === 0) return;
      
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      
      for (let i = 0; i < w; i++) {
        const dataIdx = Math.floor((i / w) * data.length);
        const v = (data[dataIdx] || 128) / 128.0;
        const y = h / 2 + (v - 1) * (h / 2 - 2);
        
        if (i === 0) ctx.moveTo(i, y);
        else ctx.lineTo(i, y);
      }
      
      ctx.stroke();
    };

    const animate = () => {
      if (isPlaying) {
        drawScope(ctxL, timeDomainBytesL, 200, 40);
        drawScope(ctxR, timeDomainBytesR, 200, 40);
      } else {
        ctxL.fillStyle = '#000000';
        ctxL.fillRect(0, 0, 200, 40);
        ctxR.fillStyle = '#000000';
        ctxR.fillRect(0, 0, 200, 40);
        
        ctxL.strokeStyle = '#ffffff';
        ctxL.lineWidth = 1;
        ctxL.beginPath();
        ctxL.moveTo(0, 20);
        ctxL.lineTo(200, 20);
        ctxL.stroke();
        
        ctxR.strokeStyle = '#ffffff';
        ctxR.lineWidth = 1;
        ctxR.beginPath();
        ctxR.moveTo(0, 20);
        ctxR.lineTo(200, 20);
        ctxR.stroke();
      }
      animId = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => cancelAnimationFrame(animId);
  }, [timeDomainBytesL, timeDomainBytesR, isPlaying]);

  if (!isAuthenticated || !isGrooveflix) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[99998] bg-black flex">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .rack-font { font-family: 'IBM Plex Mono', monospace; }
        .rack-metal {
          background: linear-gradient(135deg, #1a1a1a 0%, #252525 50%, #1a1a1a 100%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.5);
        }
        .rack-border {
          border: 3px solid #1a1a1a;
          box-shadow: inset 0 0 0 1px #333, 0 4px 20px rgba(0,0,0,0.8);
        }
        .rack-screw {
          width: 10px;
          height: 10px;
          background: linear-gradient(145deg, #555, #222);
          border-radius: 50%;
          box-shadow: inset 0 1px 2px rgba(255,255,255,0.2), inset 0 -1px 2px rgba(0,0,0,0.5);
          position: relative;
        }
        .rack-screw::after {
          content: '+';
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #111;
          font-size: 8px;
          font-weight: bold;
        }
        .hw-button {
          background: white;
          border: none;
          color: black;
          transition: all 0.1s;
          box-shadow: 0 2px 4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.8);
        }
        .hw-button:hover { background: #ddd; }
        .hw-button:active { transform: translateY(1px); box-shadow: 0 1px 2px rgba(0,0,0,0.5); }
        .hw-button.active { background: #333; color: white; box-shadow: inset 0 2px 4px rgba(0,0,0,0.5); }
        .eq-fader {
          -webkit-appearance: none;
          appearance: none;
          writing-mode: vertical-lr;
          direction: rtl;
          background: transparent;
        }
        .eq-fader::-webkit-slider-runnable-track {
          width: 6px;
          height: 100%;
          background: #222;
          border: 1px solid #444;
        }
        .eq-fader::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 8px;
          background: white;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.5);
        }
        .knob {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(145deg, #fff, #ccc);
          box-shadow: 0 4px 8px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.8);
          position: relative;
        }
        .knob::after {
          content: '';
          position: absolute;
          top: 8px;
          left: 50%;
          transform: translateX(-50%);
          width: 3px;
          height: 12px;
          background: #111;
          border-radius: 2px;
        }
        .vu-bar {
          width: 10px;
          background: linear-gradient(to top, #666 0%, #fff 70%, #ff0000 100%);
          transition: height 0.05s;
        }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #444; }
        ::-webkit-scrollbar-thumb:hover { background: #555; }
      `}</style>

      {/* COLUNA ESQUERDA - TORRE DE COMANDO (20%) */}
      <div className="w-[20%] h-full rack-border rack-metal flex flex-col p-4 gap-5">
        <div className="flex justify-between">
          <div className="rack-screw" />
          <div className="rack-screw" />
        </div>

        <div className="flex flex-col items-center gap-3">
          <span className="text-white text-[9px] tracking-[0.2em] font-medium">VOLUME</span>
          <div className="knob" style={{ transform: `rotate(${-135 + volume * 270}deg)` }} />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="w-full h-1 bg-gray-700 rounded appearance-none cursor-pointer accent-white"
          />
          <div className="flex items-center gap-2">
            <button onClick={toggleMute} className="hw-button w-8 h-8 flex items-center justify-center">
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <span className="text-white text-[10px] font-mono w-10 text-right">{Math.round(volume * 100)}%</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-white text-[9px] tracking-[0.2em] font-medium text-center">TRANSPORT</span>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={toggleLoop} className={`hw-button h-9 flex items-center justify-center ${loopMode !== 'none' ? 'active' : ''}`}>
              {getLoopIcon()}
            </button>
            <button onClick={toggleShuffle} className={`hw-button h-9 flex items-center justify-center ${shuffle ? 'active' : ''}`}>
              <Shuffle className="w-4 h-4" />
            </button>
            <div />
            <button onClick={handlePrev} className="hw-button h-9 flex items-center justify-center">
              <SkipBack className="w-4 h-4" />
            </button>
            <button onClick={handlePlayPause} className="hw-button h-11 flex items-center justify-center">
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button onClick={handleNext} className="hw-button h-9 flex items-center justify-center">
              <SkipForward className="w-4 h-4" />
            </button>
            <div />
            <button onClick={handleStop} className="hw-button h-9 flex items-center justify-center">
              <Square className="w-4 h-4" />
            </button>
            <div />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-white text-[9px] tracking-[0.2em] font-medium text-center">PREAMP</span>
          <input
            type="range"
            min="-12"
            max="12"
            step="0.5"
            value={preAmp}
            onChange={handlePreAmpChange}
            className="w-full h-1 bg-gray-700 rounded appearance-none cursor-pointer accent-white"
          />
          <span className="text-white text-[10px] text-center font-mono">{preAmp > 0 ? '+' : ''}{preAmp.toFixed(1)} dB</span>
        </div>

        <div className="flex-1" />
        
        <div className="text-center">
          <span className="text-gray-500 text-[7px] tracking-[0.15em]">RAREGROOVE v1.0</span>
        </div>

        <div className="flex justify-between">
          <div className="rack-screw" />
          <div className="rack-screw" />
        </div>
      </div>

      {/* COLUNA CENTRAL - CONTEÚDO (55%) */}
      <div className="w-[55%] h-full rack-border bg-black flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex items-center gap-4">
          <div className="w-10 h-10 bg-white rounded flex items-center justify-center shrink-0">
            <Disc3 className={`w-5 h-5 text-black ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
          </div>
          <div className="flex-1">
            <h2 className="text-white text-sm font-bold tracking-[0.2em]">GROOVEFLIX</h2>
            <p className="text-gray-500 text-[9px] tracking-wider">AUDIO MASTER CONSOLE</p>
          </div>
        </div>

        <div className="p-4 border-b border-gray-800">
          <h3 className="text-white text-base font-bold truncate">{currentTrack?.title || 'Selecione uma faixa'}</h3>
          <p className="text-gray-400 text-sm truncate">{currentTrack?.artist || ''}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <h4 className="text-gray-500 text-[9px] tracking-[0.2em] mb-3">PLAYLIST ({queue.length} TRACKS)</h4>
          <div className="space-y-0.5">
            {queue.map((track, idx) => (
              <button
                key={track.id}
                onClick={() => {
                  setCurrentTrack(track);
                  hydrateAndPlayRef.current?.(idx);
                }}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-3 transition rack-font ${
                  currentTrack?.id === track.id 
                    ? 'bg-white text-black' 
                    : 'text-gray-300 hover:bg-gray-900 hover:text-white'
                }`}
              >
                <span className="w-5 text-center text-xs opacity-60">{idx + 1}</span>
                <span className="flex-1 truncate">{track.title}</span>
                <span className="text-xs opacity-50">{track.duration || '--:--'}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3">
            <span className="text-gray-500 text-[9px] font-mono w-10">{formatTime(currentTime)}</span>
            <div 
              className="flex-1 h-1 bg-gray-800 rounded cursor-pointer"
              onClick={handleSeek}
            >
              <div 
                className="h-full bg-white rounded transition-all"
                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
            <span className="text-gray-500 text-[9px] font-mono w-10 text-right">{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* COLUNA DIREITA - VISUALIZADORES (25%) */}
      <div className="w-[25%] h-full rack-border rack-metal flex flex-col p-4 gap-4 overflow-y-auto">
        <div className="flex justify-between">
          <div className="rack-screw" />
          <div className="rack-screw" />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-white text-[9px] tracking-[0.2em] font-medium text-center">LEVEL METERS</span>
          <div className="flex gap-6 justify-center">
            <div className="flex flex-col items-center gap-1">
              <span className="text-gray-400 text-[8px]">L</span>
              <div className="w-10 h-28 bg-black border border-gray-700 relative">
                <div 
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-400 to-white transition-all"
                  style={{ height: `${vuMeterData?.leftRMS ? Math.min(100, (vuMeterData.leftRMS + 1) * 50) : 0}%` }}
                />
                <div className="absolute left-0 right-0 h-0.5 bg-red-500" style={{ top: '20%' }} />
              </div>
              <span className="text-gray-400 text-[8px] font-mono">{vuMeterData?.leftRMSDb?.toFixed(0) || '-∞'} dB</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-gray-400 text-[8px]">R</span>
              <div className="w-10 h-28 bg-black border border-gray-700 relative">
                <div 
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-400 to-white transition-all"
                  style={{ height: `${vuMeterData?.rightRMS ? Math.min(100, (vuMeterData.rightRMS + 1) * 50) : 0}%` }}
                />
                <div className="absolute left-0 right-0 h-0.5 bg-red-500" style={{ top: '20%' }} />
              </div>
              <span className="text-gray-400 text-[8px] font-mono">{vuMeterData?.rightRMSDb?.toFixed(0) || '-∞'} dB</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-white text-[9px] tracking-[0.2em] font-medium text-center">OSCILLOSCOPE</span>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-[8px] w-5 text-right">L</span>
              <canvas
                ref={canvasLRef}
                width={200}
                height={36}
                className="flex-1 h-9 bg-black border border-gray-700"
                style={{ display: 'block' }}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-[8px] w-5 text-right">R</span>
              <canvas
                ref={canvasRRef}
                width={200}
                height={36}
                className="flex-1 h-9 bg-black border border-gray-700"
                style={{ display: 'block' }}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-white text-[9px] tracking-[0.2em] font-medium text-center">GRAPHIC EQ</span>
          <div className="flex justify-between items-end h-28 px-2">
            {EQ_FREQUENCIES_5.map((freq, idx) => {
              const value = eqBands?.[freq] || 0;
              return (
                <div key={freq} className="flex flex-col items-center gap-1">
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    step="0.5"
                    value={value}
                    onChange={(e) => handleEqChange(freq, e.target.value)}
                    className="eq-fader h-24"
                  />
                  <span className="text-gray-400 text-[8px] font-mono">{EQ_LABELS[idx]}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1" />
        
        <div className="text-center">
          <span className="text-gray-500 text-[7px] tracking-[0.15em]">HI-FI AUDIO MASTER</span>
        </div>

        <div className="flex justify-between">
          <div className="rack-screw" />
          <div className="rack-screw" />
        </div>
      </div>

      {isLoading && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
