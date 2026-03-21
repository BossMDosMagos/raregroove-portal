import React, { useState, useEffect, useRef } from 'react';
import { Music, X, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import Webamp from 'webamp';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';

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
  } = useAudioPlayer();

  const [divRef, setDivRef] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isWebampRendered, setIsWebampRendered] = useState(false);
  const webampInstanceRef = useRef(null);
  const hasInitializedRef = useRef(false);

  const hasTrack = queue.length > 0 && currentTrack;
  const canPlay = queue.length > 0 && webampTracks.length > 0 && userId;

  useEffect(() => {
    if (!divRef || !canPlay) return;
    if (hasInitializedRef.current && isWebampRendered) return;

    if (!Webamp.browserIsSupported()) {
      toast.error('Navegador não suportado', {
        description: 'Webamp requer suporte a WebGL.',
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
      return;
    }



    if (webampInstanceRef.current) {
      try {
        if (listenersRef.current.onClose) listenersRef.current.onClose();
        if (listenersRef.current.onTrackDidChange) listenersRef.current.onTrackDidChange();
        webampInstanceRef.current.dispose?.();
        webampInstanceRef.current = null;
      } catch (e) {
        console.error('[GLOBAL PLAYER] Error cleaning up:', e);
      }
    }

    console.log('[GLOBAL PLAYER] Creating Webamp with', webampTracks.length, 'tracks');

    const webamp = new Webamp({
      initialTracks: webampTracks,
      zIndex: 99999,
      windowLayout: {
        main: { position: { top: 0, left: 0 } },
        equalizer: { position: { top: 116, left: 0 } },
        playlist: { position: { top: 232, left: 0 }, size: { extraHeight: 2, extraWidth: 0 } },
      },
    });

    webampInstanceRef.current = webamp;
    setWebampRef(webamp);
    hasInitializedRef.current = true;

    webamp.renderWhenReady(divRef)
      .then(() => {
        console.log('[GLOBAL PLAYER] Webamp rendered');
        setIsWebampRendered(true);
        setIsExpanded(true);

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
        toast.error('Erro no player', {
          description: err.message,
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
        });
      });
  }, [divRef, canPlay, webampTracks, userId]);

  useEffect(() => {
    return () => {
      if (webampInstanceRef.current) {
        try {
          if (listenersRef.current.onClose) listenersRef.current.onClose();
          if (listenersRef.current.onTrackDidChange) listenersRef.current.onTrackDidChange();
          webampInstanceRef.current.dispose?.();
        } catch (e) {
          console.error('[GLOBAL PLAYER] Cleanup error:', e);
        }
      }
    };
  }, [listenersRef]);

  if (!userId) return null;

  if (!hasTrack) return null;

  return (
    <>
      {preparing && (
        <div className="fixed bottom-20 right-4 flex items-center gap-3 bg-black/95 border border-fuchsia-500/30 rounded-2xl px-5 py-3 shadow-2xl shadow-fuchsia-500/10 z-[99997]">
          <div className="w-5 h-5 border-2 border-fuchsia-500/30 border-t-fuchsia-500 rounded-full animate-spin" />
          <span className="text-fuchsia-300 text-xs font-black uppercase tracking-widest">
            Preparando...
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
            <Music className="w-5 h-5 text-fuchsia-400 animate-pulse" />
          </div>
          
          <div className="min-w-0 max-w-[180px]">
            <p className="text-white text-xs font-bold truncate">{currentTrack?.title || 'Tocando...'}</p>
            <p className="text-white/50 text-[10px] truncate">{currentTrack?.artist || ''}</p>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded(true)}
              className="w-8 h-8 rounded-lg bg-fuchsia-500/20 hover:bg-fuchsia-500/30 flex items-center justify-center text-fuchsia-300 transition"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => closePlayer()}
              className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
