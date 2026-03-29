import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Play, X, Trash2, Disc3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAudioPlayer } from '../contexts/AudioPlayerContext.jsx';
import { toast } from 'sonner';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://hlfirfukbrisfpebaaur.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const PLACEHOLDER_SVG = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500">
  <defs>
    <linearGradient id="vinyl" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:%231a1a1a"/>
      <stop offset="50%" style="stop-color:%23262626"/>
      <stop offset="100%" style="stop-color:%231a1a1a"/>
    </linearGradient>
  </defs>
  <rect width="500" height="500" fill="%230a0a0a"/>
  <circle cx="250" cy="250" r="200" fill="url(%23vinyl)" stroke="%23333" stroke-width="2"/>
  <circle cx="250" cy="250" r="60" fill="%231a1a1a" stroke="%23d4af37" stroke-width="2"/>
  <circle cx="250" cy="250" r="15" fill="%23d4af37"/>
  <text x="250" y="440" text-anchor="middle" font-family="Arial Black" font-size="24" fill="%23d4af37">RARE GROOVE</text>
</svg>
`)}`;

const fetchProxiedImage = async (discogsUrl) => {
  if (!discogsUrl) return PLACEHOLDER_SVG;
  try {
    const proxyUrl = `${SUPABASE_URL}/functions/v1/discogs-search/image-proxy?url=${encodeURIComponent(discogsUrl)}`;
    const response = await fetch(proxyUrl, {
      headers: { 
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
    });
    if (!response.ok) return PLACEHOLDER_SVG;
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch {
    return PLACEHOLDER_SVG;
  }
};

export default function CoverFlow3D({ items, onUpdateFocus, onOpenUploader, isAdmin, onAlbumDeleted }) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [coverUrls, setCoverUrls] = useState({});
  const [showSuperCard, setShowSuperCard] = useState(false);
  const [activeTrackIndex, setActiveTrackIndex] = useState(null);
  const [loadedImages, setLoadedImages] = useState({});
  
  const containerRef = useRef(null);
  const { playAlbum, currentTrack, isPlaying } = useAudioPlayer() || {};

  const focusedItem = items[focusedIndex];
  const grooveflixData = focusedItem?.metadata?.grooveflix || {};
  const rawTracklist = Array.isArray(grooveflixData.tracklist) ? grooveflixData.tracklist : [];
  const audioFiles = Array.isArray(grooveflixData.audio_files) ? grooveflixData.audio_files : [];

  const sortedTracklist = Array.isArray(rawTracklist) ? [...rawTracklist].sort((a, b) => {
    const trackA = a.trackNumber || parseInt(a.position?.split('-')[1]) || 0;
    const trackB = b.trackNumber || parseInt(b.position?.split('-')[1]) || 0;
    return trackA - trackB;
  }) : [];

  useEffect(() => {
    if (focusedItem && onUpdateFocus) {
      onUpdateFocus(focusedItem);
    }
    setActiveTrackIndex(null);
  }, [focusedIndex, focusedItem]);

  useEffect(() => {
    if (items.length === 0) return;

    const loadCover = async (item) => {
      if (coverUrls[item.id]) return;
      
      const discogsCover = item.metadata?.grooveflix?.coverUrl;

      if (discogsCover) {
        const blobUrl = await fetchProxiedImage(discogsCover);
        if (blobUrl !== PLACEHOLDER_SVG) {
          setCoverUrls(prev => ({ ...prev, [item.id]: blobUrl }));
        } else {
          setCoverUrls(prev => ({ ...prev, [item.id]: PLACEHOLDER_SVG }));
        }
        return;
      }
      
      setCoverUrls(prev => ({ ...prev, [item.id]: PLACEHOLDER_SVG }));
    };

    items.slice(0, 15).forEach(loadCover);
  }, [items.length]);

  const getPresignedUrl = async (filePath, type = 'audio') => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token || SUPABASE_ANON_KEY;
      const userId = session?.user?.id;
      if (!userId) throw new Error('missing_userId');

      const response = await fetch(`${SUPABASE_URL}/functions/v1/b2-presign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ file_path: filePath, userId, type }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);
      return data.url;
    } catch {
      return null;
    }
  };

  const handlePrev = useCallback(() => {
    setFocusedIndex(prev => Math.max(0, prev - 1));
  }, []);

  const handleNext = useCallback(() => {
    setFocusedIndex(prev => Math.min(items.length - 1, prev + 1));
  }, [items.length]);

  const handlePlayAlbum = useCallback(() => {
    if (!focusedItem || audioFiles.length === 0) {
      toast.error('Este álbum não tem arquivos de áudio');
      return;
    }
    if (playAlbum) {
      playAlbum({
        ...focusedItem,
        audio_files: audioFiles,
        tracklist: rawTracklist,
      }, 0);
      setActiveTrackIndex(0);
    }
  }, [focusedItem, audioFiles, playAlbum, rawTracklist]);

  const handlePlayTrack = useCallback((track, index) => {
    if (!focusedItem || audioFiles.length === 0) return;
    setActiveTrackIndex(index);
    if (playAlbum) {
      playAlbum({
        ...focusedItem,
        audio_files: audioFiles,
        tracklist: rawTracklist,
      }, index);
    }
  }, [focusedItem, audioFiles, playAlbum, rawTracklist]);

  const handleCardClick = (e, index) => {
    e.stopPropagation();
    setFocusedIndex(index);
  };

  const handleCoverExpand = () => {
    setShowSuperCard(true);
  };

  const handleCloseSuperCard = () => {
    setShowSuperCard(false);
  };

  const handleDeleteAlbum = useCallback(async (item) => {
    if (!confirm(`Deletar "${item.title}"?`)) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(`${SUPABASE_URL}/functions/v1/grooveflix-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ itemId: item.id }),
      });
      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Álbum deletado!');
      handleCloseSuperCard();
      if (typeof onAlbumDeleted === 'function') {
        onAlbumDeleted(item.id);
      }
    } catch {
      toast.error('Erro ao deletar álbum');
    }
  }, [SUPABASE_URL, SUPABASE_ANON_KEY]);

  const handleImageLoad = (itemId) => {
    setLoadedImages(prev => ({ ...prev, [itemId]: true }));
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Disc3 className="w-20 h-20 text-white/20 mb-4" />
        <p className="text-xl font-bold text-white/60 mb-2">Nenhum álbum encontrado</p>
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

  const getTransform = (index) => {
    const diff = index - focusedIndex;
    if (diff === 0) {
      return {
        transform: 'perspective(2000px) rotateY(0deg) translateZ(100px) scale(1)',
        opacity: 1,
        zIndex: 10,
      };
    } else if (diff < 0) {
      const absDiff = Math.abs(diff);
      const rotate = Math.min(absDiff * 30, 70);
      const translateZ = Math.max(-absDiff * 80, -200);
      const scale = Math.max(1 - absDiff * 0.1, 0.7);
      return {
        transform: `perspective(2000px) rotateY(${rotate}deg) translateZ(${translateZ}px) scale(${scale})`,
        opacity: Math.max(0.5 - absDiff * 0.15, 0.2),
        zIndex: 10 - absDiff,
      };
    } else {
      const absDiff = Math.abs(diff);
      const rotate = Math.min(-absDiff * 30, -70);
      const translateZ = Math.max(-absDiff * 80, -200);
      const scale = Math.max(1 - absDiff * 0.1, 0.7);
      return {
        transform: `perspective(2000px) rotateY(${rotate}deg) translateZ(${translateZ}px) scale(${scale})`,
        opacity: Math.max(0.5 - absDiff * 0.15, 0.2),
        zIndex: 10 - absDiff,
      };
    }
  };

  const visibleItems = [];
  for (let i = Math.max(0, focusedIndex - 5); i <= Math.min(items.length - 1, focusedIndex + 5); i++) {
    visibleItems.push({ index: i, item: items[i] });
  }

  return (
    <div className="relative w-full" style={{ background: '#000000', minHeight: '600px' }}>
      <style>{`
        .coverflow-item {
          transition: transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.5s ease-out;
          transform-style: preserve-3d;
          will-change: transform, opacity;
        }
        .coverflow-reflection {
          mask-image: linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 100%);
          -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 100%);
        }
        .metal-floor {
          background: linear-gradient(to bottom, #0a0a0a 0%, #151515 50%, #1a1a1a 100%);
          box-shadow: inset 0 20px 60px rgba(0,0,0,0.8);
        }
        @media (max-width: 768px) {
          .coverflow-container {
            perspective: 1200px !important;
          }
        }
      `}</style>

      {/* Coverflow Container */}
      <div 
        ref={containerRef}
        className="relative flex flex-col items-center justify-center py-8"
        style={{ 
          minHeight: '520px',
          perspective: '2000px',
          perspectiveOrigin: 'center center',
        }}
      >
        {/* Álbuns em Carrossel */}
        <div 
          className="relative flex items-center justify-center"
          style={{ 
            height: '380px',
            width: '100%',
            maxWidth: '1000px',
          }}
        >
          {visibleItems.map(({ index, item }) => {
            const style = getTransform(index);
            const coverUrl = coverUrls[item.id] || PLACEHOLDER_SVG;
            const isCenter = index === focusedIndex;
            const isLoaded = loadedImages[item.id];
            
            return (
              <div
                key={item.id}
                className="absolute coverflow-item cursor-pointer"
                style={{
                  ...style,
                  left: '50%',
                  marginLeft: '-125px',
                }}
                onClick={(e) => handleCardClick(e, index)}
              >
                {/* Capa do Álbum */}
                <div 
                  className="relative"
                  style={{ width: '250px', height: '250px' }}
                >
                  {/* Loading placeholder */}
                  {!isLoaded && (
                    <div 
                      className="absolute inset-0 bg-gray-900 rounded-lg animate-pulse"
                      style={{ width: '250px', height: '250px' }}
                    />
                  )}
                  
                  <img
                    src={coverUrl}
                    alt={item.title}
                    className="rounded-lg shadow-2xl"
                    style={{ 
                      width: '250px', 
                      height: '250px',
                      objectFit: 'cover',
                      display: isLoaded ? 'block' : 'none',
                      border: isCenter ? '2px solid rgba(255,255,255,0.3)' : '2px solid rgba(255,255,255,0.1)',
                      boxShadow: isCenter 
                        ? '0 20px 60px rgba(0,0,0,0.8), 0 0 40px rgba(0,255,255,0.1)' 
                        : '0 10px 30px rgba(0,0,0,0.6)',
                    }}
                    onLoad={() => handleImageLoad(item.id)}
                    draggable={false}
                  />
                  
                  {/* Reflexo Espelhado */}
                  <div 
                    className="absolute left-0 right-0 coverflow-reflection"
                    style={{ 
                      top: '250px',
                      height: '120px',
                      transform: 'scaleY(-1)',
                    }}
                  >
                    <img
                      src={coverUrl}
                      alt=""
                      className="rounded-lg"
                      style={{ 
                        width: '250px', 
                        height: '120px',
                        objectFit: 'cover',
                        opacity: 0.3,
                        filter: 'blur(2px)',
                      }}
                      draggable={false}
                    />
                  </div>

                  {/* Piso Metálico */}
                  <div 
                    className="absolute metal-floor rounded-b-lg"
                    style={{ 
                      top: '370px',
                      left: 0,
                      right: 0,
                      height: '30px',
                      background: 'linear-gradient(to bottom, #0a0a0a 0%, #151515 100%)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Controles de Navegação */}
        <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
          <button
            onClick={handlePrev}
            disabled={focusedIndex === 0}
            className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-black/80 hover:border-white/40 transition-all disabled:opacity-30 disabled:cursor-not-allowed pointer-events-auto"
            style={{ boxShadow: '0 0 20px rgba(0,255,255,0.2)' }}
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          <button
            onClick={handleNext}
            disabled={focusedIndex === items.length - 1}
            className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-black/80 hover:border-white/40 transition-all disabled:opacity-30 disabled:cursor-not-allowed pointer-events-auto"
            style={{ boxShadow: '0 0 20px rgba(0,255,255,0.2)' }}
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </div>

        {/* Indicadores */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {items.slice(0, Math.min(items.length, 12)).map((_, i) => (
            <button
              key={i}
              onClick={() => setFocusedIndex(i)}
              className={`transition-all ${
                i === focusedIndex 
                  ? 'w-8 h-2 rounded-full bg-white' 
                  : 'w-2 h-2 rounded-full bg-white/30 hover:bg-white/50'
              }`}
            />
          ))}
          {items.length > 12 && (
            <span className="text-white/40 text-xs ml-1">+{items.length - 12}</span>
          )}
        </div>
      </div>

      {/* Título e Info do Álbum Central */}
      <div className="text-center py-6 px-4">
        <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
          {focusedItem?.title || 'Sem título'}
        </h2>
        <p className="text-yellow-400 text-lg mt-1 font-medium">
          {focusedItem?.artist || 'Desconhecido'}
        </p>
        <div className="flex items-center justify-center gap-3 mt-3">
          {grooveflixData.year && (
            <span className="px-3 py-1 bg-white/10 rounded-full text-white/60 text-sm">
              {grooveflixData.year}
            </span>
          )}
          {grooveflixData.genre && (
            <span className="px-3 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded-full text-yellow-300 text-sm">
              {grooveflixData.genre}
            </span>
          )}
        </div>
        
        {/* Botão Ver Detalhes */}
        <button
          onClick={handleCoverExpand}
          className="mt-4 px-8 py-3 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black font-bold rounded-full shadow-lg shadow-yellow-500/30 transition-all hover:scale-105"
        >
          VER DETALHES
        </button>

        {/* Botão Play se tiver áudio */}
        {audioFiles.length > 0 && (
          <button
            onClick={handlePlayAlbum}
            className="mt-3 ml-3 px-6 py-3 bg-cyan-500/20 border border-cyan-500/50 hover:bg-cyan-500/30 text-cyan-300 font-bold rounded-full transition-all hover:scale-105"
            style={{ boxShadow: '0 0 20px rgba(0,255,255,0.2)' }}
          >
            <Play className="w-5 h-5 inline mr-2" />
            OUvir
          </button>
        )}
      </div>

      {/* Modal de Detalhes */}
      {showSuperCard && (
        <div 
          className="fixed inset-0 flex items-center justify-center p-4 bg-black/95"
          onClick={handleCloseSuperCard}
          style={{ zIndex: 99999 }}
        >
          <div 
            className="w-full max-w-4xl max-h-[90vh] bg-gray-900 rounded-2xl overflow-hidden border border-white/10"
            onClick={(e) => e.stopPropagation()}
            style={{ zIndex: 100000 }}
          >
            <div className="flex flex-col md:flex-row gap-6 p-6 overflow-y-auto max-h-[90vh]">
              {/* Capa */}
              <div className="w-full md:w-64 h-64 md:h-64 flex-shrink-0 bg-black rounded-xl overflow-hidden shadow-2xl">
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

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-white">{focusedItem?.title || 'Sem título'}</h2>
                    <p className="text-yellow-400 text-lg mt-1">{focusedItem?.artist || 'Desconhecido'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteAlbum(focusedItem)}
                        className="p-2 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-400 transition"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={handleCloseSuperCard}
                      className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/60 transition"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  {grooveflixData.year && (
                    <span className="px-2 py-1 bg-white/10 rounded text-xs text-white/60">{grooveflixData.year}</span>
                  )}
                  {grooveflixData.genre && (
                    <span className="px-2 py-1 bg-yellow-500/20 rounded text-xs text-yellow-300">{grooveflixData.genre}</span>
                  )}
                </div>

                {sortedTracklist.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-yellow-400 text-sm font-bold mb-2">{sortedTracklist.length} faixas</h3>
                    <div className="max-h-60 overflow-y-auto space-y-1 pr-2">
                      {sortedTracklist.slice(0, 15).map((track, i) => (
                        <button
                          key={i}
                          onClick={() => audioFiles.length > 0 && handlePlayTrack(track, i)}
                          disabled={audioFiles.length === 0}
                          className={`w-full flex items-center gap-3 text-sm p-2 rounded text-left transition ${
                            activeTrackIndex === i 
                              ? 'bg-cyan-500/30 border border-cyan-500/50 text-white' 
                              : 'hover:bg-white/5 text-white/70'
                          } ${audioFiles.length === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <span className="w-6 text-center text-white/30">{i + 1}</span>
                          <span className="flex-1 truncate">{track.title}</span>
                          <span className="text-white/40 text-xs">{track.duration}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {audioFiles.length > 0 && (
                  <button
                    onClick={() => { handlePlayAlbum(); handleCloseSuperCard(); }}
                    className="mt-4 flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-600 to-yellow-500 rounded-full font-bold hover:shadow-lg transition"
                  >
                    <Play className="w-5 h-5" />
                    Ouvir Álbum
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
