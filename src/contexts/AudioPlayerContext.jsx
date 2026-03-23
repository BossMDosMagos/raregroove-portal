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
  const [loadingTrackId, setLoadingTrackId] = useState(null);

  const listenersRef = useRef({});
  const urlCacheRef = useRef(new Map());
  const loadingRef = useRef(false);
  const currentQueueRef = useRef([]);

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

  const prepareJITTracks = useCallback((tracks) => {
    currentQueueRef.current = tracks;
    
    const jitTracks = tracks.map((track, index) => ({
      url: '',
      duration: track.duration,
      metaData: {
        artist: track.artist,
        title: track.title,
        album: track.albumTitle || undefined,
      },
      _trackId: track.id,
      _index: index,
      _hasAudio: !!track.audioPath,
    }));

    console.log('[AUDIO CONTEXT] JIT Playlist ready:', jitTracks.length, 'tracks (no URLs)');
    setWebampTracks(jitTracks);
    setPreparing(false);
    return jitTracks;
  }, []);

  const hydrateTrack = useCallback(async (index) => {
    if (loadingRef.current) {
      console.log('[AUDIO CONTEXT] Already loading, skipping');
      return;
    }

    const track = currentQueueRef.current[index];
    if (!track) return;

    if (urlCacheRef.current.has(track.audioPath)) {
      console.log('[AUDIO CONTEXT] Track already cached:', track.title);
      return urlCacheRef.current.get(track.audioPath);
    }

    loadingRef.current = true;
    setLoadingTrackId(track.id);

    console.log('[AUDIO CONTEXT] Hydrating track:', track.title);
    const url = await getPresignedUrl(track.audioPath);

    loadingRef.current = false;
    setLoadingTrackId(null);

    if (url) {
      setWebampTracks(prev => {
        const updated = [...prev];
        if (updated[index]) {
          updated[index] = { ...updated[index], url };
        }
        return updated;
      });
      console.log('[AUDIO CONTEXT] Track hydrated:', track.title);
    }

    return url;
  }, [getPresignedUrl]);

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
    setQueue(queueTracks);
    setCurrentTrack(track);
    setIsPlaying(true);
  }, [expandAlbumTracks]);

  const playAlbum = useCallback((albumItem) => {
    if (!albumItem) return;
    console.log('[AUDIO CONTEXT] playAlbum:', albumItem.title);
    
    const albumTracks = expandAlbumTracks(albumItem);
    if (albumTracks.length === 0) {
      toast.error('Este álbum não tem faixas');
      return;
    }
    
    setQueue(albumTracks);
    setCurrentTrack(albumItem);
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
    setWebampTracks([]);
    setIsPlaying(false);
    currentQueueRef.current = [];
  }, []);

  const closePlayer = useCallback(() => {
    clearQueue();
    if (webampRef) {
      try {
        if (listenersRef.current.onClose) listenersRef.current.onClose();
        if (listenersRef.current.onTrackDidChange) listenersRef.current.onTrackDidChange();
        webampRef.dispose?.();
      } catch (e) {
        console.error('[AUDIO CONTEXT] Dispose error:', e);
      }
    }
  }, [webampRef, clearQueue]);

  const saveSkin = useCallback((skinUrl) => {
    localStorage.setItem('grooveflix_skin_url', skinUrl);
    setSelectedSkin(skinUrl);
  }, []);

  const clearSkin = useCallback(() => {
    localStorage.removeItem('grooveflix_skin_url');
    setSelectedSkin(null);
  }, []);

  useEffect(() => {
    if (queue.length === 0) {
      setWebampTracks([]);
      return;
    }
    prepareJITTracks(queue);
  }, [queue, prepareJITTracks]);

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
    loadingTrackId,

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
    hydrateTrack,
    urlCache: urlCacheRef.current,
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
    loadingTrackId,
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
    hydrateTrack,
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
