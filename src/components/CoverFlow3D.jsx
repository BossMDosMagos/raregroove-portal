import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause, Volume2, Disc, Music, X, ListMusic, Building, Calendar, Globe, Tag, Disc3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAudioPlayer } from '../contexts/AudioPlayerContext.jsx';
import { toast } from 'sonner';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://hlfirfukbrisfpebaaur.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export default function CoverFlow3D({ items, onUpdateFocus, onOpenUploader, isAdmin }) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [coverUrls, setCoverUrls] = useState({});
  const [showSuperCard, setShowSuperCard] = useState(false);
  const [activeTrackIndex, setActiveTrackIndex] = useState(null);
  
  const abortControllerRef = useRef(null);
  
  const { playAlbum, currentTrack, isPlaying: globalIsPlaying } = useAudioPlayer() || {};

  const focusedItem = items[focusedIndex];
  const grooveflixData = focusedItem?.metadata?.grooveflix || {};
  const rawTracklist = grooveflixData.tracklist || [];
  const audioFiles = grooveflixData.audio_files || [];

  const sortedTracklist = [...rawTracklist].sort((a, b) => {
    const posA = parseInt(a.position) || 0;
    const posB = parseInt(b.position) || 0;
    return posA - posB;
  });

  useEffect(() => {
    if (focusedItem && onUpdateFocus) {
      onUpdateFocus(focusedItem);
    }
    setActiveTrackIndex(null);
  }, [focusedIndex, focusedItem]);

  useEffect(() => {
    if (items.length === 0) return;

    const loadCover = async (item) => {
      const coverPath = item.metadata?.grooveflix?.cover_path;
      const discogsCover = item.metadata?.grooveflix?.coverUrl;

      if (discogsCover) {
        setCoverUrls(prev => ({ ...prev, [item.id]: discogsCover }));
        return;
      }

      if (!coverPath) return;

      try {
        const url = await getPresignedUrl(coverPath, 'cover');
        setCoverUrls(prev => ({ ...prev, [item.id]: url }));
      } catch (e) {
        console.error('[COVER] Error:', e);
      }
    };

    items.slice(0, 7).forEach(loadCover);
  }, [items.length]);

  const getPresignedUrl = async (filePath, type = 'audio') => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
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
        signal: abortControllerRef.current.signal,
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);
      return data.url;
    } catch (e) {
      if (e.name === 'AbortError') {
        console.log('[PRESIGN] Request aborted');
        return null;
      }
      throw e;
    }
  };

  const handlePrev = () => {
    setFocusedIndex(prev => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setFocusedIndex(prev => Math.min(items.length - 1, prev + 1));
  };

  const handlePlayAlbum = useCallback(async () => {
    if (!focusedItem || audioFiles.length === 0) return;

    if (playAlbum) {
      playAlbum(focusedItem);
      setActiveTrackIndex(0);
    }
  }, [focusedItem, audioFiles, playAlbum]);

  const handlePlayTrack = useCallback(async (track, index) => {
    if (!focusedItem || audioFiles.length === 0) return;

    setActiveTrackIndex(index);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const trackAudioFile = audioFiles[index];
      if (!trackAudioFile?.path) {
        toast.error('Faixa sem arquivo de áudio');
        return;
      }

      const url = await getPresignedUrl(trackAudioFile.path, 'audio');
      
      if (!url) return;

      if (playAlbum) {
        playAlbum({
          ...focusedItem,
          audio_files: audioFiles,
        });
      }

    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('[PLAY TRACK] Error:', e);
        toast.error('Erro ao reproduzir faixa');
      }
    }
  }, [focusedItem, audioFiles, playAlbum]);

  const handleCoverClick = (e) => {
    e.stopPropagation();
    setShowSuperCard(true);
  };

  const handleCloseSuperCard = (e) => {
    if (e) e.stopPropagation();
    setShowSuperCard(false);
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

  const isCurrentAlbumPlaying = currentTrack?.id === focusedItem?.id;

  return (
    <div className="relative w-full">
      <div className="relative h-[400px] overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          {coverUrls[focusedItem?.id] ? (
            <button
              onClick={handleCoverClick}
              className="w-[350px] h-[350px] rounded-2xl overflow-hidden shadow-2xl transition-transform hover:scale-[1.02] hover:shadow-fuchsia-500/30 focus:outline-none focus:ring-2 focus:ring-fuchsia-400"
              style={{
                backgroundImage: `url(${coverUrls[focusedItem.id]})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
              aria-label="Ver detalhes do álbum"
            />
          ) : (
            <button
              onClick={handleCoverClick}
              className="w-[350px] h-[350px] rounded-2xl bg-gradient-to-br from-fuchsia-500/30 via-purple-500/20 to-black flex items-center justify-center transition-transform hover:scale-[1.02] hover:shadow-fuchsia-500/30 focus:outline-none focus:ring-2 focus:ring-fuchsia-400"
              aria-label="Ver detalhes do álbum"
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

      {sortedTracklist.length > 0 && (
        <div className="mt-6 bg-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between text-fuchsia-300 text-sm font-bold mb-3">
            <div className="flex items-center gap-2">
              <ListMusic className="w-4 h-4" />
              {sortedTracklist.length} faixas
            </div>
            {isCurrentAlbumPlaying && (
              <span className="text-xs bg-fuchsia-500/20 text-fuchsia-300 px-2 py-1 rounded-full">
                Tocando agora
              </span>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto space-y-1 pr-2">
            {sortedTracklist.map((track, i) => {
              const isActive = activeTrackIndex === i;
              const isPlaying = isActive && isCurrentAlbumPlaying && globalIsPlaying;
              
              return (
                <button
                  key={i}
                  onClick={() => handlePlayTrack(track, i)}
                  disabled={audioFiles.length === 0}
                  className={`w-full flex items-center gap-3 text-sm p-2 rounded-lg transition-all text-left ${
                    isActive 
                      ? 'bg-fuchsia-500/30 border border-fuchsia-500/50' 
                      : 'hover:bg-white/5 border border-transparent'
                  } ${audioFiles.length === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span className={`w-6 text-center ${isActive ? 'text-fuchsia-300' : 'text-white/30'}`}>
                    {isPlaying ? (
                      <span className="flex items-center justify-center">
                        <span className="w-1.5 h-3 bg-fuchsia-400 rounded-sm animate-pulse" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-1.5 h-4 bg-fuchsia-400 rounded-sm animate-pulse mx-0.5" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-1.5 h-2 bg-fuchsia-400 rounded-sm animate-pulse" style={{ animationDelay: '300ms' }}></span>
                      </span>
                    ) : (
                      track.position || i + 1
                    )}
                  </span>
                  <span className={`flex-1 truncate ${isActive ? 'text-white' : 'text-white/80'}`}>
                    {track.title}
                  </span>
                  <span className="text-white/40 text-xs">{track.duration}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {audioFiles.length > 0 && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={handlePlayAlbum}
            className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-fuchsia-500 to-purple-600 rounded-full font-bold text-lg hover:shadow-lg hover:shadow-fuchsia-500/30 transition"
          >
            <Play className="w-6 h-6" />
            Ouvir Álbum
          </button>
        </div>
      )}

      <div className="mt-8 text-center text-white/30 text-sm">
        {focusedIndex + 1} de {items.length} álbuns
      </div>

      {showSuperCard && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          onClick={handleCloseSuperCard}
        >
          <div 
            className="w-full max-w-3xl max-h-[90vh] bg-gradient-to-br from-gray-900 via-purple-900/95 to-fuchsia-900/95 rounded-2xl overflow-hidden border border-white/20 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-6 p-6 overflow-y-auto max-h-[90vh]">
              <div className="w-48 h-48 flex-shrink-0 bg-white/5 rounded-xl overflow-hidden shadow-lg">
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

              <div className="flex-1 min-w-0">
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

                {sortedTracklist.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center gap-2 text-fuchsia-300 text-sm font-bold mb-3">
                      <ListMusic className="w-4 h-4" />
                      Tracklist ({sortedTracklist.length} faixas)
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-1 pr-2">
                      {sortedTracklist.map((track, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            if (audioFiles.length > 0) {
                              handlePlayTrack(track, i);
                              handleCloseSuperCard();
                            }
                          }}
                          disabled={audioFiles.length === 0}
                          className={`w-full flex items-center gap-3 text-sm p-2 rounded hover:bg-white/5 text-left ${
                            audioFiles.length === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                        >
                          <span className="w-6 text-white/30 text-center">{track.position || i + 1}</span>
                          <span className="flex-1 text-white/80 truncate">{track.title}</span>
                          <span className="text-white/40 text-xs">{track.duration}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {audioFiles.length > 0 && (
                  <div className="mt-6 flex justify-center">
                    <button
                      onClick={() => {
                        handlePlayAlbum();
                        handleCloseSuperCard();
                      }}
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