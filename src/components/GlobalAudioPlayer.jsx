import React, { useState, useEffect, useRef } from 'react';
import { Music, X, ChevronUp, Headphones, Palette } from 'lucide-react';
import { toast } from 'sonner';
import Webamp from 'webamp';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { LOCAL_SKINS, DEFAULT_SKIN_ID, getSkinFromLocalStorage } from '../utils/webampSkins';
import SkinSelector from './SkinSelector';

export function GlobalAudioPlayer() {
  const {
    currentTrack,
    queue,
    webampTracks,
    userId,
    setWebampRef,
    setIsPlaying,
    setCurrentTrack,
    listenersRef,
    closePlayer,
    playAlbum,
    isPlaying,
    setSelectedSkin,
    loadingTrackId,
    hydrateTrack,
  } = useAudioPlayer();

  const [divRef, setDivRef] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isWebampRendered, setIsWebampRendered] = useState(false);
  const [showSkinSelector, setShowSkinSelector] = useState(false);
  const [currentSkinId, setCurrentSkinId] = useState(DEFAULT_SKIN_ID);
  const [currentSkinUrl, setCurrentSkinUrl] = useState(null);
  const webampInstanceRef = useRef(null);
  const hasInitializedRef = useRef(false);
  const prevTrackRef = useRef(null);
  const prevWebampTracksRef = useRef([]);
  const currentIndexRef = useRef(0);
  const hydratingRef = useRef(false);

  const hasTrack = queue.length > 0 && currentTrack;

  useEffect(() => {
    const skin = getSkinFromLocalStorage();
    setCurrentSkinId(skin.id);
    setCurrentSkinUrl(skin.url);
    console.log('[GLOBAL PLAYER] Loaded skin:', skin.name);
  }, []);

  useEffect(() => {
    if (currentTrack && currentTrack !== prevTrackRef.current) {
      console.log('[GLOBAL PLAYER] New track:', currentTrack.title);
      prevTrackRef.current = currentTrack;
      
      if (!isWebampRendered) {
        console.log('[GLOBAL PLAYER] Auto-expanding player');
        setIsExpanded(true);
      } else if (webampInstanceRef.current && queue.length > 1) {
        webampInstanceRef.current.showPlaylistWindow?.();
      }
    }
  }, [currentTrack, isWebampRendered, queue.length]);

  const hydrateAndPlay = async (index) => {
    if (hydratingRef.current) return;
    hydratingRef.current = true;
    
    const url = await hydrateTrack(index);
    
    if (url && webampInstanceRef.current) {
      console.log('[GLOBAL PLAYER] Playing hydrated track');
      try {
        webampInstanceRef.current.play?.();
      } catch (e) {
        console.error('[GLOBAL PLAYER] Play error:', e);
      }
    }
    
    hydratingRef.current = false;
  };

  useEffect(() => {
    if (!divRef) return;
    if (!hasTrack || webampTracks.length === 0) return;
    if (hasInitializedRef.current && isWebampRendered) return;

    console.log('[GLOBAL PLAYER] Init Webamp with', webampTracks.length, 'JIT tracks');

    if (!Webamp.browserIsSupported()) {
      toast.error('Navegador não suportado', {
        description: 'Webamp requer suporte a WebGL.',
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
      return;
    }

    const skinToUse = currentSkinUrl || LOCAL_SKINS.find(s => s.id === currentSkinId)?.url || LOCAL_SKINS[0].url;

    if (webampInstanceRef.current) {
      try {
        if (listenersRef.current.onClose) listenersRef.current.onClose();
        if (listenersRef.current.onTrackDidChange) listenersRef.current.onTrackDidChange();
        webampInstanceRef.current.dispose?.();
        webampInstanceRef.current = null;
      } catch (e) {
        console.error('[GLOBAL PLAYER] Cleanup error:', e);
      }
    }

    const webamp = new Webamp({
      initialTracks: webampTracks,
      initialSkin: { url: skinToUse },
      zIndex: 99999,
    });

    webampInstanceRef.current = webamp;
    setWebampRef(webamp);
    hasInitializedRef.current = true;

    webamp.renderWhenReady(divRef)
      .then(async () => {
        console.log('[GLOBAL PLAYER] Webamp ready');
        setIsWebampRendered(true);

        if (queue.length > 1) {
          webamp.showPlaylistWindow?.();
        }

        currentIndexRef.current = 0;
        await hydrateAndPlay(0);

        const unsubClose = webamp.onClose?.(() => {
          setIsExpanded(false);
          setIsPlaying(false);
        });

        const unsubTrack = webamp.onTrackDidChange?.((track) => {
          if (!track?.metaData) return;
          
          const idx = webampTracks.findIndex(
            (t) => t.metaData?.title === track.metaData?.title && 
                  t.metaData?.artist === track.metaData?.artist
          );
          
          if (idx >= 0) {
            currentIndexRef.current = idx;
            const matchingQueueItem = queue.find(
              (q) => q.title === track.metaData.title && q.artist === track.metaData.artist
            );
            if (matchingQueueItem) {
              setCurrentTrack(matchingQueueItem);
            }
            hydrateAndPlay(idx);
          }
        });

        listenersRef.current.onClose = unsubClose;
        listenersRef.current.onTrackDidChange = unsubTrack;
      })
      .catch((err) => {
        console.error('[GLOBAL PLAYER] Render error:', err);
        hasInitializedRef.current = false;
        toast.error('Erro no player', { description: err.message });
      });

  }, [divRef, hasTrack, webampTracks.length, userId, currentSkinUrl, currentSkinId, queue]);

  useEffect(() => {
    if (!webampInstanceRef.current || webampTracks.length === 0 || !isWebampRendered) return;
    
    const currentJson = JSON.stringify(webampTracks.map(t => ({ url: t.url, title: t.metaData?.title })));
    const prevJson = JSON.stringify(prevWebampTracksRef.current.map(t => ({ url: t.url, title: t.metaData?.title })));
    
    if (currentJson === prevJson) return;
    
    console.log('[GLOBAL PLAYER] Updating playlist:', webampTracks.length, 'tracks');
    prevWebampTracksRef.current = webampTracks;
    
    try {
      webampInstanceRef.current.setTracksToPlay?.(webampTracks);
      if (queue.length > 1) {
        webampInstanceRef.current.showPlaylistWindow?.();
      }
    } catch (e) {
      console.error('[GLOBAL PLAYER] Set tracks error:', e);
    }
  }, [webampTracks, isWebampRendered, queue.length]);

  const handleSkinChange = (skin) => {
    console.log('[GLOBAL PLAYER] Change skin:', skin.name);
    setCurrentSkinId(skin.id);
    setCurrentSkinUrl(skin.url);
    
    hasInitializedRef.current = false;
    setIsWebampRendered(false);
    setShowSkinSelector(false);
    
    if (webampInstanceRef.current) {
      try {
        webampInstanceRef.current.dispose?.();
        webampInstanceRef.current = null;
      } catch (e) {
        console.error('[GLOBAL PLAYER] Dispose error:', e);
      }
    }
    
    if (divRef && hasTrack) {
      setTimeout(() => {
        hasInitializedRef.current = false;
        setIsWebampRendered(false);
      }, 100);
    }
  };

  const handlePlayAlbum = () => {
    if (currentTrack?.category === 'album') {
      playAlbum(currentTrack);
    } else {
      setIsExpanded(true);
    }
  };

  const handleExpand = () => {
    setIsExpanded(true);
    hasInitializedRef.current = false;
    setIsWebampRendered(false);
    prevWebampTracksRef.current = [];
  };

  const handleClose = () => {
    setIsExpanded(false);
    if (webampInstanceRef.current) {
      try {
        if (listenersRef.current.onClose) listenersRef.current.onClose();
        if (listenersRef.current.onTrackDidChange) listenersRef.current.onTrackDidChange();
        webampInstanceRef.current.dispose?.();
        webampInstanceRef.current = null;
        hasInitializedRef.current = false;
        setIsWebampRendered(false);
        prevWebampTracksRef.current = [];
      } catch (e) {
        console.error('[GLOBAL PLAYER] Error disposing:', e);
      }
    }
  };

  const getCurrentSkinName = () => {
    const skin = LOCAL_SKINS.find(s => s.id === currentSkinId);
    return skin?.name || 'Classic';
  };

  if (!userId) return null;
  if (!hasTrack) return null;

  return (
    <>
      {showSkinSelector && (
        <SkinSelector
          currentSkinId={currentSkinId}
          onSkinChange={handleSkinChange}
          onClose={() => setShowSkinSelector(false)}
        />
      )}

      {loadingTrackId && (
        <div className="fixed bottom-20 right-4 flex items-center gap-2 bg-black/95 border border-fuchsia-500/30 rounded-xl px-4 py-2 shadow-lg z-[99997]">
          <div className="w-4 h-4 border-2 border-fuchsia-500/30 border-t-fuchsia-500 rounded-full animate-spin" />
          <span className="text-fuchsia-300 text-xs">Carregando áudio...</span>
        </div>
      )}

      {isExpanded && (
        <div
          ref={setDivRef}
          style={{
            position: 'fixed',
            bottom: 80,
            right: 20,
            width: 470,
            height: 350,
            zIndex: 99998,
          }}
        />
      )}

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
            <p className="text-white text-xs font-bold truncate">{currentTrack?.title || 'Tocando...'}</p>
            <p className="text-white/50 text-[10px] truncate">{currentTrack?.artist || ''}</p>
            {queue.length > 1 && (
              <p className="text-fuchsia-400/70 text-[9px]">{queue.length} faixas</p>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSkinSelector(true)}
              className="w-8 h-8 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 flex items-center justify-center text-purple-300 transition"
              title="Trocar skin"
            >
              <Palette className="w-4 h-4" />
            </button>
            {currentTrack?.category === 'album' && (
              <button
                onClick={handlePlayAlbum}
                className="w-8 h-8 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 flex items-center justify-center text-purple-300 transition"
                title="Tocar álbum completo"
              >
                <Headphones className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleExpand}
              className="w-8 h-8 rounded-lg bg-fuchsia-500/20 hover:bg-fuchsia-500/30 flex items-center justify-center text-fuchsia-300 transition"
              title="Expandir player"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
