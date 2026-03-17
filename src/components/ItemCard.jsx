import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Disc, Play, Pause, Heart, Music, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '../contexts/I18nContext.jsx';

const DiscPlaceholder = () => (
  <div className="w-full h-full bg-gradient-to-br from-charcoal-mid via-charcoal-light to-charcoal-deep flex flex-col items-center justify-center p-6 text-center">
    <div className="relative mb-4">
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gold-premium/20 to-transparent border-2 border-gold-premium/20 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full bg-charcoal-deep border border-gold-premium/30" />
      </div>
      <div className="absolute inset-0 rounded-full bg-gold-premium/5 animate-pulse" />
    </div>
    <Disc size={48} className="text-gold-premium/20 mb-3" />
    <p className="text-gold-premium/40 text-[10px] uppercase tracking-[0.2em] font-bold">RareGroove</p>
  </div>
);

const formatDuration = (seconds) => {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const ItemCard = ({ item, onPlay }) => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const coverUrl = item.cover_url || item.image_url;
  const showPlaceholder = !coverUrl || imageError;

  const handlePlay = (e) => {
    e.stopPropagation();
    if (onPlay) {
      setIsPlaying(true);
      onPlay(item);
    } else {
      navigate(`/play/${item.id}`);
    }
  };

  return (
    <div 
      onClick={() => navigate(`/item/${item.id}`)}
      className="cursor-pointer group relative rounded-2xl overflow-hidden bg-charcoal-deep/50 border border-white/5 hover:border-gold-premium/40 transition-all duration-500 hover:shadow-[0_0_40px_-10px_rgba(212,175,55,0.3)] hover:-translate-y-1"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Cover Image Container */}
      <div className="aspect-square w-full relative overflow-hidden bg-charcoal-deep">
        {/* Hover Overlay with Play Button */}
        <div className={`absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex items-center justify-center transition-all duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
          <button
            onClick={handlePlay}
            className="w-16 h-16 rounded-full bg-gold-premium flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-300"
          >
            <Play size={28} className="text-charcoal-deep ml-1" fill="currentColor" />
          </button>
        </div>

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal-deep via-transparent to-transparent z-5 pointer-events-none" />

        {/* Genre Badge */}
        {item.genre && (
          <div className="absolute top-3 left-3 z-10">
            <span className="px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider bg-gold-premium/20 border border-gold-premium/30 text-gold-premium backdrop-blur-md">
              {item.genre}
            </span>
          </div>
        )}

        {/* Main Image */}
        {showPlaceholder ? (
          <DiscPlaceholder />
        ) : (
          <img 
            src={coverUrl} 
            alt={item.title}
            loading="lazy"
            onError={() => setImageError(true)}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        )}
      </div>

      {/* Info Area */}
      <div className="p-4 relative">
        <div className="space-y-1">
          <h3 className="text-white font-bold text-sm truncate group-hover:text-gold-premium transition-colors duration-300">
            {item.title}
          </h3>
          <p className="text-white/50 text-xs truncate group-hover:text-white/70 transition-colors duration-300">
            {item.artist || 'Artista desconhecido'}
          </p>
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
          <div className="flex items-center gap-2 text-white/30 text-[10px]">
            {item.year && (
              <span className="flex items-center gap-1">
                <Clock size={10} />
                {item.year}
              </span>
            )}
            {item.duration_seconds && (
              <span className="flex items-center gap-1">
                <Music size={10} />
                {formatDuration(item.duration_seconds)}
              </span>
            )}
          </div>

          {/* Play indicator */}
          <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${isPlaying ? 'bg-gold-premium text-charcoal-deep' : 'bg-white/10 text-white/30 group-hover:bg-gold-premium/20 group-hover:text-gold-premium'}`}>
            {isPlaying ? (
              <Pause size={12} fill="currentColor" />
            ) : (
              <Play size={10} fill="currentColor" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
