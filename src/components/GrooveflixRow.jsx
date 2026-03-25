import React, { useState, useEffect, useRef, memo, useMemo } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode, Navigation } from 'swiper/modules';
import { Trash2 } from 'lucide-react';
import 'swiper/css';
import 'swiper/css/navigation';
import { supabase } from '../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://hlfirfukbrisfpebaaur.supabase.co';

const getImageProxyUrl = (url) => {
  if (!url) return null;
  if (url.includes('discogs.com') || url.includes('i.discogs.com')) {
    return `${SUPABASE_URL}/functions/v1/discogs-search/image-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
};

const GrooveflixCard = memo(function GrooveflixCard({ item, onPick, onDelete, canDelete, coverUrl, loading, failed }) {
  const handleDelete = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (window.confirm(`Excluir "${item.title}" do Grooveflix?`)) {
      onDelete?.(item.id);
    }
  };

  return (
    <div className="relative w-full h-full">
      {canDelete && (
        <button
          type="button"
          onClick={handleDelete}
          className="absolute top-2 right-2 z-20 w-8 h-8 rounded-full bg-red-500/90 backdrop-blur-sm border border-red-400/50 flex items-center justify-center text-white hover:bg-red-600 transition shadow-lg"
          title="Excluir"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
      <button
        type="button"
        onClick={() => onPick?.(item)}
        className="w-full h-full block"
      >
        <div className="relative w-full h-full min-h-[180px] max-h-[200px] aspect-square rounded-2xl overflow-hidden border border-white/10 bg-white/5 transition-transform duration-300 group-hover:scale-[1.03] group-hover:border-fuchsia-500/40">
          {loading ? (
            <div className="w-full h-full bg-gradient-to-br from-fuchsia-500/20 via-purple-500/10 to-black animate-pulse">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-fuchsia-500/30 border-t-fuchsia-500 rounded-full animate-spin" />
              </div>
            </div>
          ) : coverUrl && !failed ? (
            <img 
              src={getImageProxyUrl(coverUrl)} 
              alt={item.title || 'cover'} 
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-fuchsia-500/30 via-purple-500/10 to-black flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                <span className="text-white/40 text-xl font-bold">
                  {(item.title || '?').charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="text-white font-black uppercase tracking-wider text-[10px] truncate">
              {item.title}
            </div>
            <div className="text-white/60 text-[10px] truncate">
              {item.artist || 'RareGroove'}
            </div>
          </div>
        </div>
      </button>
    </div>
  );
});

function GrooveflixRow({ title, items, onPick, onDelete, canDelete }) {
  const list = useMemo(() => items || [], [items]);
  const [coverUrls, setCoverUrls] = useState({});
  const [loadingCovers, setLoadingCovers] = useState(new Set());
  const [failedCovers, setFailedCovers] = useState(new Set());
  const processedRef = useRef(new Set());

  useEffect(() => {
    const itemsNeedingUrl = list.filter(it => 
      it.coverPath && 
      !it.coverUrl && 
      !coverUrls[it.id] &&
      !processedRef.current.has(it.id)
    );
    
    if (itemsNeedingUrl.length === 0) return;

    itemsNeedingUrl.forEach(it => processedRef.current.add(it.id));
    setLoadingCovers(prev => new Set([...prev, ...itemsNeedingUrl.map(it => it.id)]));

    const loadCovers = async () => {
      for (const it of itemsNeedingUrl) {
        try {
          const { data } = await supabase.functions.invoke('b2-presign', {
            body: { file_path: it.coverPath, type: 'cover' },
          });
          
          if (data?.url) {
            setCoverUrls(prev => ({ ...prev, [it.id]: data.url }));
          }
        } catch {
          // Silent fail
        } finally {
          setLoadingCovers(prev => {
            const next = new Set(prev);
            next.delete(it.id);
            return next;
          });
        }
      }
    };

    loadCovers();
  }, [list]);

  const getCoverUrl = (it) => {
    if (it.localCoverUrl) return it.localCoverUrl;
    if (it.coverUrl) return it.coverUrl;
    return coverUrls[it.id] || null;
  };

  const getLoadingState = (it) => {
    return !it.localCoverUrl && !it.coverUrl && !coverUrls[it.id] && it.coverPath && loadingCovers.has(it.id);
  };

  if (list.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-white font-black uppercase tracking-[0.22em] text-xs md:text-sm">
        {title}
      </h3>
      <Swiper
        modules={[FreeMode, Navigation]}
        freeMode
        navigation
        spaceBetween={14}
        slidesPerView={2.2}
        style={{ 
          width: '100%',
          height: '220px',
        }}
        wrapperStyle={{
          height: '200px',
        }}
        breakpoints={{
          480: { slidesPerView: 2.5, height: '220px' },
          640: { slidesPerView: 3.2, height: '230px' },
          768: { slidesPerView: 4.2, height: '240px' },
          1024: { slidesPerView: 5.6, height: '250px' },
          1280: { slidesPerView: 6.6, height: '260px' },
        }}
      >
        {list.map((it) => (
          <SwiperSlide key={it.id} style={{ height: '200px', width: '180px' }}>
            <GrooveflixCard
              item={it}
              onPick={onPick}
              onDelete={onDelete}
              canDelete={canDelete}
              coverUrl={getCoverUrl(it)}
              loading={getLoadingState(it)}
              failed={failedCovers.has(it.id)}
            />
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}

export default memo(GrooveflixRow);
