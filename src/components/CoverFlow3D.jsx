import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Disc3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import AlbumFlipCard from './AlbumFlipCard.jsx';
import { LCDDisplay } from './LCDDisplay.jsx';
import ProgressBar from './ProgressBar.jsx';

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

const getItemPosition = (index, focusedIndex) => {
  const diff = index - focusedIndex;
  if (diff === 0) return 'active';
  if (diff === -1) return 'left-1';
  if (diff === -2) return 'left-2';
  if (diff === 1) return 'right-1';
  if (diff === 2) return 'right-2';
  return 'hidden';
};

export default function CoverFlow3D({ items, focusedIndex: externalFocusedIndex, onUpdateFocus, onAlbumSelect, isAdmin, onAlbumDeleted, currentTrack, currentTrackIndex, isPlaying, currentTime, duration, onSeek, playAlbum }) {
  const [internalFocusedIndex, setInternalFocusedIndex] = useState(0);
  const [coverUrls, setCoverUrls] = useState({});
  const blobUrlsRef = useRef(new Set());
  const currentIndexRef = useRef(0);
  
  const focusedIndex = externalFocusedIndex !== undefined ? externalFocusedIndex : internalFocusedIndex;
  
  useEffect(() => {
    const current = externalFocusedIndex !== undefined ? externalFocusedIndex : internalFocusedIndex;
    currentIndexRef.current = current;
  }, [externalFocusedIndex, internalFocusedIndex]);
  
  const setFocusedIndex = useCallback((value) => {
    let newIndex;
    if (typeof value === 'function') {
      newIndex = value(currentIndexRef.current);
    } else {
      newIndex = value;
    }
    
    if (externalFocusedIndex === undefined) {
      setInternalFocusedIndex(newIndex);
    } else {
      currentIndexRef.current = newIndex;
    }
    
    if (onUpdateFocus && items[newIndex]) {
      onUpdateFocus(items[newIndex], newIndex);
    }
  }, [externalFocusedIndex, onUpdateFocus, items]);
  
  const containerRef = useRef(null);

  const focusedItem = items[focusedIndex];
  const grooveflixData = focusedItem?.metadata?.grooveflix || {};
  const rawTracklist = useMemo(() => {
    const list = grooveflixData.tracklist || [];
    return Array.isArray(list) ? list : [];
  }, [grooveflixData.tracklist]);
  const audioFiles = useMemo(() => {
    const files = grooveflixData.audio_files || [];
    return Array.isArray(files) ? files : [];
  }, [grooveflixData.audio_files]);

  const sortedTracklist = useMemo(() => {
    return [...rawTracklist].sort((a, b) => {
      const trackA = a.trackNumber || parseInt(a.position?.split('-')[1]) || 0;
      const trackB = b.trackNumber || parseInt(b.position?.split('-')[1]) || 0;
      return trackA - trackB;
    });
  }, [rawTracklist]);

  const visibleItems = useMemo(() => {
    return items.map((item, index) => ({
      index,
      item,
      position: getItemPosition(index, focusedIndex)
    })).filter(i => i.position !== 'hidden');
  }, [items, focusedIndex]);

  useEffect(() => {
    if (focusedItem && onUpdateFocus) {
      onUpdateFocus(focusedItem);
    }
  }, [focusedIndex, focusedItem, onUpdateFocus]);

  useEffect(() => {
    if (items.length === 0) return;

    const loadCover = async (item) => {
      if (coverUrls[item.id]) return;
      const discogsCover = item.metadata?.grooveflix?.coverUrl;
      if (discogsCover) {
        const blobUrl = await fetchProxiedImage(discogsCover);
        if (blobUrl !== PLACEHOLDER_SVG) {
          blobUrlsRef.current.add(blobUrl);
        }
        setCoverUrls(prev => ({ ...prev, [item.id]: blobUrl }));
      } else {
        setCoverUrls(prev => ({ ...prev, [item.id]: PLACEHOLDER_SVG }));
      }
    };

    items.slice(0, 11).forEach(loadCover);
  }, [items.length, items]);

  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      blobUrlsRef.current.clear();
    };
  }, []);

  const handlePrevAlbum = useCallback(() => {
    setFocusedIndex(prev => Math.max(0, prev - 1));
  }, [setFocusedIndex]);

  const handleNextAlbum = useCallback(() => {
    setFocusedIndex(prev => Math.min(items.length - 1, prev + 1));
  }, [setFocusedIndex, items.length]);

  const handlePlayTrack = useCallback((album, trackIndex) => {
    if (playAlbum) {
      playAlbum(album, trackIndex);
    }
  }, [playAlbum]);

  const isCurrentAlbum = currentTrack?.albumId === focusedItem?.id;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Disc3 className="w-20 h-20 text-white/20 mb-4" />
        <p className="text-xl font-bold text-white/60">Nenhum álbum encontrado</p>
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ background: '#000000', minHeight: '480px' }}>
      <style>{`
        .coverflow-scene { perspective: 1200px; perspective-origin: 50% 50%; }
        .album-cover { 
          transform-style: preserve-3d; 
          transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.6s ease; 
          -webkit-transform-style: preserve-3d; 
          -webkit-transition: -webkit-transform 0.6s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.6s ease;
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
          box-shadow: 0 30px 60px rgba(0,0,0,0.9), 0 0 30px rgba(212,175,55,0.3), 0 0 60px rgba(212,175,55,0.15); 
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
        .neon-glow-gold { box-shadow: 0 0 25px rgba(212,175,55,0.4), 0 0 50px rgba(212,175,55,0.15); }
        .neon-glow-gold-btn { box-shadow: 0 0 20px rgba(212,175,55,0.3), 0 0 40px rgba(212,175,55,0.1); }
        @keyframes golden-pulse { 0%, 100% { opacity: 0.8; } 50% { opacity: 1; } }
        @media (max-width: 768px) {
          .coverflow-scene { perspective: 800px; }
          .album-image { width: 180px; height: 180px; }
          .album-cover.active { transform: rotateY(0deg) translateZ(150px) scale(1); }
          .album-cover.left-1 { transform: rotateY(50deg) translateX(-120px) translateZ(-80px) scale(0.85); }
          .album-cover.right-1 { transform: rotateY(-50deg) translateX(120px) translateZ(-80px) scale(0.85); }
          .album-cover.left-2, .album-cover.right-2 { opacity: 0; }
        }
      `}</style>

      <div ref={containerRef} className="relative flex items-center justify-center coverflow-scene" style={{ height: '420px', overflow: 'hidden' }}>
        <div className="glass-floor" />

        {visibleItems.map(({ index, item, position }) => {
          const coverUrl = coverUrls[item.id] || PLACEHOLDER_SVG;
          
          if (position === 'active') {
            const activeCoverUrl = coverUrls[item.id] || PLACEHOLDER_SVG;
            return (
              <div
                key={item.id}
                className="album-cover active"
                style={{ 
                  left: '50%', 
                  marginLeft: '-140px', 
                  top: '50%',
                  marginTop: '-140px'
                }}
              >
                <AlbumFlipCard
                  album={item}
                  coverUrl={activeCoverUrl}
                  isActive={isCurrentAlbum}
                  isPlaying={isPlaying}
                  currentTrack={currentTrack}
                  currentTrackIndex={currentTrackIndex}
                  onPlayTrack={handlePlayTrack}
                  style={{ width: '280px', height: '280px' }}
                  showFlipHint={true}
                />
              </div>
            );
          }
          
          return (
            <div
              key={item.id}
              className={`album-cover ${position}`}
              onClick={() => setFocusedIndex(index)}
              style={{ left: '50%', marginLeft: '-140px', top: '50%', marginTop: '-140px' }}
            >
              <img src={coverUrl} alt={item.title} className="album-image" draggable={false} />
              <div className="reflection">
                <img src={coverUrl} alt="" className="album-image" style={{ borderRadius: '12px', filter: 'blur(2px)', opacity: 0.2 }} draggable={false} />
              </div>
            </div>
          );
        })}

        <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
          <button onClick={handlePrevAlbum} disabled={focusedIndex === 0} className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-sm border-2 border-white/20 flex items-center justify-center text-white hover:bg-black/80 hover:border-amber-400/50 transition-all disabled:opacity-20 pointer-events-auto neon-glow-gold-btn" style={{ boxShadow: '0 0 30px rgba(212,175,55,0.2)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button onClick={handleNextAlbum} disabled={focusedIndex === items.length - 1} className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-sm border-2 border-white/20 flex items-center justify-center text-white hover:bg-black/80 hover:border-amber-400/50 transition-all disabled:opacity-20 pointer-events-auto neon-glow-gold-btn" style={{ boxShadow: '0 0 30px rgba(212,175,55,0.2)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {items.slice(0, 15).map((_, i) => (
            <button key={i} onClick={() => setFocusedIndex(i)} className={`h-1 rounded-full transition-all ${i === focusedIndex ? 'w-8 bg-white' : 'w-2 bg-white/30 hover:bg-white/50'}`} />
          ))}
          {items.length > 15 && <span className="text-white/40 text-xs self-center ml-1">+{items.length - 15}</span>}
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 py-4 px-4">
        <LCDDisplay
          line1={focusedItem?.title}
          line2={focusedItem?.artist}
          line3={currentTrack?.title || currentTrack?.name || focusedItem?.title || ''}
          line4=""
          isPlaying={isPlaying}
        />
        
        <div style={{ position: 'relative', zIndex: 20 }}>
          <ProgressBar
            currentTime={currentTime || 0}
            duration={duration || 0}
            onSeek={onSeek}
            isPlaying={isPlaying}
          />
        </div>
        
        <div className="flex items-center justify-center gap-3 mt-2">
          {grooveflixData.year && <span className="px-3 py-1 bg-white/10 rounded-full text-white/60 text-sm">{grooveflixData.year}</span>}
          {grooveflixData.genre && <span className="px-3 py-1 bg-cyan-500/20 border border-cyan-500/40 rounded-full text-cyan-300 text-sm">{grooveflixData.genre}</span>}
        </div>

        <div className="mt-4 text-amber-500/60 text-sm">{focusedIndex + 1} de {items.length} álbuns</div>
      </div>
    </div>
  );
}
