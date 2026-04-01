import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Trash2, Disc3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useGrooveflixPlayer } from '../hooks/useGrooveflixPlayer.js';
import { toast } from 'sonner';
import { LCDDisplay } from './LCDDisplay.jsx';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://hlfirfukbrisfpebaaur.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const PLACEHOLDER_SVG = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500">
  <rect width="500" height="500" fill="%230a0a0a"/>
  <circle cx="250" cy="250" r="200" fill="%231a1a1a" stroke="%23333" stroke-width="2"/>
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
      headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY },
    });
    if (!response.ok) return PLACEHOLDER_SVG;
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch {
    return PLACEHOLDER_SVG;
  }
};

export default function CoverFlow3D({ items, onUpdateFocus, isAdmin, onAlbumDeleted, currentTrack, isPlaying, volume }) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [coverUrls, setCoverUrls] = useState({});
  const [showDetails, setShowDetails] = useState(false);
  const [activeTrackIndex, setActiveTrackIndex] = useState(null);
  
  const containerRef = useRef(null);
  const { playAlbum, isPlaying: localIsPlaying } = useGrooveflixPlayer() || {};

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
        setCoverUrls(prev => ({ ...prev, [item.id]: blobUrl !== PLACEHOLDER_SVG ? blobUrl : PLACEHOLDER_SVG }));
      } else {
        setCoverUrls(prev => ({ ...prev, [item.id]: PLACEHOLDER_SVG }));
      }
    };

    items.slice(0, 11).forEach(loadCover);
  }, [items.length]);

  const handleAlbumClick = useCallback((index) => {
    setFocusedIndex(index);
  }, []);

  const handlePlayAlbum = useCallback(() => {
    if (!focusedItem || audioFiles.length === 0) {
      toast.error('Este álbum não tem arquivos de áudio');
      return;
    }
    if (playAlbum) {
      playAlbum({ ...focusedItem, audio_files: audioFiles, tracklist: rawTracklist }, 0);
      setActiveTrackIndex(0);
    }
  }, [focusedItem, audioFiles, playAlbum, rawTracklist]);

  const handlePlayTrack = useCallback((track, index) => {
    if (!focusedItem || audioFiles.length === 0) return;
    setActiveTrackIndex(index);
    if (playAlbum) {
      playAlbum({ ...focusedItem, audio_files: audioFiles, tracklist: rawTracklist }, index);
    }
  }, [focusedItem, audioFiles, playAlbum, rawTracklist]);

  const handleDeleteAlbum = useCallback(async (item) => {
    if (!confirm(`Deletar "${item.title}"?`)) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(`${SUPABASE_URL}/functions/v1/grooveflix-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ itemId: item.id }),
      });
      const result = await response.json();
      if (result.error) { toast.error(result.error); return; }
      toast.success('Álbum deletado!');
      setShowDetails(false);
      if (typeof onAlbumDeleted === 'function') onAlbumDeleted(item.id);
    } catch {
      toast.error('Erro ao deletar álbum');
    }
  }, [SUPABASE_URL, SUPABASE_ANON_KEY]);

  const getItemPosition = (index) => {
    const diff = index - focusedIndex;
    if (diff === 0) return 'active';
    if (diff === -1) return 'left-1';
    if (diff === -2) return 'left-2';
    if (diff === 1) return 'right-1';
    if (diff === 2) return 'right-2';
    return 'hidden';
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Disc3 className="w-20 h-20 text-white/20 mb-4" />
        <p className="text-xl font-bold text-white/60">Nenhum álbum encontrado</p>
      </div>
    );
  }

  const visibleItems = items.map((item, index) => ({
    index,
    item,
    position: getItemPosition(index)
  })).filter(i => i.position !== 'hidden');

  return (
    <div className="relative w-full" style={{ background: '#000000', minHeight: '650px' }}>
      <style>{`
        .coverflow-scene {
          perspective: 1200px;
          perspective-origin: 50% 50%;
        }
        .album-cover {
          transform-style: preserve-3d;
          transition: all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          -webkit-transform-style: preserve-3d;
          position: absolute;
          cursor: pointer;
        }
        .album-cover.active {
          transform: rotateY(0deg) translateZ(250px) scale(1);
          -webkit-transform: rotateY(0deg) translateZ(250px) scale(1);
          z-index: 10;
          opacity: 1;
        }
        .album-cover.left-1 {
          transform: rotateY(55deg) translateX(-180px) translateZ(-100px) scale(0.9);
          -webkit-transform: rotateY(55deg) translateX(-180px) translateZ(-100px) scale(0.9);
          z-index: 5;
          opacity: 0.7;
        }
        .album-cover.left-2 {
          transform: rotateY(65deg) translateX(-320px) translateZ(-180px) scale(0.75);
          -webkit-transform: rotateY(65deg) translateX(-320px) translateZ(-180px) scale(0.75);
          z-index: 3;
          opacity: 0.4;
        }
        .album-cover.right-1 {
          transform: rotateY(-55deg) translateX(180px) translateZ(-100px) scale(0.9);
          -webkit-transform: rotateY(-55deg) translateX(180px) translateZ(-100px) scale(0.9);
          z-index: 5;
          opacity: 0.7;
        }
        .album-cover.right-2 {
          transform: rotateY(-65deg) translateX(320px) translateZ(-180px) scale(0.75);
          -webkit-transform: rotateY(-65deg) translateX(320px) translateZ(-180px) scale(0.75);
          z-index: 3;
          opacity: 0.4;
        }
        .album-cover.hidden {
          transform: translateZ(-500px) scale(0.5);
          -webkit-transform: translateZ(-500px) scale(0.5);
          opacity: 0;
          z-index: 0;
        }
        .album-image {
          width: 280px;
          height: 280px;
          border-radius: 12px;
          object-fit: cover;
          -webkit-box-reflect: below 3px linear-gradient(transparent 60%, rgba(255,255,255,0.15) 100%);
          box-shadow: 0 25px 50px rgba(0,0,0,0.8);
        }
        .album-cover.active .album-image {
          border: 3px solid rgba(0,255,255,0.5);
          box-shadow: 0 30px 60px rgba(0,0,0,0.9), 0 0 40px rgba(0,255,255,0.2);
        }
        .glass-floor {
          position: absolute;
          bottom: -80px;
          left: 50%;
          transform: translateX(-50%) rotateX(90deg);
          width: 600px;
          height: 300px;
          background: linear-gradient(to bottom, rgba(20,20,20,0.3) 0%, transparent 100%);
          border-radius: 50%;
        }
        .reflection {
          transform: scaleY(-1);
          -webkit-transform: scaleY(-1);
          opacity: 0.25;
          filter: blur(2px);
          mask-image: linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 80%);
          -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 80%);
        }
        @media (max-width: 768px) {
          .coverflow-scene { perspective: 800px; }
          .album-image { width: 180px; height: 180px; }
          .album-cover.active { transform: rotateY(0deg) translateZ(150px) scale(1); }
          .album-cover.left-1 { transform: rotateY(50deg) translateX(-120px) translateZ(-80px) scale(0.85); }
          .album-cover.right-1 { transform: rotateY(-50deg) translateX(120px) translateZ(-80px) scale(0.85); }
          .album-cover.left-2, .album-cover.right-2 { opacity: 0; }
        }
      `}</style>

      {/* Coverflow 3D Scene */}
      <div 
        ref={containerRef}
        className="relative flex items-center justify-center coverflow-scene"
        style={{ height: '420px', overflow: 'hidden' }}
      >
        {/* Piso de vidro */}
        <div className="glass-floor" />

        {/* Álbuns */}
        {visibleItems.map(({ index, item, position }) => {
          const coverUrl = coverUrls[item.id] || PLACEHOLDER_SVG;
          return (
            <div
              key={item.id}
              className={`album-cover ${position}`}
              onClick={() => position === 'active' ? setShowDetails(true) : handleAlbumClick(index)}
              style={{ 
                left: '50%', 
                marginLeft: '-140px',
                top: '50%',
                marginTop: '-140px',
              }}
            >
              {/* Imagem Principal */}
              <img
                src={coverUrl}
                alt={item.title}
                className="album-image"
                draggable={false}
              />
              
              {/* Reflexo Espeelhado */}
              <div className="reflection">
                <img
                  src={coverUrl}
                  alt=""
                  className="album-image"
                  style={{ 
                    borderRadius: '12px',
                    filter: 'blur(2px)',
                    opacity: 0.2,
                  }}
                  draggable={false}
                />
              </div>
            </div>
          );
        })}

        {/* Navegação Lateral */}
        <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
          <button
            onClick={() => setFocusedIndex(prev => Math.max(0, prev - 1))}
            disabled={focusedIndex === 0}
            className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-sm border-2 border-white/20 flex items-center justify-center text-white hover:bg-black/80 hover:border-cyan-400/50 transition-all disabled:opacity-20 pointer-events-auto"
            style={{ boxShadow: '0 0 30px rgba(0,255,255,0.15)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <button
            onClick={() => setFocusedIndex(prev => Math.min(items.length - 1, prev + 1))}
            disabled={focusedIndex === items.length - 1}
            className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-sm border-2 border-white/20 flex items-center justify-center text-white hover:bg-black/80 hover:border-cyan-400/50 transition-all disabled:opacity-20 pointer-events-auto"
            style={{ boxShadow: '0 0 30px rgba(0,255,255,0.15)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        </div>

        {/* Indicadores */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {items.slice(0, Math.min(items.length, 15)).map((_, i) => (
            <button
              key={i}
              onClick={() => setFocusedIndex(i)}
              className={`h-1 rounded-full transition-all ${
                i === focusedIndex 
                  ? 'w-8 bg-white' 
                  : 'w-2 bg-white/30 hover:bg-white/50'
              }`}
            />
          ))}
          {items.length > 15 && <span className="text-white/40 text-xs self-center ml-1">+{items.length - 15}</span>}
        </div>
      </div>

      {/* Info do Álbum Central */}
      <div className="flex flex-col items-center gap-4 py-4 px-4">
        <LCDDisplay
          line1={focusedItem?.title}
          line2={focusedItem?.artist}
          line3=""
          line4=""
          isPlaying={isPlaying}
          showBounds={true}
        />
        
        <div className="flex items-center justify-center gap-3 mt-2">
          {grooveflixData.year && (
            <span className="px-3 py-1 bg-white/10 rounded-full text-white/60 text-sm">
              {grooveflixData.year}
            </span>
          )}
          {grooveflixData.genre && (
            <span className="px-3 py-1 bg-cyan-500/20 border border-cyan-500/40 rounded-full text-cyan-300 text-sm">
              {grooveflixData.genre}
            </span>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 mt-6">
          {audioFiles.length > 0 && (
            <button
              onClick={handlePlayAlbum}
              className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-black font-bold rounded-full shadow-lg transition-all hover:scale-105"
              style={{ boxShadow: '0 0 30px rgba(0,255,255,0.4)' }}
            >
              <Play className="w-5 h-5 inline mr-2" />
              Ouvir Álbum
            </button>
          )}

        </div>

        <div className="mt-4 text-white/30 text-sm">
          {focusedIndex + 1} de {items.length} álbuns
        </div>
      </div>

      {/* Modal de Detalhes */}
      {showDetails && focusedItem && (
        <div 
          className="fixed inset-0 flex items-center justify-center p-4 bg-black/95"
          onClick={() => setShowDetails(false)}
          style={{ zIndex: 99999 }}
        >
          <div 
            className="w-full max-w-4xl max-h-[90vh] bg-gray-900 rounded-2xl overflow-hidden border border-white/10"
            onClick={e => e.stopPropagation()}
            style={{ zIndex: 100000 }}
          >
            <div className="flex flex-col md:flex-row gap-6 p-6 overflow-y-auto max-h-[90vh]">
              {/* Capa */}
              <div className="w-full md:w-64 h-64 md:h-64 flex-shrink-0">
                <img 
                  src={coverUrls[focusedItem.id] || PLACEHOLDER_SVG} 
                  alt=""
                  className="w-full h-full object-cover rounded-xl shadow-2xl"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-white">{focusedItem.title}</h2>
                    <p className="text-cyan-400 text-lg mt-1">{focusedItem.artist}</p>
                  </div>
                  <div className="flex gap-2">
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteAlbum(focusedItem)}
                        className="p-2 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-400 transition"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => setShowDetails(false)}
                      className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/60 transition"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  {grooveflixData.year && <span className="px-2 py-1 bg-white/10 rounded text-xs text-white/60">{grooveflixData.year}</span>}
                  {grooveflixData.genre && <span className="px-2 py-1 bg-cyan-500/20 rounded text-xs text-cyan-300">{grooveflixData.genre}</span>}
                  {grooveflixData.country && <span className="px-2 py-1 bg-white/10 rounded text-xs text-white/60">{grooveflixData.country}</span>}
                </div>

                {sortedTracklist.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-cyan-400 text-sm font-bold mb-2">{sortedTracklist.length} faixas</h3>
                    <div className="max-h-64 overflow-y-auto space-y-1 pr-2">
                      {sortedTracklist.map((track, i) => (
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
                    onClick={() => { handlePlayAlbum(); setShowDetails(false); }}
                    className="mt-4 flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full font-bold hover:shadow-lg transition"
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
