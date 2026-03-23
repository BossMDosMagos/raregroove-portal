import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause, Volume2, Disc, Music, X, ListMusic, Building, Calendar, Globe, Tag, Disc3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAudioPlayer } from '../contexts/AudioPlayerContext.jsx';
import { toast } from 'sonner';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://hlfirfukbrisfpebaaur.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const getImageProxyUrl = (discogsUrl) => {
  if (!discogsUrl) return null;
  return `${SUPABASE_URL}/functions/v1/discogs-search/image-proxy?url=${encodeURIComponent(discogsUrl)}`;
};

export default function CoverFlow3D({ items, onUpdateFocus, onOpenUploader, isAdmin }) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [coverUrls, setCoverUrls] = useState({});
  const [showSuperCard, setShowSuperCard] = useState(false);
  const [activeTrackIndex, setActiveTrackIndex] = useState(null);
  const [dominantColor, setDominantColor] = useState('#0a0a0a');
  
  const abortControllerRef = useRef(null);
  const cdRotateRef = useRef(null);
  
  const { playAlbum, currentTrack, isPlaying: globalIsPlaying } = useAudioPlayer() || {};

  const focusedItem = items[focusedIndex];
  const grooveflixData = focusedItem?.metadata?.grooveflix || {};
  const rawTracklist = grooveflixData.tracklist || [];
  const audioFiles = grooveflixData.audio_files || [];

  const sortedTracklist = [...rawTracklist].sort((a, b) => {
    const discA = a.discNumber || 1;
    const discB = b.discNumber || 1;
    
    const isNumericA = typeof discA === 'number';
    const isNumericB = typeof discB === 'number';
    
    if (isNumericA && isNumericB) {
      if (discA !== discB) return discA - discB;
    } else if (isNumericA && !isNumericB) {
      return -1;
    } else if (!isNumericA && isNumericB) {
      return 1;
    } else {
      const strA = String(discA).toLowerCase();
      const strB = String(discB).toLowerCase();
      if (strA !== strB) return strA.localeCompare(strB);
    }
    
    const trackA = a.trackNumber || parseInt(a.position?.split('-')[1]) || 0;
    const trackB = b.trackNumber || parseInt(b.position?.split('-')[1]) || 0;
    return trackA - trackB;
  });

  const groupedTracks = sortedTracklist.reduce((acc, track) => {
    const discKey = track.discNumber || 1;
    const keyStr = String(discKey);
    if (!acc[keyStr]) {
      acc[keyStr] = {
        label: keyStr,
        tracks: []
      };
    }
    acc[keyStr].tracks.push(track);
    return acc;
  }, {});

  const discKeys = Object.keys(groupedTracks).sort((a, b) => {
    const isNumericA = /^\d+$/.test(a);
    const isNumericB = /^\d+$/.test(b);
    if (isNumericA && isNumericB) return parseInt(a) - parseInt(b);
    if (isNumericA && !isNumericB) return -1;
    if (!isNumericA && isNumericB) return 1;
    return a.localeCompare(b);
  });

  useEffect(() => {
    if (focusedItem && onUpdateFocus) {
      onUpdateFocus(focusedItem);
    }
    setActiveTrackIndex(null);
  }, [focusedIndex, focusedItem]);

  useEffect(() => {
    if (globalIsPlaying && cdRotateRef.current) {
      cdRotateRef.current.style.animationPlayState = 'running';
    } else if (cdRotateRef.current) {
      cdRotateRef.current.style.animationPlayState = 'paused';
    }
  }, [globalIsPlaying]);

  useEffect(() => {
    const url = coverUrls[focusedItem?.id];
    if (!url) {
      setDominantColor('#0a0a0a');
      return;
    }
    
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = url;
    
    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 50;
        canvas.height = 50;
        ctx.drawImage(img, 0, 0, 50, 50);
        const imageData = ctx.getImageData(0, 0, 50, 50).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < imageData.length; i += 16) {
          r += imageData[i];
          g += imageData[i + 1];
          b += imageData[i + 2];
          count++;
        }
        if (count > 0) {
          setDominantColor(`rgb(${Math.floor((r/count)*0.15)}, ${Math.floor((g/count)*0.15)}, ${Math.floor((b/count)*0.15)})`);
        }
      } catch (e) {
        setDominantColor('#0a0a0a');
      }
    };
    
    img.onerror = () => {
      if (cancelled) return;
      setDominantColor('#0a0a0a');
    };
    
    return () => {
      cancelled = true;
    };
  }, [focusedItem?.id, coverUrls[focusedItem?.id]]);

  useEffect(() => {
    if (items.length === 0) return;

    const loadCover = async (item) => {
      const coverPath = item.metadata?.grooveflix?.cover_path;
      const discogsCover = item.metadata?.grooveflix?.coverUrl;

      if (discogsCover) {
        const proxiedUrl = getImageProxyUrl(discogsCover);
        console.log('[COVER] Using proxied Discogs URL for:', item.title);
        setCoverUrls(prev => ({ ...prev, [item.id]: proxiedUrl }));
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
      const userId = session?.user?.id;

      if (!userId) {
        console.error('[PRESIGN] No userId available');
        throw new Error('missing_userId');
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/b2-presign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ file_path: filePath, userId, type }),
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
      playAlbum({
        ...focusedItem,
        audio_files: audioFiles,
        tracklist: rawTracklist,
      });
      setActiveTrackIndex(0);
    }
  }, [focusedItem, audioFiles, playAlbum, rawTracklist]);

  const handlePlayTrack = useCallback(async (track, index) => {
    if (!focusedItem || audioFiles.length === 0) return;

    setActiveTrackIndex(index);

    if (playAlbum) {
      playAlbum({
        ...focusedItem,
        audio_files: audioFiles,
        tracklist: rawTracklist,
      });
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
            className="px-6 py-3 bg-gradient-to-r from-yellow-600 to-yellow-500 rounded-full font-bold"
          >
            Adicionar Primeiro Álbum
          </button>
        )}
      </div>
    );
  }

  const isCurrentAlbumPlaying = currentTrack?.id === focusedItem?.id;

  return (
    <div className="relative w-full" style={{ background: `radial-gradient(ellipse at center, ${dominantColor} 0%, #0a0a0a 70%)` }}>
      <style>{`
        @keyframes cdRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .cd-disc { animation: cdRotate 3s linear infinite; }
        @keyframes flipIn { 0% { transform: perspective(1000px) rotateY(90deg) scale(0.8); opacity: 0; } 100% { transform: perspective(1000px) rotateY(0deg) scale(1); opacity: 1; } }
        .super-card-animate { animation: flipIn 0.4s ease-out forwards; }
      `}</style>
      <div className="relative h-[400px] overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            {coverUrls[focusedItem?.id] ? (
              <button
                onClick={handleCoverClick}
                className="w-[350px] h-[350px] rounded-2xl overflow-hidden shadow-2xl transition-transform hover:scale-[1.02] hover:shadow-yellow-500/30 focus:outline-none focus:ring-2 focus:ring-yellow-400"
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
                className="w-[350px] h-[350px] rounded-2xl bg-gradient-to-br from-yellow-500/20 to-black flex items-center justify-center transition-transform hover:scale-[1.02] hover:shadow-yellow-500/30 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                aria-label="Ver detalhes do álbum"
              >
                <Disc className="w-24 h-24 text-white/30" />
              </button>
            )}
            {isCurrentAlbumPlaying && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div ref={cdRotateRef} className="cd-disc w-[360px] h-[360px] rounded-full border-4 border-white/10 shadow-2xl" style={{ background: `radial-gradient(circle at center, transparent 35%, rgba(212,175,55,0.1) 36%, rgba(212,175,55,0.05) 70%, transparent 71%)`, boxShadow: 'inset 0 0 60px rgba(0,0,0,0.8), 0 0 40px rgba(212,175,55,0.2)' }}>
                  <div className="absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle at center, transparent 48%, rgba(212,175,55,0.3) 49%, rgba(212,175,55,0.1) 60%, transparent 61%)` }} />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black border-2 border-yellow-500/50" />
                </div>
              </div>
            )}
          </div>
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
                i === focusedIndex ? 'bg-yellow-400 w-6' : 'bg-white/30'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="mt-6 text-center">
        <h2 className="text-2xl font-black text-white">{focusedItem?.title || 'Sem título'}</h2>
        <p className="text-yellow-400 mt-1">{focusedItem?.artist || 'Desconhecido'}</p>

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
          <div className="flex items-center justify-between text-yellow-400 text-sm font-bold mb-3">
            <div className="flex items-center gap-2">
              <ListMusic className="w-4 h-4" />
              {sortedTracklist.length} faixas
              {discKeys.length > 1 && (
                <span className="text-xs text-white/40 ml-2">({discKeys.length} discos)</span>
              )}
            </div>
            {isCurrentAlbumPlaying && (
              <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-full">
                Tocando agora
              </span>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto space-y-3 pr-2">
            {discKeys.map((discKey) => {
              const discData = groupedTracks[discKey];
              const discTracks = discData.tracks;
              
              const isNumericDisc = /^\d+$/.test(discKey);
              let discLabel;
              if (discKeys.length === 1) {
                discLabel = null;
              } else if (isNumericDisc) {
                discLabel = `CD ${parseInt(discKey)}`;
              } else {
                discLabel = discKey.toUpperCase();
              }
              
              return (
                <div key={discKey}>
                  {discLabel && (
                    <div className="flex items-center gap-2 py-2 border-b border-white/10 mb-2">
                      <Disc3 className="w-4 h-4 text-yellow-400" />
                      <span className="text-yellow-300 font-bold text-sm">{discLabel}</span>
                      <span className="text-white/40 text-xs">({discTracks.length} faixas)</span>
                    </div>
                  )}
                  <div className="space-y-1">
                    {discTracks.map((track, i) => {
                      const globalIndex = sortedTracklist.indexOf(track);
                      const isActive = activeTrackIndex === globalIndex;
                      const isPlaying = isActive && isCurrentAlbumPlaying && globalIsPlaying;
                      
                      return (
                        <button
                          key={i}
                          onClick={() => handlePlayTrack(track, globalIndex)}
                          disabled={audioFiles.length === 0}
                          className={`w-full flex items-center gap-3 text-sm p-2 rounded-lg transition-all text-left ${
                            isActive 
                              ? 'bg-yellow-500/30 border border-yellow-500/50' 
                              : 'hover:bg-white/5 border border-transparent'
                          } ${audioFiles.length === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <span className={`w-6 text-center ${isActive ? 'text-yellow-300' : 'text-white/30'}`}>
                            {isPlaying ? (
                              <span className="flex items-center justify-center">
                                <span className="w-1.5 h-3 bg-yellow-400 rounded-sm animate-pulse" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-1.5 h-4 bg-yellow-400 rounded-sm animate-pulse mx-0.5" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-1.5 h-2 bg-yellow-400 rounded-sm animate-pulse" style={{ animationDelay: '300ms' }}></span>
                              </span>
                            ) : (
                              track.trackNumber || track.position || i + 1
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
              );
            })}
          </div>
        </div>
      )}

      {audioFiles.length > 0 && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={handlePlayAlbum}
            className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-yellow-600 to-yellow-500 rounded-full font-bold text-lg hover:shadow-lg hover:shadow-yellow-500/30 transition"
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
            className="super-card-animate w-full max-w-3xl max-h-[90vh] bg-black/90 backdrop-blur-xl rounded-2xl overflow-hidden border border-yellow-500/30 shadow-2xl shadow-yellow-500/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-6 p-6 overflow-y-auto max-h-[90vh]">
              <div className="w-48 h-48 flex-shrink-0 bg-white/5 rounded-xl overflow-hidden shadow-lg shadow-yellow-500/10">
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
                    <p className="text-yellow-400 text-lg mt-1">{focusedItem?.artist || 'Desconhecido'}</p>
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
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded-full text-xs text-yellow-300">
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
                    <div className="flex items-center gap-2 text-yellow-400 text-sm font-bold mb-3">
                      <ListMusic className="w-4 h-4" />
                      Tracklist ({sortedTracklist.length} faixas)
                      {discKeys.length > 1 && (
                        <span className="text-xs text-white/40 ml-2">({discKeys.length} discos)</span>
                      )}
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-3 pr-2">
                      {discKeys.map((discKey) => {
                        const discTracks = groupedTracks[discKey];
                        const isNumeric = /^\d+$/.test(discKey);
                        const discNum = isNumeric ? parseInt(discKey, 10) : null;
                        const discLabel = discKeys.length > 1
                          ? (isNumeric 
                              ? (discNum === 1 ? 'CD 1' : `CD ${discNum}`)
                              : discKey.toUpperCase())
                          : null;
                        
                        return (
                          <div key={discKey}>
                            {discLabel && (
                              <div className="flex items-center gap-2 py-1.5 border-b border-white/10 mb-1">
                                <Disc3 className="w-3.5 h-3.5 text-yellow-400" />
                                <span className="text-yellow-300 font-bold text-xs">{discLabel}</span>
                                <span className="text-white/30 text-xs">({discTracks.length} faixas)</span>
                              </div>
                            )}
                            {discTracks.map((track, i) => {
                              const globalIndex = sortedTracklist.indexOf(track);
                              return (
                                <button
                                  key={i}
                                  onClick={() => {
                                    if (audioFiles.length > 0) {
                                      handlePlayTrack(track, globalIndex);
                                      handleCloseSuperCard();
                                    }
                                  }}
                                  disabled={audioFiles.length === 0}
                                  className={`w-full flex items-center gap-3 text-sm p-1.5 rounded hover:bg-white/5 text-left ${
                                    audioFiles.length === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                                  }`}
                                >
                                  <span className="w-6 text-white/30 text-center">{track.trackNumber || track.position || i + 1}</span>
                                  <span className="flex-1 text-white/80 truncate">{track.title}</span>
                                  <span className="text-white/40 text-xs">{track.duration}</span>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
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
                      className="flex items-center gap-3 px-8 py-3 bg-gradient-to-r from-yellow-600 to-yellow-500 rounded-full font-bold text-lg hover:shadow-lg hover:shadow-yellow-500/30 transition"
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