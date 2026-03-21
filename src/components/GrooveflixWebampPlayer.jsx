import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import Webamp from 'webamp';

export default function GrooveflixWebampPlayer({
  isOpen,
  onClose,
  onTrackChange,
  queue = [],
  track = null,
  userId = null,
}) {
  const [divRef, setDivRef] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [webampTracks, setWebampTracks] = useState([]);
  const [ready, setReady] = useState(false);

  const getPresignedUrl = async (filePath) => {
    if (!filePath) return null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Sessão não disponível');
      const { data, error } = await supabase.functions.invoke('b2-presign', {
        body: { file_path: filePath, user_id: userId, type: 'audio' },
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('URL não retornada');
      console.log('[WEBAMP] Presigned URL for', filePath, ':', data.url);
      return data.url;
    } catch (e) {
      console.error('[WEBAMP] Error getting presigned URL:', e.message);
      return null;
    }
  };

  useEffect(() => {
    if (!isOpen || !userId) return;

    const effectiveQueue = track ? [track] : queue;
    const items = effectiveQueue.filter((item) => item.audioPath);
    if (items.length === 0) return;

    setPreparing(true);
    setReady(false);

    const buildTracks = async () => {
      const result = [];
      for (const item of items) {
        const url = await getPresignedUrl(item.audioPath);
        if (url) {
          result.push({
            url,
            duration: item.duration || undefined,
            metaData: {
              artist: item.artist || 'Desconhecido',
              title: item.title || 'Sem título',
            },
          });
        }
      }
      console.log('[WEBAMP] Built tracks:', result);
      setWebampTracks(result);
      setPreparing(false);
      setReady(result.length > 0);
    };

    buildTracks();
  }, [isOpen, userId, track, queue]);

  useEffect(() => {
    if (!isOpen || !ready || !divRef || webampTracks.length === 0) return;
    if (!Webamp.browserIsSupported()) {
      toast.error('Navegador não suportado', {
        description: 'Webamp requer suporte a WebGL.',
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
      });
      return;
    }

    // Inject Webamp CSS
    if (!document.getElementById('webamp-css')) {
      const link = document.createElement('link');
      link.id = 'webamp-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/webamp@2.2.0/build/webamp.css';
      document.head.appendChild(link);
    }

    const webamp = new Webamp({
      initialTracks: webampTracks,
      zIndex: 99999,
      windowLayout: {
        main: { position: { top: 0, left: 0 } },
        equalizer: { position: { top: 116, left: 0 } },
        playlist: { position: { top: 232, left: 0 }, size: { extraHeight: 2, extraWidth: 0 } },
      },
    });
    console.log('[WEBAMP] Created Webamp with tracks:', webampTracks);

    webamp.renderWhenReady(divRef)
      .then(() => {
        console.log('[WEBAMP] Renderizado com sucesso');
      })
      .catch((err) => {
        console.error('[WEBAMP] Erro ao renderizar:', err);
        toast.error('Erro no player', {
          description: err.message,
          style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' },
        });
      });

    const unsubClose = webamp.onClose(() => {
      onClose?.();
    });

    const unsubTrack = webamp.onTrackDidChange((track) => {
      if (!track?.metaData) return;
      const match = queue.find((q) => q.title === track.metaData.title);
      if (match) onTrackChange?.(match.id);
    });

    return () => {
      unsubClose?.();
      unsubTrack?.();
      try { webamp.dispose(); } catch { /* silent */ }
    };
  }, [isOpen, ready, divRef, webampTracks]);

  if (!isOpen) return null;

  if (!userId) {
    return (
      <div className="fixed inset-0 z-[99998] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" onClick={onClose} />
        <div className="relative bg-black border border-fuchsia-500/30 rounded-2xl p-6 text-center space-y-3 max-w-sm mx-4">
          <p className="text-white font-bold">Faça login para ouvir</p>
          <p className="text-white/50 text-sm">Autenticação necessária para acessar o streaming.</p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-fuchsia-500/20 border border-fuchsia-500/40 text-fuchsia-200 text-xs font-black uppercase tracking-wider hover:bg-fuchsia-500/30 transition"
          >
            Fechar
          </button>
        </div>
      </div>
    );
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
          className="fixed bottom-10 right-10 flex items-center gap-3 bg-black/90 border border-fuchsia-500/30 rounded-2xl px-5 py-3 shadow-2xl shadow-fuchsia-500/10"
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
