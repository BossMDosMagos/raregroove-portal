import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import Webamp from 'webamp';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';

export function GlobalAudioPlayer() {
  const {
    queue,
    webampTracks,
    userId,
    setWebampRef,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    setCurrentTrack,
    preparing,
    listenersRef,
  } = useAudioPlayer();

  const [divRef, setDivRef] = useState(null);
  const webampInstanceRef = React.useRef(null);

  // ============ RENDERIZAR WEBAMP ============
  useEffect(() => {
    if (!divRef || queue.length === 0 || webampTracks.length === 0 || !userId) {
      return;
    }

    if (!Webamp.browserIsSupported()) {
      toast.error('Navegador não suportado', {
        description: 'Webamp requer suporte a WebGL.',
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
      return;
    }

    // Injeta CSS do Webamp (apenas uma vez)
    if (!document.getElementById('webamp-css')) {
      const link = document.createElement('link');
      link.id = 'webamp-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/webamp@2.2.0/build/webamp.css';
      document.head.appendChild(link);
    }

    // Cleanup anterior
    if (webampInstanceRef.current) {
      try {
        if (listenersRef.current.onClose) listenersRef.current.onClose();
        if (listenersRef.current.onTrackDidChange) listenersRef.current.onTrackDidChange();
        webampInstanceRef.current.dispose?.();
      } catch (e) {
        console.error('[GLOBAL AUDIO PLAYER] Error cleaning up previous instance:', e);
      }
    }

    // Cria nova instância
    console.log('[GLOBAL AUDIO PLAYER] Creating Webamp instance with', webampTracks.length, 'tracks');

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

    webamp
      .renderWhenReady(divRef)
      .then(() => {
        console.log('[GLOBAL AUDIO PLAYER] Renderizado com sucesso');

        // ============ LISTENERS ============
        const unsubClose = webamp.onClose?.(() => {
          console.log('[GLOBAL AUDIO PLAYER] Webamp closed by user');
          setIsPlaying(false);
        });

        const unsubTrack = webamp.onTrackDidChange?.((track) => {
          if (!track?.metaData) return;
          console.log('[GLOBAL AUDIO PLAYER] Track changed:', track.metaData.title);
          // Atualiza track atual no contexto
          const matchingQueueItem = queue.find(
            (q) => q.title === track.metaData.title && q.artist === track.metaData.artist
          );
          if (matchingQueueItem) {
            setCurrentTrack(matchingQueueItem);
          }
        });

        // Salva unsub functions para cleanup
        listenersRef.current.onClose = unsubClose;
        listenersRef.current.onTrackDidChange = unsubTrack;
      })
      .catch((err) => {
        console.error('[GLOBAL AUDIO PLAYER] Error rendering:', err);
        toast.error('Erro no player', {
          description: err.message,
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
        });
      });

    // ============ CLEANUP ============
    return () => {
      // Não faz dispose aqui porque Webamp precisa continuar tocando
      // O cleanup só ocorre quando closePlayer() é chamado explicitamente
    };
  }, [divRef, queue.length, webampTracks, userId, setWebampRef, setCurrentTrack, queue, listenersRef, setIsPlaying]);

  // Se não há queue, não renderiza
  if (!queue.length || !userId) {
    return null;
  }

  return (
    <div
      ref={setDivRef}
      style={{
        position: 'fixed',
        bottom: 40,
        right: 40,
        width: 470,
        height: 350,
        zIndex: 99998,
      }}
    >
      {preparing && (
        <div
          className="fixed bottom-10 right-10 flex items-center gap-3 bg-black/90 border border-fuchsia-500/30 rounded-2xl px-5 py-3 shadow-2xl shadow-fuchsia-500/10 z-[99999]"
        >
          <div className="w-5 h-5 border-2 border-fuchsia-500/30 border-t-fuchsia-500 rounded-full animate-spin" />
          <span className="text-fuchsia-300 text-xs font-black uppercase tracking-widest">
            Preparando streaming...
          </span>
        </div>
      )}
    </div>
  );
}
