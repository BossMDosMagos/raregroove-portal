import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode, Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';

export default function GrooveflixRow({ title, items, onPick }) {
  const list = items || [];
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
        breakpoints={{
          640: { slidesPerView: 3.2 },
          768: { slidesPerView: 4.2 },
          1024: { slidesPerView: 5.6 },
          1280: { slidesPerView: 6.6 },
        }}
      >
        {list.map((it) => (
          <SwiperSlide key={it.id}>
            <button
              type="button"
              onClick={() => onPick?.(it)}
              className="w-full text-left group"
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
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}

