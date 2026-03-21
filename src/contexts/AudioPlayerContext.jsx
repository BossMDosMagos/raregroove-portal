import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

const AudioPlayerContext = createContext(null);

export function AudioPlayerProvider({ children }) {
  // ============ ESTADO DE CONTROLE ============
  const [webampRef, setWebampRef] = useState(null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [queue, setQueue] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [userId, setUserId] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [webampTracks, setWebampTracks] = useState([]);

  // ============ REFS ============
  const listenersRef = useRef({});

  // ============ INICIALIZAR USERID ============
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    init();
  }, []);

  // ============ FUNÇÃO: OBTER PRESIGNED URL ============
  const getPresignedUrl = useCallback(async (filePath) => {
    if (!filePath || !userId) return null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Sessão não disponível');
      }

      const { data, error } = await supabase.functions.invoke('b2-presign', {
        body: { file_path: filePath, user_id: userId, type: 'audio' },
      });

      if (error) {
        console.error('[AUDIO CONTEXT] Presign error:', error);
        throw error;
      }
      if (!data?.url) throw new Error('URL não retornada');

      return data.url;
    } catch (e) {
      console.error('[AUDIO CONTEXT] Error getting presigned URL:', e.message);
      toast.error('Erro ao carregar áudio', { description: e.message });
      return null;
    }
  }, [userId]);

  // ============ FUNÇÃO: PREPARAR TRACKS COM PRESIGNED URLS ============
  const prepareWebampTracks = useCallback(async () => {
    if (!queue.length || !userId) {
      setWebampTracks([]);
      return;
    }

    setPreparing(true);
    const result = [];

    for (const item of queue) {
      if (!item.audioPath) continue;
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

    console.log('[AUDIO CONTEXT] Built webamp tracks:', result.length);
    setWebampTracks(result);
    setPreparing(false);
  }, [queue, userId, getPresignedUrl]);

  // ============ FUNÇÃO: TOCAR MÚSICA ============
  const playTrack = useCallback((track) => {
    if (!track) return;
    console.log('[AUDIO CONTEXT] Play track:', track.title);
    setCurrentTrack(track);
    setIsPlaying(true);
  }, []);

  // ============ FUNÇÃO: PAUSAR MÚSICA ============
  const pauseTrack = useCallback(() => {
    console.log('[AUDIO CONTEXT] Pause');
    setIsPlaying(false);
  }, []);

  // ============ FUNÇÃO: RETOMAR MÚSICA ============
  const resumeTrack = useCallback(() => {
    console.log('[AUDIO CONTEXT] Resume');
    setIsPlaying(true);
  }, []);

  // ============ FUNÇÃO: LIMPAR QUEUE ============
  const clearQueue = useCallback(() => {
    console.log('[AUDIO CONTEXT] Clear queue');
    setQueue([]);
    setCurrentTrack(null);
    setWebampTracks([]);
    setIsPlaying(false);
  }, []);

  // ============ FUNÇÃO: FECHAR PLAYER ============
  const closePlayer = useCallback(() => {
    console.log('[AUDIO CONTEXT] Close player');
    clearQueue();
    if (webampRef) {
      try {
        // Cleanup listeners
        if (listenersRef.current.onClose) {
          listenersRef.current.onClose();
        }
        if (listenersRef.current.onTrackDidChange) {
          listenersRef.current.onTrackDidChange();
        }
        // Dispose Webamp
        webampRef.dispose?.();
      } catch (e) {
        console.error('[AUDIO CONTEXT] Error disposing webamp:', e);
      }
    }
  }, [webampRef, clearQueue]);

  // ============ EFEITO: PREPARAR TRACKS QUANDO QUEUE MUDA ============
  useEffect(() => {
    if (queue.length === 0) {
      setWebampTracks([]);
      return;
    }
    prepareWebampTracks();
  }, [queue, prepareWebampTracks]);

  // ============ VALUE MEMOIZADO ============
  const value = useMemo(() => ({
    // Estado
    currentTrack,
    queue,
    isPlaying,
    volume,
    currentTime,
    duration,
    userId,
    webampRef,
    preparing,
    webampTracks,

    // Ações
    setCurrentTrack,
    setQueue,
    setIsPlaying,
    setVolume,
    setCurrentTime,
    setDuration,
    setWebampRef,
    playTrack,
    pauseTrack,
    resumeTrack,
    clearQueue,
    closePlayer,
    getPresignedUrl,
    setPreparing,
    setWebampTracks,
    listenersRef,
  }), [
    currentTrack,
    queue,
    isPlaying,
    volume,
    currentTime,
    duration,
    userId,
    webampRef,
    preparing,
    webampTracks,
    playTrack,
    pauseTrack,
    resumeTrack,
    clearQueue,
    closePlayer,
    getPresignedUrl,
  ]);

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) {
    throw new Error('useAudioPlayer must be used within AudioPlayerProvider');
  }
  return ctx;
}
