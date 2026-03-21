import React, { useState, useEffect, useRef } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode, Navigation } from 'swiper/modules';
import { Trash2 } from 'lucide-react';
import 'swiper/css';
import 'swiper/css/navigation';
import { supabase } from '../lib/supabase';

export default function GrooveflixRow({ title, items, onPick, onDelete, canDelete }) {
  const list = items || [];
  const [coverUrls, setCoverUrls] = useState({});
  const [loadingCovers, setLoadingCovers] = useState(new Set());
  const [failedCovers, setFailedCovers] = useState(new Set());

  useEffect(() => {
    const loadCoverUrls = async () => {
      const itemsNeedingUrl = list.filter(it => it.coverPath && !it.coverUrl && !coverUrls[it.id]);
      if (itemsNeedingUrl.length === 0) return;

      setLoadingCovers(prev => new Set([...prev, ...itemsNeedingUrl.map(it => it.id)]));

      for (const it of itemsNeedingUrl) {
        try {
          const session = await supabase.auth.getSession();
          console.log('[COVER] Session check:', { 
            hasSession: !!session?.data?.session, 
            hasToken: !!session?.data?.session?.access_token,
            tokenPrefix: session?.data?.session?.access_token?.substring(0, 20)
          });
          
          const { data, error } = await supabase.functions.invoke('b2-presign', {
            body: { file_path: it.coverPath, type: 'cover' },
            headers: {
              'Authorization': 'Bearer ' + (session?.data?.session?.access_token || ''),
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
            }
          });
          
          console.log('[COVER] Result:', error ? error.message : 'OK', 'for:', it.id, 'data:', data);
          
          if (data?.url) {
            setCoverUrls(prev => ({ ...prev, [it.id]: data.url }));
          } else {
            console.warn('[COVER] No URL returned:', data, error);
          }
        } catch (e) {
          console.error('[COVER] Error:', it.id, e.message);
        } finally {
          setLoadingCovers(prev => {
            const next = new Set(prev);
            next.delete(it.id);
            return next;
          });
        }
      }
    };

    loadCoverUrls();
  }, [list]);

  if (list.length === 0) return null;

  const handleDelete = (item) => {
    if (window.confirm(`Excluir "${item.title}" do Grooveflix?`)) {
      onDelete?.(item.id);
    }
  };

  const getCoverUrl = (it) => {
    if (it.localCoverUrl) return it.localCoverUrl;
    if (it.coverUrl) return it.coverUrl;
    if (coverUrls[it.id]) return coverUrls[it.id];
    return null;
  };

  const isLoading = (it) => {
    if (it.localCoverUrl || it.coverUrl || coverUrls[it.id]) return false;
    if (it.coverPath) return loadingCovers.has(it.id);
    return false;
  };

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
        breakpoints={{
          640: { slidesPerView: 3.2 },
          768: { slidesPerView: 4.2 },
          1024: { slidesPerView: 5.6 },
          1280: { slidesPerView: 6.6 },
        }}
      >
        {list.map((it) => {
          const coverUrl = getCoverUrl(it);
          const loading = isLoading(it);
          return (
            <SwiperSlide key={it.id}>
              <div className="relative w-full text-left group">
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDelete(it)}
                    className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-red-500/80 backdrop-blur-sm border border-red-400/30 flex items-center justify-center text-white hover:bg-red-500 transition opacity-0 group-hover:opacity-100 shadow-lg"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onPick?.(it)}
                  className="w-full"
                >
                  <div className="relative aspect-[1/1] rounded-2xl overflow-hidden border border-white/10 bg-white/5 transition-transform duration-300 group-hover:scale-[1.06] group-hover:border-fuchsia-500/40">
                    {loading ? (
                      <div className="w-full h-full bg-gradient-to-br from-fuchsia-500/20 via-purple-500/10 to-black animate-pulse">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-8 h-8 border-2 border-fuchsia-500/30 border-t-fuchsia-500 rounded-full animate-spin" />
                        </div>
                      </div>
                    ) : coverUrl && !failedCovers.has(it.id) ? (
                      <img 
                        src={coverUrl} 
                        alt={it.title || 'cover'} 
                        className="w-full h-full object-cover"
                        onError={() => {
                          console.warn(`[COVER] 404 for item ${it.id}, showing placeholder`);
                          setFailedCovers(prev => new Set([...prev, it.id]));
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-fuchsia-500/30 via-purple-500/10 to-black">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                            <span className="text-white/40 text-lg font-bold">
                              {(it.title || '?').charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="text-white font-black uppercase tracking-wider text-[10px] truncate">
                        {it.title}
                      </div>
                      <div className="text-white/60 text-[10px] truncate">
                        {it.artist || 'RareGroove'}
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </section>
  );
}
