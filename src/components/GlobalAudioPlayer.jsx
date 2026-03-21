import React, { useState, useEffect, useRef } from 'react';
import { Music, X, ChevronUp, Headphones } from 'lucide-react';
import { toast } from 'sonner';
import Webamp from 'webamp';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';

const DEFAULT_SKIN = 'https://cdn.jsdelivr.net/npm/webamp@2.2.0/skins/base-2.91.wsz';

export function GlobalAudioPlayer() {
  const {
    currentTrack,
    queue,
    webampTracks,
    userId,
    setWebampRef,
    setIsPlaying,
    setCurrentTrack,
    preparing,
    listenersRef,
    closePlayer,
    selectedSkin,
    playAlbum,
    isPlaying,
  } = useAudioPlayer();

  const [divRef, setDivRef] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isWebampRendered, setIsWebampRendered] = useState(false);
  const webampInstanceRef = useRef(null);
  const hasInitializedRef = useRef(false);
  const currentSkinRef = useRef(null);
  const prevTrackRef = useRef(null);
  const prevWebampTracksRef = useRef([]);

  const hasTrack = queue.length > 0 && currentTrack;

  useEffect(() => {
    if (currentTrack && currentTrack !== prevTrackRef.current) {
      console.log('[GLOBAL PLAYER] New track selected:', currentTrack.title, 'category:', currentTrack.category);
      prevTrackRef.current = currentTrack;
      
      if (!isWebampRendered) {
        console.log('[GLOBAL PLAYER] Auto-expanding player');
        setIsExpanded(true);
      } else if (webampInstanceRef.current && queue.length > 1) {
        console.log('[GLOBAL PLAYER] Showing playlist for album');
        webampInstanceRef.current.showPlaylistWindow?.();
      }
    }
  }, [currentTrack, isWebampRendered, queue.length]);

  useEffect(() => {
    if (!divRef) return;
    if (!hasTrack || webampTracks.length === 0) return;
    if (hasInitializedRef.current && isWebampRendered) return;

    console.log('[GLOBAL PLAYER] Initializing Webamp with', webampTracks.length, 'tracks');

    if (!Webamp.browserIsSupported()) {
      toast.error('Navegador não suportado', {
        description: 'Webamp requer suporte a WebGL.',
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
      return;
    }

    const skinToUse = selectedSkin || DEFAULT_SKIN;

    if (webampInstanceRef.current) {
      try {
        if (listenersRef.current.onClose) listenersRef.current.onClose();
        if (listenersRef.current.onTrackDidChange) listenersRef.current.onTrackDidChange();
        webampInstanceRef.current.dispose?.();
        webampInstanceRef.current = null;
        hasInitializedRef.current = false;
      } catch (e) {
        console.error('[GLOBAL PLAYER] Error cleaning up:', e);
      }
    }

    const webamp = new Webamp({
      initialTracks: webampTracks,
      zIndex: 99999,
    });

    webampInstanceRef.current = webamp;
    setWebampRef(webamp);
    hasInitializedRef.current = true;
    currentSkinRef.current = skinToUse;

    webamp.renderWhenReady(divRef)
      .then(() => {
        console.log('[GLOBAL PLAYER] Webamp rendered successfully');
        setIsWebampRendered(true);

        if (skinToUse !== DEFAULT_SKIN && webamp.setSkinFromUrl) {
          webamp.setSkinFromUrl(skinToUse).catch(err => {
            console.error('[GLOBAL PLAYER] Error applying skin:', err);
          });
        }

        if (queue.length > 1) {
          console.log('[GLOBAL PLAYER] Showing playlist for', queue.length, 'tracks');
          webamp.showPlaylistWindow?.();
        }

        const unsubClose = webamp.onClose?.(() => {
          console.log('[GLOBAL PLAYER] Webamp closed by user');
          setIsExpanded(false);
          setIsPlaying(false);
        });

        const unsubTrack = webamp.onTrackDidChange?.((track) => {
          if (!track?.metaData) return;
          const matchingQueueItem = queue.find(
            (q) => q.title === track.metaData.title && q.artist === track.metaData.artist
          );
          if (matchingQueueItem) {
            setCurrentTrack(matchingQueueItem);
          }
        });

        listenersRef.current.onClose = unsubClose;
        listenersRef.current.onTrackDidChange = unsubTrack;
      })
      .catch((err) => {
        console.error('[GLOBAL PLAYER] Error rendering:', err);
        hasInitializedRef.current = false;
        toast.error('Erro no player', {
          description: err.message,
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
        });
      });

  }, [divRef, hasTrack, webampTracks.length, userId, selectedSkin, queue]);

  useEffect(() => {
    if (webampInstanceRef.current && webampTracks.length > 0 && isWebampRendered) {
      if (JSON.stringify(webampTracks) !== JSON.stringify(prevWebampTracksRef.current)) {
        console.log('[GLOBAL PLAYER] Setting tracks to play:', webampTracks.length);
        prevWebampTracksRef.current = webampTracks;
        try {
          if (webampInstanceRef.current.setTracksToPlay) {
            webampInstanceRef.current.setTracksToPlay(webampTracks);
          }
          if (queue.length > 1) {
            webampInstanceRef.current.showPlaylistWindow?.();
          }
        } catch (e) {
          console.error('[GLOBAL PLAYER] Error setting tracks:', e);
        }
      }
    }
  }, [webampTracks, isWebampRendered, queue.length]);

  useEffect(() => {
    if (webampInstanceRef.current && selectedSkin && selectedSkin !== currentSkinRef.current) {
      console.log('[GLOBAL PLAYER] Applying new skin:', selectedSkin);
      if (webampInstanceRef.current.setSkinFromUrl) {
        webampInstanceRef.current.setSkinFromUrl(selectedSkin)
          .then(() => {
            currentSkinRef.current = selectedSkin;
          })
          .catch(err => {
            console.error('[GLOBAL PLAYER] Error applying skin:', err);
          });
      }
    }
  }, [selectedSkin]);

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

  if (!userId) return null;
  if (!hasTrack) return null;

  return (
    <>
      {preparing && (
        <div className="fixed bottom-20 right-4 flex items-center gap-3 bg-black/95 border border-fuchsia-500/30 rounded-2xl px-5 py-3 shadow-2xl shadow-fuchsia-500/10 z-[99997]">
          <div className="w-5 h-5 border-2 border-fuchsia-500/30 border-t-fuchsia-500 rounded-full animate-spin" />
          <span className="text-fuchsia-300 text-xs font-black uppercase tracking-widest">
            Preparando {webampTracks.length} faixas...
          </span>
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
          
          <div className="min-w-0 max-w-[180px]">
            <p className="text-white text-xs font-bold truncate">{currentTrack?.title || 'Tocando...'}</p>
            <p className="text-white/50 text-[10px] truncate">{currentTrack?.artist || ''}</p>
            {queue.length > 1 && (
              <p className="text-fuchsia-400/70 text-[9px]">{queue.length} faixas</p>
            )}
          </div>

          <div className="flex items-center gap-1">
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
