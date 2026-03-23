import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Square, Volume2, VolumeX,
  Repeat, Repeat1, Shuffle, ChevronUp, ChevronDown, X,
  Music, Disc3, Headphones, Sliders, BarChart3
} from 'lucide-react';
import { useSuperPlayer } from '../hooks/useSuperPlayer';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { toast } from 'sonner';

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
    const ht = queue.length > 0 && currentTrack;
    if (!ht || queue.length === 0) return;
    
    const idx = queue.findIndex(t => t.id === currentTrack?.id);
    if (idx >= 0) {
      setCurrentQueueIndex(idx);
    }
  }, [currentTrack, queue]);

  useEffect(() => {
    const ht = queue.length > 0 && currentTrack;
    if (!currentTrack || !globalIsPlaying || !ht) return;
    
    const playCurrentTrack = async () => {
      const idx = queue.findIndex(t => t.id === currentTrack?.id);
      if (idx >= 0 && idx !== currentQueueIndex) {
        await hydrateAndPlay(idx);
      } else if (idx >= 0 && idx === currentQueueIndex && !isPlaying) {
        await play();
      }
    };
    
    playCurrentTrack();
  }, [currentTrack, globalIsPlaying]);

  const hydrateAndPlay = useCallback(async (index) => {
    if (index < 0 || index >= queue.length) return;
    
    const track = queue[index];
    if (!track?.audioPath) {
      console.log('[SUPER PLAYER] No audioPath for track:', track?.title);
      return;
    }

    console.log('[SUPER PLAYER] Hydrating track:', track.title, 'path:', track.audioPath);
    setIsLoading(true);
    setDebug(`Loading: ${track.title}`);
    
    try {
      let url = trackUrls[track.audioPath];
      
      if (!url) {
        console.log('[SUPER PLAYER] Fetching presigned URL...');
        url = await getPresignedUrl(track.audioPath);
        console.log('[SUPER PLAYER] Presigned URL:', url ? 'received' : 'null');
        if (url) {
          setTrackUrls(prev => ({ ...prev, [track.audioPath]: url }));
        }
      }
      
      if (url) {
        console.log('[SUPER PLAYER] Loading track with URL...');
        await loadTrack(url);
        await play();
        setCurrentTrack(track);
        setGlobalIsPlaying(true);
        setCurrentQueueIndex(index);
        setDebug('');
      } else {
        setDebug('URL error');
        toast.error('Erro ao obter URL do áudio');
      }
    } catch (e) {
      console.error('[SUPER PLAYER] Load error:', e);
      setDebug('Error: ' + e.message);
      toast.error('Erro ao carregar faixa');
    } finally {
      setIsLoading(false);
    }
  }, [queue, trackUrls, getPresignedUrl, loadTrack, play, setCurrentTrack, setGlobalIsPlaying]);

  const handlePlayPause = useCallback(async () => {
    if (!isReady) {
      initAudioContext();
      await new Promise(r => setTimeout(r, 100));
    }
    
    if (isPlaying) {
      pause();
      setGlobalIsPlaying(false);
    } else {
      await play();
      setGlobalIsPlaying(true);
    }
  }, [isReady, isPlaying, initAudioContext, play, pause, setGlobalIsPlaying]);

  const handleStop = useCallback(() => {
    stop();
    setGlobalIsPlaying(false);
  }, [stop, setGlobalIsPlaying]);

  const handleNext = useCallback(async () => {
    const next = getNextTrack(queue, currentQueueIndex);
    if (next) {
      await hydrateAndPlay(next.index);
    } else if (loopMode === 'playlist' && queue.length > 0) {
      await hydrateAndPlay(0);
    }
  }, [queue, currentQueueIndex, getNextTrack, hydrateAndPlay, loopMode]);

  const handlePrev = useCallback(async () => {
    if (currentTime > 3) {
      seek(0);
      return;
    }
    
    const prev = getPrevTrack(queue, currentQueueIndex);
    if (prev) {
      await hydrateAndPlay(prev.index);
    } else {
      seek(0);
    }
  }, [currentTime, seek, queue, currentQueueIndex, getPrevTrack, hydrateAndPlay]);

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
      default: return <Repeat className="w-4 h-4 opacity-50" />;
    }
  };

  const hasTrack = queue.length > 0 && currentTrack;

  console.log('[SUPER PLAYER] Render:', { userId: !!userId, hasTrack, queueLength: queue.length, currentTrack: currentTrack?.title, debug });
  console.log('[SUPER PLAYER] isPlaying:', isPlaying, 'globalIsPlaying:', globalIsPlaying);

  return (
    <>
      <div
        className={`fixed bottom-4 right-4 z-[99999] transition-all duration-300 ${
          isExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <div className="flex items-center gap-3 bg-gradient-to-r from-black via-fuchsia-950/80 to-black border border-fuchsia-500/40 rounded-2xl px-4 py-3 shadow-2xl shadow-fuchsia-500/20">
          <div className="w-10 h-10 rounded-xl bg-fuchsia-500/20 border border-fuchsia-500/30 flex items-center justify-center">
            <Music className={`w-5 h-5 text-fuchsia-400 ${isPlaying ? 'animate-pulse' : ''}`} />
          </div>
          
          <div className="min-w-0 max-w-[150px]">
            <p className="text-white text-xs font-bold truncate">{currentTrack?.title || (debug ? `... ${debug}` : 'Grooveflix')}</p>
            <p className="text-white/50 text-[10px] truncate">{currentTrack?.artist || (userId ? 'Pronto para tocar' : 'Aguardando...')}</p>
            {queue.length > 1 && (
              <p className="text-fuchsia-400/70 text-[9px]">{currentQueueIndex + 1}/{queue.length}</p>
            )}
            {!userId && (
              <p className="text-red-400/70 text-[9px]">Sem userId</p>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handlePlayPause}
              className="w-8 h-8 rounded-lg bg-fuchsia-500/20 hover:bg-fuchsia-500/30 flex items-center justify-center text-fuchsia-300 transition"
              title={isPlaying ? 'Pausar' : 'Reproduzir'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setIsExpanded(true)}
              className="w-8 h-8 rounded-lg bg-fuchsia-500/20 hover:bg-fuchsia-500/30 flex items-center justify-center text-fuchsia-300 transition"
              title="Player Completo"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="fixed bottom-4 right-4 z-[99998] w-[420px] bg-gradient-to-br from-gray-950 via-purple-950/95 to-fuchsia-950/95 border border-fuchsia-500/30 rounded-2xl shadow-2xl shadow-fuchsia-500/20 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Headphones className="w-4 h-4 text-fuchsia-400" />
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
                  ? 'text-fuchsia-400 border-b-2 border-fuchsia-400 bg-fuchsia-500/10' 
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
                  ? 'text-fuchsia-400 border-b-2 border-fuchsia-400 bg-fuchsia-500/10' 
                  : 'text-white/50 hover:text-white/70'
              }`}
            >
              <BarChart3 className="w-4 h-4 mx-auto mb-1" />
              Visualizador
            </button>
            <button
              onClick={() => setActivePanel('queue')}
              className={`flex-1 py-2 text-xs font-medium transition ${
                activePanel === 'queue' 
                  ? 'text-fuchsia-400 border-b-2 border-fuchsia-400 bg-fuchsia-500/10' 
                  : 'text-white/50 hover:text-white/70'
              }`}
            >
              <Disc3 className="w-4 h-4 mx-auto mb-1" />
              Queue ({queue.length})
            </button>
          </div>

          {activePanel === 'eq' && (
            <div className="p-4 space-y-4">
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
                className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-fuchsia-500"
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
                      className="w-4 h-24 bg-white/10 rounded-full appearance-none cursor-pointer accent-fuchsia-500 writing-mode-vertical"
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
                    className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-fuchsia-500"
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
                    className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-fuchsia-500"
                  />
                </div>
              </div>
            </div>
          )}

          {activePanel === 'visualizer' && (
            <div className="p-4">
              <div className="h-32 bg-black/30 rounded-lg flex items-end justify-center gap-[2px] p-2">
                {Array.from(analyserData).slice(0, 64).map((value, i) => (
                  <div
                    key={i}
                    className="w-full bg-gradient-to-t from-fuchsia-600 to-fuchsia-400 rounded-sm transition-all duration-75"
                    style={{ 
                      height: `${Math.max(2, (value / 255) * 100)}%`,
                      opacity: 0.6 + (value / 510)
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center justify-center gap-4 mt-3">
                <button
                  onClick={toggleShuffle}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${
                    shuffle 
                      ? 'bg-fuchsia-500/30 text-fuchsia-300' 
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
                      ? 'bg-fuchsia-500/30 text-fuchsia-300' 
                      : 'bg-white/10 text-white/50 hover:text-white'
                  }`}
                  title={`Loop: ${loopMode}`}
                >
                  {getLoopIcon()}
                </button>
              </div>
            </div>
          )}

          {activePanel === 'queue' && (
            <div className="p-2 max-h-64 overflow-y-auto">
              {queue.map((track, i) => (
                <button
                  key={track.id || i}
                  onClick={() => hydrateAndPlay(i)}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition ${
                    i === currentQueueIndex
                      ? 'bg-fuchsia-500/30 border border-fuchsia-500/50'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <span className={`w-6 text-center text-sm ${
                    i === currentQueueIndex ? 'text-fuchsia-300' : 'text-white/30'
                  }`}>
                    {i === currentQueueIndex && isPlaying ? (
                      <span className="flex items-center justify-center">
                        <span className="w-1 h-2 bg-fuchsia-400 rounded-sm animate-pulse" />
                        <span className="w-1 h-3 bg-fuchsia-400 rounded-sm animate-pulse mx-px" />
                        <span className="w-1 h-1.5 bg-fuchsia-400 rounded-sm animate-pulse" />
                      </span>
                    ) : i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${i === currentQueueIndex ? 'text-white' : 'text-white/80'}`}>
                      {track.title}
                    </p>
                    <p className="text-xs text-white/40 truncate">{track.artist}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="p-4 border-t border-white/10">
            <div 
              className="h-2 bg-white/10 rounded-full cursor-pointer mb-2"
              onClick={handleSeek}
            >
              <div 
                className="h-full bg-gradient-to-r from-fuchsia-500 to-purple-500 rounded-full transition-all"
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
                    ? 'bg-fuchsia-500/30 text-fuchsia-300' 
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
                className="w-14 h-14 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-500 hover:from-fuchsia-400 hover:to-purple-400 flex items-center justify-center text-white shadow-lg shadow-fuchsia-500/30 transition"
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
                    ? 'bg-fuchsia-500/30 text-fuchsia-300' 
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
                className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-fuchsia-500"
              />
            </div>
          </div>

          {isLoading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-fuchsia-500/30 border-t-fuchsia-500 rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}
    </>
  );
}
