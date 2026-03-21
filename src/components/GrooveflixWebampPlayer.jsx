import React, { useEffect, useRef, useState } from 'react';
import { X, Maximize, Minimize } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import Webamp from 'webamp';

export default function GrooveflixWebampPlayer({
  track,
  isOpen,
  onClose,
  onTrackChange,
  queue = [],
  isTrialing = false,
  canDownload = false,
  userId = null
}) {
  const containerRef = useRef(null);
  const webampRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tracks, setTracks] = useState([]);

  // Função para obter URL presignada do Backblaze B2
  const getPresignedUrl = async (filePath) => {
    if (!filePath) return null;
    
    try {
      console.log('[PRESIGN] Requesting URL for:', filePath, 'userId:', userId);
      
      const session = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('b2-presign', {
        body: {
          file_path: filePath,
          user_id: userId,
          type: 'audio'
        },
        headers: {
          'Authorization': 'Bearer ' + (session?.data?.session?.access_token || ''),
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
        }
      });

      if (error) {
        console.error('[PRESIGN] Error from function:', error);
        throw error;
      }

      if (!data?.url) {
        console.warn('[PRESIGN] No URL in response:', data);
        throw new Error('URL não retornada');
      }

      console.log('[PRESIGN] Success - URL obtained');
      return data.url;
    } catch (e) {
      console.error('[PRESIGN] Error catch:', e);
      return null;
    }
  };

  // Preparar faixas para o Webamp
  useEffect(() => {
    const prepareTracks = async () => {
      if (!queue || queue.length === 0) return;

      const webampTracks = [];
      for (const item of queue) {
        if (item.audioPath) {
          const url = await getPresignedUrl(item.audioPath);
          if (url) {
            webampTracks.push({
              url: url,
              title: item.title || 'Sem título',
              artist: item.artist || 'Desconhecido',
              duration: 0, // Webamp vai detectar ao fazer metadata
              metaData: {
                artist: item.artist || 'Desconhecido',
                title: item.title || 'Sem título',
                album: item.title,
              }
            });
          }
        }
      }
      setTracks(webampTracks);
    };

    prepareTracks();
  }, [queue, userId]);

  // Inicializar Webamp
  useEffect(() => {
    if (!isOpen || !containerRef.current || tracks.length === 0) return;

    setIsLoading(true);
    try {
      // Injeta CSS do Webamp se não estiver presente
      if (!document.getElementById('webamp-css')) {
        const link = document.createElement('link');
        link.id = 'webamp-css';
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/webamp@1.4.2/webamp.css';
        document.head.appendChild(link);
      }

      // Se já existe uma instância, destruir primeiro
      if (webampRef.current) {
        webampRef.current.close();
      }

      webampRef.current = new Webamp({
        initialTracks: tracks,
        initialSkin: {
          url: 'https://cdn.jsdelivr.net/npm/webamp@1.4.2/skins/base-2.91.wsz'
        }
      });

      webampRef.current.renderWhenReady(containerRef.current);

      // Listener para mudanças de faixa
      webampRef.current.onTrackChange((newTrack) => {
        if (newTrack && newTrack.metaData) {
          const trackTitle = newTrack.metaData.title || newTrack.metaData.artist;
          const queueItem = queue.find((q) => q.title === trackTitle);
          if (queueItem) {
            onTrackChange?.(queueItem.id);
          }
        }
      });

    } catch (e) {
      console.error('[WEBAMP] Init error:', e);
      toast.error('Erro ao inicializar player', {
        description: e.message,
        style: { background: '#050505', border: '1px solid #ef4444', color: '#FFF' }
      });
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, tracks, queue, onTrackChange]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (webampRef.current) {
        try {
          webampRef.current.close();
        } catch {
          // silent
        }
      }
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Overlay escuro */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={onClose} />

      {/* Container do player */}
      <div className={`relative flex flex-col transition-all duration-300 ${
        isExpanded
          ? 'inset-0 bg-gradient-to-br from-black via-charcoal-deep to-black'
          : 'bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md border border-fuchsia-500/20 rounded-t-2xl bg-gradient-to-br from-charcoal-deep via-charcoal-light to-charcoal-deep'
      }`}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="text-xs font-black uppercase tracking-widest text-fuchsia-300">
              🎵 GROOVEFLIX PLAYER
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 transition"
            >
              {isExpanded ? (
                <Minimize className="w-4 h-4" />
              ) : (
                <Maximize className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Webamp Container */}
        <div className={`relative flex-1 flex items-center justify-center overflow-hidden ${isExpanded ? 'p-8' : 'p-4'}`}>
          {isLoading ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-fuchsia-500/30 border-t-fuchsia-500 rounded-full animate-spin" />
              <p className="text-white/60 text-sm">Carregando player...</p>
            </div>
          ) : (
            <div
              ref={containerRef}
              className="w-full h-full flex items-center justify-center bg-black/50 rounded-xl border border-white/10"
              style={{
                minHeight: isExpanded ? '400px' : '200px'
              }}
            />
          )}
        </div>

        {/* Rodapé com informações */}
        {track && (
          <div className="border-t border-white/10 p-4 bg-black/40 backdrop-blur-sm">
            <div className="space-y-2">
              <p className="text-sm font-bold text-white truncate">{track.title}</p>
              <p className="text-xs text-white/60 truncate">{track.artist}</p>
              {isTrialing && (
                <p className="text-[10px] text-yellow-400/70">⚠️ Trial ativo - qualidade limitada</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
