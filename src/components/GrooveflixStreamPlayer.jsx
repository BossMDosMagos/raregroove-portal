import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Music, X, Play, Pause, SkipForward, Loader2 } from 'lucide-react';
import Webamp from 'webamp';
import { useGrooveflixPlayer } from '../contexts/GrooveflixPlayerContext';
import { LOCAL_SKINS, DEFAULT_SKIN_ID, getSkinFromLocalStorage } from '../utils/webampSkins';

export function GrooveflixStreamPlayer({ item, onClose }) {
  const {
    queue,
    currentIndex,
    isPlaying,
    loadingTrack,
    playAlbum,
    playNext,
    getCurrentTrack,
    getMetaTracks,
    setIsPlaying,
    audioCache,
  } = useGrooveflixPlayer();

  const [isReady, setIsReady] = useState(false);
  const webampRef = useRef(null);
  const containerRef = useRef(null);
  const initializedRef = useRef(false);
  const lastPlayedIndexRef = useRef(-1);
  const startedRef = useRef(false);

  useEffect(() => {
    const initPlayer = async () => {
      if (initializedRef.current || !containerRef.current) return;
      initializedRef.current = true;

      if (!Webamp.browserIsSupported()) {
        console.error('[STREAM PLAYER] Browser not supported');
        return;
      }

      const skin = getSkinFromLocalStorage();
      const skinUrl = skin.url || LOCAL_SKINS.find(s => s.id === DEFAULT_SKIN_ID)?.url;

      const webamp = new Webamp({
        initialSkin: { url: skinUrl },
        zIndex: 99999,
      });

      webampRef.current = webamp;

      webamp.renderWhenReady(containerRef.current).then(() => {
        console.log('[STREAM PLAYER] Webamp ready');
        setIsReady(true);
      }).catch(err => {
        console.error('[STREAM PLAYER] Webamp render error:', err);
      });

      webamp.onClose?.(() => {
        onClose?.();
      });
    };

    initPlayer();

    return () => {
      if (webampRef.current) {
        try {
          webampRef.current.dispose?.();
        } catch (e) {}
        webampRef.current = null;
      }
      initializedRef.current = false;
      startedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isReady || !item || startedRef.current) return;
    
    const start = async () => {
      startedRef.current = true;
      console.log('[STREAM PLAYER] Starting:', item.title);
      
      const result = await playAlbum(item);
      
      if (result?.url) {
        const metaTracks = getMetaTracks();
        
        const tracksWithAudio = metaTracks.map((track, idx) => 
          idx === 0 ? { ...track, url: result.url } : track
        );

        webampRef.current?.setTracksToPlay?.(tracksWithAudio);
        
        setTimeout(() => {
          webampRef.current?.showPlaylistWindow?.();
        }, 200);
      }
    };

    start();
  }, [isReady, item, playAlbum, getMetaTracks]);

  useEffect(() => {
    if (!isReady || !webampRef.current || queue.length === 0) return;

    const currentTrack = getCurrentTrack();
    if (!currentTrack) return;

    if (currentIndex !== lastPlayedIndexRef.current) {
      const cachedUrl = audioCache.get(currentTrack.audioPath);
      
      if (cachedUrl) {
        console.log('[STREAM PLAYER] Loading cached track:', currentTrack.title);
        lastPlayedIndexRef.current = currentIndex;
        
        const metaTracks = getMetaTracks();
        const tracksWithAudio = metaTracks.map((track, idx) => 
          idx === currentIndex ? { ...track, url: cachedUrl } : track
        );

        webampRef.current?.setTracksToPlay?.(tracksWithAudio);
      }
    }
  }, [isReady, currentIndex, queue, getCurrentTrack, getMetaTracks, audioCache]);

  const handlePlayPause = () => {
    if (webampRef.current) {
      if (isPlaying) {
        webampRef.current.pause?.();
      } else {
        webampRef.current.play?.();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleNext = async () => {
    if (!webampRef.current) return;
    
    const result = await playNext();
    if (result?.url) {
      lastPlayedIndexRef.current = currentIndex + 1;
      
      const metaTracks = getMetaTracks();
      const tracksWithAudio = metaTracks.map((track, idx) => 
        idx === currentIndex + 1 ? { ...track, url: result.url } : track
      );
      
      webampRef.current?.setTracksToPlay?.(tracksWithAudio);
    }
  };

  const currentTrack = getCurrentTrack();

  return (
    <div className="fixed inset-0 z-[99998] flex flex-col bg-black/95">
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-charcoal-deep to-black">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-500/30 to-purple-500/30 border border-fuchsia-500/50 flex items-center justify-center shadow-lg shadow-fuchsia-500/20">
            <Music className="w-6 h-6 text-fuchsia-300" />
          </div>
          <div>
            <h3 className="text-white font-black text-lg">{item?.title || 'Grooveflix HI-FI'}</h3>
            <p className="text-white/60 text-sm">
              {loadingTrack ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin text-fuchsia-400" />
                  Carregando...
                </span>
              ) : (
                currentTrack?.artist || 'Instant Streaming'
              )}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handlePlayPause}
            disabled={loadingTrack}
            className="w-14 h-14 rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-600 flex items-center justify-center text-white hover:scale-105 transition shadow-lg shadow-fuchsia-500/30 disabled:opacity-50 disabled:hover:scale-100"
          >
            {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
          </button>
          
          <button
            onClick={handleNext}
            disabled={loadingTrack || currentIndex >= queue.length - 1}
            className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/20 hover:text-white transition disabled:opacity-30"
          >
            <SkipForward className="w-6 h-6" />
          </button>
          
          <div className="w-px h-8 bg-white/10 mx-2" />
          
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/50 hover:bg-white/20 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div ref={containerRef} className="flex-1" />
      </div>

      <div className="p-3 border-t border-white/10 bg-black/50">
        <div className="flex items-center justify-between text-xs text-white/40">
          <span>{queue.length} faixas • Streaming Instantâneo</span>
          <span>{loadingTrack ? 'Carregando próxima...' : 'Tocando agora'}</span>
        </div>
      </div>
    </div>
  );
}

export default GrooveflixStreamPlayer;
