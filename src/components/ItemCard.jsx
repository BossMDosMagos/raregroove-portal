import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Disc, Music, Clock, Tag, ArrowLeftRight, ShieldCheck, Lock } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext.jsx';
import { supabase } from '../lib/supabase';
import { formatRemaining } from '../utils/time.js';
import BarcodeTag from './BarcodeTag.jsx';

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

const formatPrice = (price) => {
  if (!price || price === 0) return 'Sob consulta';
  return `R$ ${Number(price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getConditionColor = (condition) => {
  const c = (condition || '').toUpperCase();
  if (c === 'MINT' || c === 'NM') return 'text-emerald-400';
  if (c === 'VG+' || c === 'VG') return 'text-yellow-400';
  if (c === 'G') return 'text-orange-400';
  if (c === 'F') return 'text-red-400';
  return 'text-orange-400';
};

export const ItemCard = ({ item, onPlay }) => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [imageError, setImageError] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data?.user?.id || null));
    const id = setInterval(() => setTick(v => v + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Reserva ativa: status 'reservado' com prazo ainda vigente.
  const reservedUntilMs = item?.reserved_until ? new Date(item.reserved_until).getTime() : null;
  const reserveActive = Boolean(item?.status === 'reservado' && reservedUntilMs && reservedUntilMs > Date.now());

  let localCart = null;
  try { localCart = JSON.parse(localStorage.getItem('rg_cart_v2') || 'null'); } catch { localCart = null; }
  const localReserveForThis = Boolean(
    Array.isArray(localCart) && localCart.some(c => c.itemId === item?.id && Number(c.reservedUntilMs || 0) > Date.now())
  );
  const reservedByMe = Boolean(reserveActive && currentUserId && item?.reserved_by === currentUserId);
  // Carimbo aparece para todos exceto quem fez a reserva (que já sabe que é sua).
  const showReservedStamp = Boolean(reserveActive && !reservedByMe && !localReserveForThis);
  const reserveRemaining = showReservedStamp ? formatRemaining(reservedUntilMs - Date.now()) : null;

  const coverUrl = item.cover_url || item.image_url;
  const showPlaceholder = !coverUrl || imageError;

  return (
    <div 
      onClick={() => navigate(`/item/${item.id}`)}
      className="cursor-pointer group relative rounded-2xl overflow-hidden bg-charcoal-deep/50 border border-white/5 hover:border-gold-premium/40 transition-all duration-500 hover:shadow-[0_0_40px_-10px_rgba(212,175,55,0.3)]"
    >
      {/* Cover Image Container - 50% larger */}
      <div className="aspect-square w-full relative overflow-hidden bg-charcoal-deep">
        {/* Always Visible Overlay with Item Details */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent z-10 flex flex-col justify-end p-4">
          {/* Availability Badges */}
          <div className="flex flex-wrap gap-2 mb-2">
            {item.allow_sale && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/25 border border-emerald-500/50 text-emerald-300">
                <Tag size={9} /> Venda
              </span>
            )}
            {item.allow_swap && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-500/25 border border-blue-500/50 text-blue-300">
                <ArrowLeftRight size={9} /> Troca
              </span>
            )}
          </div>

          {/* Price */}
          <p className="text-gold-premium font-black text-xl leading-tight mb-1">
            {formatPrice(item.price)}
          </p>

          {/* Condition */}
          {item.condition && (
            <div className="flex items-center gap-1">
              <ShieldCheck size={11} className={getConditionColor(item.condition)} />
              <span className={`text-[10px] font-bold uppercase tracking-wider ${getConditionColor(item.condition)}`}>
                {item.condition}
              </span>
            </div>
          )}
        </div>

        {/* Genre Badge */}
        {item.genre && (
          <div className="absolute top-3 left-3 z-20">
            <span className="px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider bg-gold-premium/20 border border-gold-premium/30 text-gold-premium backdrop-blur-md">
              {item.genre}
            </span>
          </div>
        )}

        {/* Badge de DVD Musical */}
        {String(item?.metadata?.mediaType || '').toUpperCase() === 'DVD' && (
          <div className="absolute top-12 left-3 z-20">
            <span className="px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider bg-sky-500/20 border border-sky-400/40 text-sky-300 backdrop-blur-md">
              DVD Musical
            </span>
          </div>
        )}

        {/* Barcode Diamond Badge */}
        {(item.barcode || item.metadata?.grooveflix?.barcode) && (
          <div className="absolute top-3 right-3 z-20">
            <BarcodeTag barcode={item.barcode || item.metadata?.grooveflix?.barcode} size="sm" />
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
            className="w-full h-full object-cover"
          />
        )}

        {/* Selo LACRADO dourado com glow pulsante */}
        {Boolean(item?.metadata?.sealed) && (
          <div className="absolute bottom-3 right-3 z-20 animate-sealed-glow rounded-full">
            <div className="w-[68px] h-[68px] rounded-full flex flex-col items-center justify-center bg-gradient-to-br from-gold-light via-gold-premium to-gold-dark border-2 border-gold-light/80 text-charcoal-deep">
              <Lock size={13} strokeWidth={3} />
              <span className="mt-0.5 text-[8px] font-black uppercase leading-none tracking-[0.08em]">
                Lacrado
              </span>
            </div>
          </div>
        )}

        {/* Selo redondo de reserva (visível já no catálogo) */}
        {showReservedStamp && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none overflow-hidden">
            <div className="absolute inset-0 bg-amber-950/25" />
            <div
              className="relative w-28 h-28 rounded-full flex flex-col items-center justify-center rotate-[-14deg] bg-red-950/80 border-[3px] border-red-500/90 shadow-[0_0_28px_rgba(239,68,68,0.45)]"
              style={{ transform: 'rotate(-14deg)' }}
            >
              {/* anel interno do lacre */}
              <div className="absolute inset-[6px] rounded-full border border-dashed border-red-400/60" />
              <span className="relative text-red-200 font-black text-[15px] uppercase tracking-[0.12em] leading-none drop-shadow-lg">
                Reservado
              </span>
              <span className="relative mt-1 text-red-300/80 font-bold text-[10px] uppercase tracking-widest tabular-nums">
                {reserveRemaining}
              </span>
            </div>
          </div>
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

          {/* Condition Badge (always visible) */}
          {item.condition && (
            <span className={`text-[9px] font-bold uppercase tracking-wider ${getConditionColor(item.condition)}`}>
              {item.condition}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
