import React from 'react';
import { Star } from 'lucide-react';

// Componente de exibição de Rating (estrelas)
export const RatingDisplay = ({ rating, totalReviews, size = 'md', showCount = true }) => {
  const numRating = parseFloat(rating) || 0;
  const fullStars = Math.floor(numRating);
  const hasHalfStar = numRating % 1 >= 0.5;
  
  const sizes = {
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24
  };
  
  const starSize = sizes[size] || sizes.md;
  
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={starSize}
            className={`${
              star <= fullStars
                ? 'fill-[#D4AF37] text-[#D4AF37]'
                : star === fullStars + 1 && hasHalfStar
                ? 'fill-[#D4AF37]/50 text-[#D4AF37]'
                : 'text-white/20'
            }`}
          />
        ))}
      </div>
      {showCount && totalReviews > 0 && (
        <span className="text-white/40 text-xs font-medium">
          {numRating.toFixed(1)} ({totalReviews})
        </span>
      )}
      {totalReviews === 0 && showCount && (
        <span className="text-white/20 text-xs">Sem avaliações</span>
      )}
    </div>
  );
};

// Badge de Elite Seller
export const EliteBadge = ({ isElite, avgRating, completedSales, size = 'md' }) => {
  if (!isElite) return null;
  
  const sizes = {
    sm: 'text-[8px] px-1.5 py-0.5',
    md: 'text-[9px] px-2 py-1',
    lg: 'text-[10px] px-3 py-1.5'
  };
  
  return (
    <div 
      className={`inline-flex items-center gap-1.5 bg-gradient-to-r from-[#FFD700] via-[#D4AF37] to-[#B8860B] 
                  text-black font-black uppercase tracking-wider rounded-full ${sizes[size]}`}
      title={`Vendedor Elite: ${completedSales} vendas, ${avgRating} estrelas`}
    >
      <span>⭐</span>
      <span>Elite</span>
    </div>
  );
};

// Card de Review Individual
export const ReviewCard = ({ review, compact = false }) => {
  const formattedDate = new Date(review.created_at).toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  
  if (compact) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <div className="flex items-start justify-between mb-2">
          <RatingDisplay rating={review.rating} showCount={false} size="sm" />
          <span className="text-white/30 text-[10px] uppercase">{formattedDate}</span>
        </div>
        {review.comment && (
          <p className="text-white/60 text-sm line-clamp-3">{review.comment}</p>
        )}
      </div>
    );
  }
  
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {review.reviewer_profile?.avatar_url ? (
            <img 
              src={review.reviewer_profile.avatar_url} 
              alt={review.reviewer_profile.full_name}
              className="w-10 h-10 rounded-full object-cover border-2 border-[#D4AF37]/30"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
              <span className="text-[#D4AF37] font-black text-sm">
                {review.reviewer_profile?.full_name?.charAt(0) || '?'}
              </span>
            </div>
          )}
          <div>
            <p className="text-white font-bold text-sm">
              {review.reviewer_profile?.full_name || 'Colecionador'}
            </p>
            <p className="text-white/30 text-xs">{formattedDate}</p>
          </div>
        </div>
        <RatingDisplay rating={review.rating} showCount={false} size="md" />
      </div>
      {review.comment && (
        <p className="text-white/70 text-sm leading-relaxed">{review.comment}</p>
      )}
    </div>
  );
};

// Componente de Estatísticas de Rating
export const RatingStats = ({ stats }) => {
  if (!stats || stats.total_reviews === 0) {
    return (
      <div className="text-center py-8 text-white/20">
        <Star size={32} className="mx-auto mb-2 opacity-20" />
        <p className="text-sm uppercase tracking-wider">Nenhuma avaliação ainda</p>
      </div>
    );
  }
  
  const percentage = (count) => {
    return ((count / stats.total_reviews) * 100).toFixed(0);
  };
  
  return (
    <div className="space-y-3">
      {[5, 4, 3, 2, 1].map((star) => {
        const count = stats[`rating_${star}_count`] || 0;
        const pct = percentage(count);
        
        return (
          <div key={star} className="flex items-center gap-3">
            <div className="flex items-center gap-1 w-16">
              <span className="text-white/60 text-sm font-bold">{star}</span>
              <Star size={14} className="text-[#D4AF37]" />
            </div>
            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#D4AF37] transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-white/40 text-xs w-12 text-right">
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
};
