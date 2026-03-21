import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { getSkinFromLocalStorage } from '../utils/webampSkins';

const AudioPlayerContext = createContext(null);

export function AudioPlayerProvider({ children }) {
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
  const [selectedSkin, setSelectedSkin] = useState(null);

  const listenersRef = useRef({});

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[AUDIO CONTEXT] Session:', session?.user?.id);
      setUserId(session?.user?.id || null);
      
      const savedSkin = getSkinFromLocalStorage();
      setSelectedSkin(savedSkin.url);
      console.log('[AUDIO CONTEXT] Loaded skin:', savedSkin.name, savedSkin.url);
    };
    
    init();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[AUDIO CONTEXT] Auth state changed:', session?.user?.id);
      setUserId(session?.user?.id || null);
    });
    
    return () => subscription.unsubscribe();
  }, []);

  const getPresignedUrl = useCallback(async (filePath) => {
    if (!filePath) {
      console.warn('[AUDIO CONTEXT] No filePath provided to getPresignedUrl');
      return null;
    }
    if (!userId) {
      console.warn('[AUDIO CONTEXT] No userId available for presign');
      return null;
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        console.warn('[AUDIO CONTEXT] No session token');
        throw new Error('Sessão não disponível');
      }

      console.log('[AUDIO CONTEXT] Getting presigned URL for:', filePath);
      const { data, error } = await supabase.functions.invoke('b2-presign', {
        body: { file_path: filePath, user_id: userId, type: 'audio' },
      });

      if (error) {
        console.error('[AUDIO CONTEXT] Presign error:', error);
        throw error;
      }
      if (!data?.url) {
        console.warn('[AUDIO CONTEXT] No URL returned from presign');
        throw new Error('URL não retornada');
      }

      console.log('[AUDIO CONTEXT] Got presigned URL:', data.url.substring(0, 80) + '...');
      return data.url;
    } catch (e) {
      console.error('[AUDIO CONTEXT] Error getting presigned URL:', e.message);
      toast.error('Erro ao carregar áudio', { description: e.message });
      return null;
    }
  }, [userId]);

  const expandAlbumTracks = useCallback((item) => {
    const tracks = [];
    
    const audioFiles = item.audio_files || item.audioFiles || [];
    console.log('[AUDIO CONTEXT] expandAlbumTracks - item:', item.title, 'audioFiles:', audioFiles.length);
    
    if (audioFiles.length > 0) {
      for (const file of audioFiles) {
        tracks.push({
          id: `${item.id}_${file.name}`,
          title: file.name.replace(/\.(mp3|flac|wav|ogg|m4a|aac)$/i, ''),
          artist: item.artist || 'Desconhecido',
          audioPath: file.path,
          duration: undefined,
          albumId: item.id,
          albumTitle: item.title,
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
      });
    }
    
    console.log('[AUDIO CONTEXT] expandAlbumTracks - returning', tracks.length, 'tracks');
    return tracks;
  }, []);

  const prepareWebampTracks = useCallback(async (queueToPrepare, currentUserId) => {
    console.log('[AUDIO CONTEXT] prepareWebampTracks called, queue length:', queueToPrepare.length, 'userId:', currentUserId);
    
    if (!queueToPrepare.length || !currentUserId) {
      console.log('[AUDIO CONTEXT] Skipping prepare - empty queue or no userId');
      setWebampTracks([]);
      setPreparing(false);
      return;
    }

    setPreparing(true);
    const result = [];

    for (const item of queueToPrepare) {
      console.log('[AUDIO CONTEXT] Processing track:', item.title, 'audioPath:', item.audioPath);
      const expandedTracks = expandAlbumTracks(item);
      
      for (const track of expandedTracks) {
        if (!track.audioPath) {
          console.warn('[AUDIO CONTEXT] Skipping track - no audioPath:', track.title);
          continue;
        }
        const url = await getPresignedUrl(track.audioPath);
        if (url) {
          result.push({
            url,
            duration: track.duration,
            metaData: {
              artist: track.artist,
              title: track.title,
              album: track.albumTitle || undefined,
            },
            _trackId: track.id,
          });
        }
      }
    }

    console.log('[AUDIO CONTEXT] Built webamp tracks:', result.length, 'tracks');
    setWebampTracks(result);
    setPreparing(false);
  }, [expandAlbumTracks, getPresignedUrl]);

  const playTrack = useCallback((track) => {
    if (!track) {
      console.warn('[AUDIO CONTEXT] playTrack called with no track');
      return;
    }
    console.log('[AUDIO CONTEXT] playTrack called:', track.title, 'category:', track.category, 'audioFiles:', track.audioFiles?.length);
    
    let queueTracks = [];
    
    console.log('[AUDIO CONTEXT] Checking album - category:', track.category, 'audio_files:', track.audio_files, 'audioFiles:', track.audioFiles);
    
    if (track.category === 'album' && track.audio_files && track.audio_files.length > 0) {
      queueTracks = expandAlbumTracks(track);
      console.log('[AUDIO CONTEXT] Album expanded from audio_files to', queueTracks.length, 'tracks');
    } else if (track.category === 'album' && track.audioFiles && track.audioFiles.length > 0) {
      queueTracks = expandAlbumTracks(track);
      console.log('[AUDIO CONTEXT] Album expanded from audioFiles to', queueTracks.length, 'tracks');
    } else {
      queueTracks = [track];
      console.log('[AUDIO CONTEXT] Single track - queue will have 1 track');
    }
    
    console.log('[AUDIO CONTEXT] Setting queue with', queueTracks.length, 'tracks');
    setQueue(queueTracks);
    setCurrentTrack(track);
    setIsPlaying(true);
  }, [expandAlbumTracks]);

  const playAlbum = useCallback((albumItem) => {
    if (!albumItem) return;
    console.log('[AUDIO CONTEXT] playAlbum called:', albumItem.title);
    
    const albumTracks = expandAlbumTracks(albumItem);
    if (albumTracks.length === 0) {
      toast.error('Este álbum não tem faixas disponíveis');
      return;
    }
    
    setQueue(albumTracks);
    setCurrentTrack(albumItem);
    setIsPlaying(true);
    
    toast.success(`Reproduzindo álbum`, {
      description: `${albumItem.title} - ${albumTracks.length} faixas`,
      duration: 3000,
    });
  }, [expandAlbumTracks]);

  const pauseTrack = useCallback(() => {
    console.log('[AUDIO CONTEXT] Pause');
    setIsPlaying(false);
  }, []);

  const resumeTrack = useCallback(() => {
    console.log('[AUDIO CONTEXT] Resume');
    setIsPlaying(true);
  }, []);

  const clearQueue = useCallback(() => {
    console.log('[AUDIO CONTEXT] Clear queue');
    setQueue([]);
    setCurrentTrack(null);
    setWebampTracks([]);
    setIsPlaying(false);
  }, []);

  const closePlayer = useCallback(() => {
    console.log('[AUDIO CONTEXT] Close player');
    clearQueue();
    if (webampRef) {
      try {
        if (listenersRef.current.onClose) {
          listenersRef.current.onClose();
        }
        if (listenersRef.current.onTrackDidChange) {
          listenersRef.current.onTrackDidChange();
        }
        webampRef.dispose?.();
      } catch (e) {
        console.error('[AUDIO CONTEXT] Error disposing webamp:', e);
      }
    }
  }, [webampRef, clearQueue]);

  const saveSkin = useCallback((skinUrl) => {
    localStorage.setItem('grooveflix_skin_url', skinUrl);
    setSelectedSkin(skinUrl);
    console.log('[AUDIO CONTEXT] Skin saved:', skinUrl);
  }, []);

  const clearSkin = useCallback(() => {
    localStorage.removeItem('grooveflix_skin_url');
    setSelectedSkin(null);
    console.log('[AUDIO CONTEXT] Skin cleared');
  }, []);

  useEffect(() => {
    console.log('[AUDIO CONTEXT] Queue changed, length:', queue.length, 'userId:', userId);
    if (queue.length === 0) {
      setWebampTracks([]);
      return;
    }
    prepareWebampTracks(queue, userId);
  }, [queue, userId, prepareWebampTracks]);

  const value = useMemo(() => ({
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
    selectedSkin,

    setCurrentTrack,
    setQueue,
    setIsPlaying,
    setVolume,
    setCurrentTime,
    setDuration,
    setWebampRef,
    playTrack,
    playAlbum,
    pauseTrack,
    resumeTrack,
    clearQueue,
    closePlayer,
    getPresignedUrl,
    setPreparing,
    setWebampTracks,
    listenersRef,
    saveSkin,
    clearSkin,
    expandAlbumTracks,
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
    selectedSkin,
    playTrack,
    playAlbum,
    pauseTrack,
    resumeTrack,
    clearQueue,
    closePlayer,
    getPresignedUrl,
    saveSkin,
    clearSkin,
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
