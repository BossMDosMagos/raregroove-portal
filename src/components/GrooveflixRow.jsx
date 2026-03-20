import React, { useState, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode, Navigation } from 'swiper/modules';
import { Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import 'swiper/css';
import 'swiper/css/navigation';

export default function GrooveflixRow({ title, items, onPick, onDelete, canDelete }) {
  const list = items || [];
  const [coverUrls, setCoverUrls] = useState({});

  useEffect(() => {
    const loadCoverUrls = async () => {
      const itemsNeedingUrl = list.filter(it => it.coverPath && !it.coverUrl);
      if (itemsNeedingUrl.length === 0) return;

      const newUrls = {};
      for (const it of itemsNeedingUrl) {
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hlfirfukbrisfpebaaur.supabase.co';
          const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
          const session = (await supabase.auth.getSession()).data.session;
          const token = session?.access_token || supabaseAnonKey;
          
          const response = await fetch(`${supabaseUrl}/functions/v1/b2-presign`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'apikey': supabaseAnonKey
            },
            body: JSON.stringify({ file_path: it.coverPath, mode: 'download' })
          });
          
          const data = await response.json();
          if (data?.url) {
            newUrls[it.id] = data.url;
          }
        } catch (e) {
          console.error('Error loading cover URL:', e);
        }
      }
      
      if (Object.keys(newUrls).length > 0) {
        setCoverUrls(prev => ({ ...prev, ...newUrls }));
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
    return it.coverUrl || coverUrls[it.id] || null;
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
                    {coverUrl ? (
                      <img src={coverUrl} alt={it.title || 'cover'} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-fuchsia-500/30 via-purple-500/10 to-black" />
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
