import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause, SkipBack, SkipForward, Volume2, Disc, Music, X, Clock, ListMusic, Building, Calendar, Globe, Tag, Disc3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAudioPlayer } from '../contexts/AudioPlayerContext.jsx';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://hlfirfukbrisfpebaaur.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

async function getPresignedUrl(filePath, type = 'audio') {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token || SUPABASE_ANON_KEY;

  const response = await fetch(`${SUPABASE_URL}/functions/v1/b2-presign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ file_path: filePath, type }),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.url;
}

export default function CoverFlow3D({ items, onUpdateFocus, onOpenUploader, isAdmin }) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [coverUrls, setCoverUrls] = useState({});
  const [loadingCovers, setLoadingCovers] = useState(new Set());
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [showSuperCard, setShowSuperCard] = useState(false);
  const audioRef = useRef(null);
  const containerRef = useRef(null);
  
  const { playAlbum, setQueue, setCurrentTrack, currentTrack } = useAudioPlayer() || {};

  const focusedItem = items[focusedIndex];
  const grooveflixData = focusedItem?.metadata?.grooveflix || {};
  const tracklist = grooveflixData.tracklist || [];
  const audioFiles = grooveflixData.audio_files || [];
  const currentAudioFile = audioFiles[0];

  useEffect(() => {
    if (focusedItem && onUpdateFocus) {
      onUpdateFocus(focusedItem);
    }
  }, [focusedIndex, focusedItem]);

  useEffect(() => {
    if (items.length === 0) return;

    const loadCover = async (item) => {
      const coverPath = item.metadata?.grooveflix?.cover_path;
      const discogsCover = item.metadata?.grooveflix?.coverUrl;

      if (discogsCover) {
        setCoverUrls(prev => ({ ...prev, [item.id]: discogsCover }));
        setLoadingCovers(prev => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
        return;
      }

      if (!coverPath) {
        setLoadingCovers(prev => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
        return;
      }

      try {
        const url = await getPresignedUrl(coverPath, 'cover');
        setCoverUrls(prev => ({ ...prev, [item.id]: url }));
      } catch (e) {
        console.error('[COVER] Error:', e);
      } finally {
        setLoadingCovers(prev => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      }
    };

    const itemsToLoad = items.slice(0, 7);
    itemsToLoad.forEach(loadCover);
  }, [items.length]);

  const handlePrev = () => {
    setFocusedIndex(prev => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setFocusedIndex(prev => Math.min(items.length - 1, prev + 1));
  };

  const playAudio = useCallback(async () => {
    if (!focusedItem) return;
    
    if (playAlbum) {
      playAlbum(focusedItem);
      setIsPlaying(true);
    }
  }, [focusedItem, playAlbum]);

  const togglePlay = () => {
    if (!audioRef.current) {
      playAudio();
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
    setIsMuted(vol === 0);
  };

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume || 0.8;
        setIsMuted(false);
      } else {
        audioRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCoverClick = () => {
    setShowSuperCard(true);
  };

  const handleCloseSuperCard = (e) => {
    if (e) e.stopPropagation();
    setShowSuperCard(false);
  };

  const getCardStyle = (index) => {
    const diff = index - focusedIndex;
    const absDiff = Math.abs(diff);

    if (absDiff === 0) {
      return {
        transform: 'translateX(0) scale(1) rotateY(0deg)',
        opacity: 1,
        zIndex: 10,
        filter: 'blur(0px)',
      };
    }

    if (absDiff === 1) {
      return {
        transform: `translateX(${diff * 60}%) scale(0.85) rotateY(${diff * -15}deg)`,
        opacity: 0.6,
        zIndex: 5,
        filter: 'blur(1px)',
      };
    }

    if (absDiff === 2) {
      return {
        transform: `translateX(${diff * 80}%) scale(0.7) rotateY(${diff * -25}deg)`,
        opacity: 0.3,
        zIndex: 1,
        filter: 'blur(3px)',
      };
    }

    return {
      transform: `translateX(${diff * 100}%) scale(0.5) rotateY(${diff * -35}deg)`,
      opacity: 0,
      zIndex: 0,
      filter: 'blur(5px)',
    };
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Disc className="w-20 h-20 text-white/20 mb-4" />
        <p className="text-xl font-bold text-white/60 mb-2">Nenhum álbum encontrado</p>
        <p className="text-white/40 mb-6">Adicione álbuns para começar</p>
        {isAdmin && (
          <button
            onClick={onOpenUploader}
            className="px-6 py-3 bg-gradient-to-r from-fuchsia-500 to-purple-600 rounded-full font-bold"
          >
            Adicionar Primeiro Álbum
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="relative h-[400px] overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          {coverUrls[focusedItem?.id] ? (
            <button
              onClick={handleCoverClick}
              className="w-[350px] h-[350px] rounded-2xl overflow-hidden shadow-2xl transition-transform hover:scale-[1.02] hover:shadow-fuchsia-500/30"
              style={{
                backgroundImage: `url(${coverUrls[focusedItem.id]})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
          ) : (
            <button
              onClick={handleCoverClick}
              className="w-[350px] h-[350px] rounded-2xl bg-gradient-to-br from-fuchsia-500/30 via-purple-500/20 to-black flex items-center justify-center transition-transform hover:scale-[1.02] hover:shadow-fuchsia-500/30"
            >
              <Disc className="w-24 h-24 text-white/30" />
            </button>
          )}
        </div>

        <div className="absolute inset-0 flex items-center">
          <div className="w-full flex items-center justify-between px-4">
            <button
              onClick={handlePrev}
              disabled={focusedIndex === 0}
              className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-black/70 transition disabled:opacity-30"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={handleNext}
              disabled={focusedIndex === items.length - 1}
              className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-black/70 transition disabled:opacity-30"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setFocusedIndex(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === focusedIndex ? 'bg-fuchsia-400 w-6' : 'bg-white/30'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="mt-6 text-center">
        <h2 className="text-2xl font-black text-white">{focusedItem?.title || 'Sem título'}</h2>
        <p className="text-fuchsia-300 mt-1">{focusedItem?.artist || 'Desconhecido'}</p>

        {grooveflixData.labels && (
          <p className="text-white/40 text-sm mt-2">{grooveflixData.labels}</p>
        )}

        {grooveflixData.year && (
          <span className="inline-block mt-2 px-2 py-1 bg-white/10 rounded text-xs text-white/60">
            {grooveflixData.year}
          </span>
        )}
      </div>

      {tracklist.length > 0 && (
        <div className="mt-6 bg-white/5 rounded-xl p-4">
          <div className="flex items-center gap-2 text-fuchsia-300 text-sm font-bold mb-3">
            <ListMusic className="w-4 h-4" />
            {tracklist.length} faixas
          </div>
          <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
            {tracklist.map((track, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="w-6 text-white/30 text-center">{track.position || i + 1}</span>
                <span className="flex-1 text-white/80 truncate">{track.title}</span>
                <span className="text-white/40">{track.duration}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {audioFiles.length > 0 && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={togglePlay}
            className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-fuchsia-500 to-purple-600 rounded-full font-bold text-lg hover:shadow-lg hover:shadow-fuchsia-500/30 transition"
          >
            {isPlaying ? (
              <>
                <Pause className="w-6 h-6" />
                Pausar
              </>
            ) : (
              <>
                <Play className="w-6 h-6" />
                Ouvir
              </>
            )}
          </button>
        </div>
      )}

      {isPlaying && (
        <div className="mt-6 bg-white/5 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <button onClick={togglePlay} className="text-white/60 hover:text-white">
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>

            <div className="flex-1 flex items-center gap-3">
              <span className="text-xs text-white/40 w-10">{formatTime(currentTime)}</span>
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="flex-1 h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-fuchsia-400 [&::-webkit-slider-thumb]:rounded-full"
              />
              <span className="text-xs text-white/40 w-10">{formatTime(duration)}</span>
            </div>

            <button onClick={toggleMute} className="text-white/60 hover:text-white">
              <Volume2 className="w-5 h-5" />
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-fuchsia-400 [&::-webkit-slider-thumb]:rounded-full"
            />
          </div>
        </div>
      )}

      <div className="mt-8 text-center text-white/30 text-sm">
        {focusedIndex + 1} de {items.length} álbuns
      </div>

      {showSuperCard && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={handleCloseSuperCard}
        >
          <div 
            className="w-full max-w-2xl max-h-[90vh] bg-gradient-to-br from-gray-900 via-purple-900/90 to-fuchsia-900/90 rounded-2xl overflow-hidden border border-white/20 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-6 p-6">
              <div className="w-48 h-48 flex-shrink-0 bg-white/5 rounded-xl overflow-hidden">
                {coverUrls[focusedItem?.id] ? (
                  <img 
                    src={coverUrls[focusedItem.id]} 
                    alt="" 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Disc3 className="w-16 h-16 text-white/20" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 overflow-y-auto max-h-[calc(90vh-200px)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-white">{focusedItem?.title || 'Sem título'}</h2>
                    <p className="text-fuchsia-300 text-lg mt-1">{focusedItem?.artist || 'Desconhecido'}</p>
                  </div>
                  <button 
                    onClick={handleCloseSuperCard}
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  {grooveflixData.year && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-white/10 rounded text-xs text-white/60">
                      <Calendar className="w-3 h-3" />
                      {grooveflixData.year}
                    </span>
                  )}
                  {grooveflixData.country && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-white/10 rounded text-xs text-white/60">
                      <Globe className="w-3 h-3" />
                      {grooveflixData.country}
                    </span>
                  )}
                  {grooveflixData.labels && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-white/10 rounded text-xs text-white/60">
                      <Building className="w-3 h-3" />
                      {grooveflixData.labels}
                    </span>
                  )}
                  {grooveflixData.genre && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-fuchsia-500/20 border border-fuchsia-500/30 rounded-full text-xs text-fuchsia-300">
                      <Tag className="w-3 h-3" />
                      {grooveflixData.genre}
                    </span>
                  )}
                </div>

                {grooveflixData.formats && (
                  <p className="text-xs text-white/40 mt-2">
                    Formato: {grooveflixData.formats}
                  </p>
                )}

                {grooveflixData.description && (
                  <div className="mt-4 p-3 bg-white/5 rounded-lg">
                    <p className="text-xs text-white/50 font-medium uppercase tracking-wider mb-1">Notas</p>
                    <p className="text-sm text-white/70 whitespace-pre-wrap">{grooveflixData.description}</p>
                  </div>
                )}

                {tracklist.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center gap-2 text-fuchsia-300 text-sm font-bold mb-3">
                      <ListMusic className="w-4 h-4" />
                      Tracklist ({tracklist.length} faixas)
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-1.5 pr-2">
                      {tracklist.map((track, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm p-1.5 rounded hover:bg-white/5">
                          <span className="w-6 text-white/30 text-center">{track.position || i + 1}</span>
                          <span className="flex-1 text-white/80 truncate">{track.title}</span>
                          <span className="text-white/40 text-xs">{track.duration}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {audioFiles.length > 0 && (
                  <div className="mt-6 flex justify-center">
                    <button
                      onClick={() => { playAudio(); handleCloseSuperCard(); }}
                      className="flex items-center gap-3 px-8 py-3 bg-gradient-to-r from-fuchsia-500 to-purple-600 rounded-full font-bold text-lg hover:shadow-lg hover:shadow-fuchsia-500/30 transition"
                    >
                      <Play className="w-5 h-5" />
                      Ouvir Álbum
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
