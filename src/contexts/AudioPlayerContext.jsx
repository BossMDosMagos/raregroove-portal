import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

const AudioPlayerContext = createContext(null);

export function AudioPlayerProvider({ children }) {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [queue, setQueue] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [userId, setUserId] = useState(null);
  const [loadingTrackId, setLoadingTrackId] = useState(null);

  const urlCacheRef = useRef(new Map());
  const currentQueueRef = useRef([]);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[AUDIO CONTEXT] Session:', session?.user?.id);
      setUserId(session?.user?.id || null);
    };
    
    init();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[AUDIO CONTEXT] Auth state changed:', session?.user?.id);
      setUserId(session?.user?.id || null);
    });
    
    return () => subscription.unsubscribe();
  }, []);

  const getPresignedUrl = useCallback(async (filePath) => {
    if (!filePath) return null;
    
    if (urlCacheRef.current.has(filePath)) {
      return urlCacheRef.current.get(filePath);
    }
    
    if (!userId) {
      console.warn('[AUDIO CONTEXT] No userId for presign');
      return null;
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('No session');

      const { data, error } = await supabase.functions.invoke('b2-presign', {
        body: { file_path: filePath, userId: userId, type: 'audio' },
      });

      if (error || !data?.url) {
        console.warn('[AUDIO CONTEXT] Presign failed:', error);
        return null;
      }

      urlCacheRef.current.set(filePath, data.url);
      console.log('[AUDIO CONTEXT] URL cached for:', filePath.substring(0, 50));
      return data.url;
    } catch (e) {
      console.error('[AUDIO CONTEXT] Presign error:', e.message);
      return null;
    }
  }, [userId]);

  const expandAlbumTracks = useCallback((item) => {
    const tracks = [];
    const audioFiles = item.audio_files || item.audioFiles || [];
    const tracklist = item.tracklist || [];
    
    if (audioFiles.length > 0) {
      for (let i = 0; i < audioFiles.length; i++) {
        const file = audioFiles[i];
        let trackNumber = i + 1;
        let discNumber = file.discNumber || 1;
        
        if (tracklist.length > 0) {
          const positionMatch = file.name.match(/^(\d+)-(\d+)[._]/);
          if (positionMatch) {
            discNumber = parseInt(positionMatch[1], 10);
            trackNumber = parseInt(positionMatch[2], 10);
          } else if (tracklist[i]) {
            discNumber = tracklist[i].discNumber || discNumber;
            trackNumber = tracklist[i].trackNumber || trackNumber;
          }
        }
        
        tracks.push({
          id: `${item.id}_${file.name}`,
          title: file.name.replace(/\.(mp3|flac|wav|ogg|m4a|aac)$/i, ''),
          artist: item.artist || 'Desconhecido',
          audioPath: file.path,
          duration: undefined,
          albumId: item.id,
          albumTitle: item.title,
          discNumber,
          trackNumber,
        });
      }
    } else if (item.audioPath) {
      tracks.push({
        id: item.id,
        title: item.title,
        artist: item.artist || 'Desconhecido',
        audioPath: item.audioPath,
        duration: item.duration,
        albumId: item.category === 'album' ? item.id : null,
        albumTitle: item.category === 'album' ? item.title : null,
        discNumber: 1,
        trackNumber: 1,
      });
    }
    
    return tracks;
  }, []);

  const playTrack = useCallback((track) => {
    if (!track) return;
    console.log('[AUDIO CONTEXT] playTrack:', track.title);
    
    let queueTracks = [];
    
    if (track.category === 'album' && track.audio_files?.length > 0) {
      queueTracks = expandAlbumTracks(track);
    } else if (track.category === 'album' && track.audioFiles?.length > 0) {
      queueTracks = expandAlbumTracks(track);
    } else {
      queueTracks = [track];
    }
    
    console.log('[AUDIO CONTEXT] Queue set:', queueTracks.length, 'tracks');
    currentQueueRef.current = queueTracks;
    setQueue(queueTracks);
    setCurrentTrack(track);
    setIsPlaying(true);
  }, [expandAlbumTracks]);

  const playAlbum = useCallback((albumItem, startIndex = 0) => {
    if (!albumItem) return;
    console.log('[AUDIO CONTEXT] playAlbum:', albumItem.title, 'starting at index:', startIndex);
    
    const albumTracks = expandAlbumTracks(albumItem);
    if (albumTracks.length === 0) {
      toast.error('Este álbum não tem faixas');
      return;
    }
    
    const safeIndex = Math.min(startIndex, albumTracks.length - 1);
    currentQueueRef.current = albumTracks;
    setQueue(albumTracks);
    setCurrentTrack(albumTracks[safeIndex]);
    setIsPlaying(true);
  }, [expandAlbumTracks]);

  const pauseTrack = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const resumeTrack = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setCurrentTrack(null);
    setIsPlaying(false);
    currentQueueRef.current = [];
  }, []);

  const closePlayer = useCallback(() => {
    clearQueue();
  }, [clearQueue]);

  const value = useMemo(() => ({
    currentTrack,
    queue,
    isPlaying,
    volume,
    currentTime,
    duration,
    userId,
    loadingTrackId,

    setCurrentTrack,
    setQueue,
    setIsPlaying,
    setVolume,
    setCurrentTime,
    setDuration,
    playTrack,
    playAlbum,
    pauseTrack,
    resumeTrack,
    clearQueue,
    closePlayer,
    getPresignedUrl,
    expandAlbumTracks,
    urlCache: urlCacheRef.current,
  }), [
    currentTrack,
    queue,
    isPlaying,
    volume,
    currentTime,
    duration,
    userId,
    loadingTrackId,
    playTrack,
    playAlbum,
    pauseTrack,
    resumeTrack,
    clearQueue,
    closePlayer,
    getPresignedUrl,
    expandAlbumTracks,
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
