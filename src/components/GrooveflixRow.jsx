import React, { useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode, Navigation } from 'swiper/modules';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import 'swiper/css';
import 'swiper/css/navigation';

export default function GrooveflixRow({ title, items, onPick, onDelete, canDelete }) {
  const list = items || [];
  const [menuId, setMenuId] = useState(null);

  if (list.length === 0) return null;

  const handleDeleteClick = (e, item) => {
    e.stopPropagation();
    if (window.confirm(`Excluir "${item.title}" do Grooveflix?`)) {
      onDelete?.(item.id);
      setMenuId(null);
    }
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
        {list.map((it) => (
          <SwiperSlide key={it.id}>
            <div className="relative w-full text-left group">
              {canDelete && (
                <div className="absolute top-2 right-2 z-10">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setMenuId(menuId === it.id ? null : it.id); }}
                    className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:border-white/40 transition opacity-0 group-hover:opacity-100"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  {menuId === it.id && (
                    <div className="absolute top-full right-0 mt-1 bg-charcoal-deep border border-white/10 rounded-xl overflow-hidden shadow-2xl">
                      <button
                        type="button"
                        onClick={(e) => handleDeleteClick(e, it)}
                        className="flex items-center gap-2 px-4 py-2.5 text-red-400 hover:bg-red-500/10 transition w-full"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="text-xs font-medium">Excluir</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => onPick?.(it)}
                className="w-full"
              >
                <div className="relative aspect-[1/1] rounded-2xl overflow-hidden border border-white/10 bg-white/5 transition-transform duration-300 group-hover:scale-[1.06] group-hover:border-fuchsia-500/40">
                  {it.coverUrl ? (
                    <img src={it.coverUrl} alt={it.title || 'cover'} className="w-full h-full object-cover" />
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
        ))}
      </Swiper>
    </section>
  );
}

