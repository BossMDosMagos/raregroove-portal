import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Disc, Tag, Heart, Music, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '../contexts/I18nContext.jsx';
import { useCart } from '../contexts/CartContext.jsx';
import { formatRemaining } from '../utils/time.js';

export const ItemCard = ({ item }) => {
  const navigate = useNavigate();
  const { t, formatCurrency } = useI18n();
  const { addToCart } = useCart();
  const [isInWishlist, setIsInWishlist] = useState(() => {
    try {
      const wishlist = JSON.parse(localStorage.getItem('rg_wishlist') || '[]');
      return Array.isArray(wishlist) && wishlist.includes(item.id);
    } catch {
      return false;
    }
  });

  const toggleWishlist = (e) => {
    e.stopPropagation();
    
    const wishlist = JSON.parse(localStorage.getItem('rg_wishlist') || '[]');
    
    if (isInWishlist) {
      const updatedWishlist = wishlist.filter(id => id !== item.id);
      localStorage.setItem('rg_wishlist', JSON.stringify(updatedWishlist));
      setIsInWishlist(false);
      toast.success(t('catalog.actions.removedFromWishlist') || 'Removido da lista de desejos', {
        style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
      });
    } else {
      wishlist.push(item.id);
      localStorage.setItem('rg_wishlist', JSON.stringify(wishlist));
      setIsInWishlist(true);
      toast.success(t('catalog.actions.addedToWishlist') || 'Adicionado à lista de desejos', {
        style: { background: '#050505', border: '1px solid #D4AF37', color: '#FFF' },
      });
    }
  };

  // Formatação segura de preço
  const formattedPrice = formatCurrency ? formatCurrency(item.price) : `R$ ${item.price}`;
  const reservedUntilMs = item?.reserved_until ? new Date(item.reserved_until).getTime() : null;
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    if (!item?.reserved_until) return undefined;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [item?.reserved_until]);

  const reserveRemaining = reservedUntilMs && nowMs ? reservedUntilMs - nowMs : null;
  const reserveText = typeof reserveRemaining === 'number' && reserveRemaining > 0 ? formatRemaining(reserveRemaining) : null;

  return (
    <div 
      onClick={() => navigate(`/item/${item.id}`)}
      className="cursor-pointer group relative glass-card rounded-[2rem] overflow-hidden border border-white/5 hover:border-gold-premium/40 transition-all duration-500 hover:shadow-[0_0_50px_-15px_rgba(212,175,55,0.3)] hover:-translate-y-2"
    >
      
      {/* CD Image Container */}
      <div className="aspect-square w-full relative overflow-hidden bg-charcoal-deep">
        {/* Status Overlays */}
        {item.status === 'reservado' && (
          <div className="absolute inset-0 bg-charcoal-deep/80 backdrop-blur-sm z-20 flex items-center justify-center">
            <div className="border border-warning/50 bg-warning/10 px-6 py-3 rounded-xl rotate-[-5deg] shadow-2xl backdrop-blur-md">
              <p className="text-warning font-black text-sm uppercase tracking-[0.2em] tabular-nums">
                {reserveText ? `RESERVA: ${reserveText}` : (t('chat.activeTransaction') || 'EM NEGOCIAÇÃO')}
              </p>
            </div>
          </div>
        )}
        {item.status === 'vendido' && (
          <div className="absolute inset-0 bg-charcoal-deep/90 backdrop-blur-md z-20 flex items-center justify-center">
            <div className="border border-danger/50 bg-danger/10 px-8 py-4 rounded-xl rotate-[-5deg] shadow-2xl backdrop-blur-md">
              <p className="text-danger font-black text-xl uppercase tracking-[0.3em]">{t('paymentSuccess.sold') || 'VENDIDO'}</p>
            </div>
          </div>
        )}

        {/* Hover Gradient Overlay */}
        <div className={`absolute inset-0 bg-gradient-to-t from-charcoal-deep via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10 pointer-events-none`} />

        {/* Wishlist Button - Top Right */}
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={toggleWishlist}
            className={`p-3 rounded-full backdrop-blur-md border transition-all duration-300 shadow-lg ${
              isInWishlist 
                ? 'bg-gold-premium text-charcoal-deep border-gold-premium' 
                : 'bg-black/30 text-white/70 border-white/10 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Heart size={18} className={isInWishlist ? 'fill-current' : ''} />
          </button>
        </div>

        {/* Condition Badge - Top Left */}
        <div className="absolute top-4 left-4 z-20">
          <div className="flex items-center gap-2">
            <span className={`
              px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest backdrop-blur-md border shadow-lg
              ${item.condition === 'Mint (M)' || item.condition === 'Near Mint (NM)' 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                : 'bg-gold-premium/10 border-gold-premium/30 text-gold-premium'}
            `}>
              {item.condition?.split(' ')[0] || item.condition}
            </span>
            {item.year && (
              <span className="px-2 py-1.5 rounded-lg text-[10px] font-bold bg-black/40 border border-white/10 text-white/60 backdrop-blur-md">
                {item.year}
              </span>
            )}
          </div>
        </div>

        {/* Main Image */}
        {item.image_url ? (
          <img 
            src={item.image_url} 
            alt={item.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-110 group-hover:rotate-1 transition-all duration-700 ease-out"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-charcoal-mid to-charcoal-light flex items-center justify-center text-gold-premium/10 group-hover:text-gold-premium/20 transition-colors">
            <Disc size={80} className="animate-spin-slow" />
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="p-6 relative bg-charcoal-mid/30 backdrop-blur-sm group-hover:bg-charcoal-mid/50 transition-colors duration-500">
        
        {/* Genre Tag if available */}
        {item.genre && (
          <div className="mb-3 flex items-center gap-2">
            <Music size={10} className="text-gold-premium/60" />
            <span className="text-[10px] uppercase tracking-wider text-gold-premium/60 font-medium truncate">
              {item.genre}
            </span>
          </div>
        )}

        <div className="space-y-1.5 mb-6">
          <h3 className="text-white font-black text-lg leading-tight truncate tracking-tight group-hover:text-gold-premium transition-colors duration-300 uppercase">
            {item.title}
          </h3>
          <p className="text-silver-premium/60 text-xs uppercase tracking-[0.15em] font-semibold truncate group-hover:text-white transition-colors duration-300">
            {item.artist}
          </p>
        </div>
        
        <div className="flex items-end justify-between pt-5 border-t border-white/5 group-hover:border-gold-premium/20 transition-colors duration-500">
          <div className="flex flex-col gap-0.5">
            <span className="text-silver-premium/30 text-[9px] uppercase font-black tracking-widest">{t('catalog.card.value')}</span>
            <span className="text-2xl font-black text-white tracking-tighter group-hover:text-gold-premium transition-colors duration-300">
              {formattedPrice}
            </span>
          </div>
          
          <button 
            onClick={async (e) => {
              e.stopPropagation();
              if (item.status === 'reservado' || item.status === 'vendido' || item.is_sold) return;
              await addToCart(item.id);
            }}
            className="p-3 bg-gold-premium text-charcoal-deep rounded-xl opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500 shadow-lg hover:shadow-gold-premium/20 font-bold"
          >
            <Tag size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
