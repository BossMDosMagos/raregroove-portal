import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

const GrooveflixPlayerContext = createContext(null);

export function GrooveflixPlayerProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingTrack, setLoadingTrack] = useState(null);
  const [userId, setUserId] = useState(null);
  const audioCacheRef = useRef(new Map());

  useEffect(() => {
    const { data: { session } } = supabase.auth.getSession();
    setUserId(session?.user?.id || null);
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null);
    });
    
    return () => subscription.unsubscribe();
  }, []);

  const getPresignedUrl = useCallback(async (filePath) => {
    if (!filePath) return null;
    
    if (audioCacheRef.current.has(filePath)) {
      return audioCacheRef.current.get(filePath);
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id || userId;

      if (!currentUserId) {
        console.warn('[GROOVEFLIX PLAYER] No userId for presign');
        return null;
      }

      console.log('[GROOVEFLIX PLAYER] Getting presigned URL for:', filePath, 'userId:', currentUserId);

      const { data, error } = await supabase.functions.invoke('b2-presign', {
        body: { file_path: filePath, userId: currentUserId, type: 'audio' },
      });

      if (error || !data?.url) {
        console.warn('[GROOVEFLIX PLAYER] No URL from presign:', error, data);
        return null;
      }

      audioCacheRef.current.set(filePath, data.url);
      return data.url;
    } catch (e) {
      console.error('[GROOVEFLIX PLAYER] Presign error:', e);
      return null;
    }
  }, [userId]);

  const preloadNextTrack = useCallback(async () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= queue.length) return;

    const nextTrack = queue[nextIndex];
    if (!nextTrack?.audioPath || audioCacheRef.current.has(nextTrack.audioPath)) return;

    console.log('[GROOVEFLIX PLAYER] Pre-loading next track:', nextTrack.title);
    await getPresignedUrl(nextTrack.audioPath);
  }, [currentIndex, queue, getPresignedUrl]);

  const playAlbum = useCallback(async (item) => {
    const tracks = [];
    
    const audioFiles = item.audio_files || item.audioFiles || [];
    if (audioFiles.length > 0) {
      for (const file of audioFiles) {
        tracks.push({
          id: `${item.id}_${file.name}`,
          title: file.name.replace(/\.(mp3|flac|wav|ogg|m4a|aac)$/i, ''),
          artist: item.artist || 'Desconhecido',
          audioPath: file.path,
          duration: undefined,
          albumTitle: item.title,
          albumId: item.id,
        });
      }
    } else if (item.audioPath) {
      tracks.push({
        id: item.id,
        title: item.title,
        artist: item.artist || 'Desconhecido',
        audioPath: item.audioPath,
        duration: item.duration,
        albumTitle: item.title,
        albumId: item.id,
      });
    }

    if (tracks.length === 0) {
      toast.error('Nenhuma faixa disponível');
      return null;
    }

    console.log('[GROOVEFLIX PLAYER] Setting up album with', tracks.length, 'tracks');
    
    setQueue(tracks);
    setCurrentIndex(0);
    setIsPlaying(true);

    const firstTrack = tracks[0];
    setLoadingTrack(firstTrack.id);
    
    const url = await getPresignedUrl(firstTrack.audioPath);
    setLoadingTrack(null);

    if (url) {
      console.log('[GROOVEFLIX PLAYER] First track ready, starting playback');
      preloadNextTrack();
      return { url, track: firstTrack };
    } else {
      toast.error('Erro ao carregar primeira faixa');
      return null;
    }
  }, [getPresignedUrl, preloadNextTrack]);

  const playNext = useCallback(async () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= queue.length) {
      setIsPlaying(false);
      return null;
    }

    setCurrentIndex(nextIndex);
    const nextTrack = queue[nextIndex];
    
    if (!nextTrack) return null;

    if (audioCacheRef.current.has(nextTrack.audioPath)) {
      console.log('[GROOVEFLIX PLAYER] Playing cached track:', nextTrack.title);
      return { url: audioCacheRef.current.get(nextTrack.audioPath), track: nextTrack };
    }

    setLoadingTrack(nextTrack.id);
    const url = await getPresignedUrl(nextTrack.audioPath);
    setLoadingTrack(null);

    if (url) {
      console.log('[GROOVEFLIX PLAYER] Track loaded:', nextTrack.title);
      preloadNextTrack();
      return { url, track: nextTrack };
    }

    return null;
  }, [currentIndex, queue, getPresignedUrl, preloadNextTrack]);

  const getCurrentTrack = useCallback(() => {
    return queue[currentIndex] || null;
  }, [currentIndex, queue]);

  const getMetaTracks = useCallback(() => {
    return queue.map((track, index) => ({
      url: '',
      duration: track.duration,
      metaData: {
        title: track.title,
        artist: track.artist,
        album: track.albumTitle,
      },
      _trackId: track.id,
      _index: index,
      _hasAudio: !!track.audioPath,
    }));
  }, [queue]);

  const value = useMemo(() => ({
    queue,
    currentIndex,
    isPlaying,
    loadingTrack,
    playAlbum,
    playNext,
    getCurrentTrack,
    getMetaTracks,
    setIsPlaying,
    setQueue,
    setCurrentIndex,
    audioCache: audioCacheRef.current,
  }), [queue, currentIndex, isPlaying, loadingTrack, playAlbum, playNext, getCurrentTrack, getMetaTracks]);

  return (
    <GrooveflixPlayerContext.Provider value={value}>
      {children}
    </GrooveflixPlayerContext.Provider>
  );
}

export function useGrooveflixPlayer() {
  const context = useContext(GrooveflixPlayerContext);
  if (!context) {
    throw new Error('useGrooveflixPlayer must be used within GrooveflixPlayerProvider');
  }
  return context;
}
