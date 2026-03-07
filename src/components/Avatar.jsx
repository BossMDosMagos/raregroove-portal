import React from 'react';
import { User } from 'lucide-react';

/**
 * Componente Avatar Reutilizável - RAREGROOVE
 * 
 * @param {string} src - URL completa do avatar
 * @param {string} name - Nome do usuário (para fallback com inicial)
 * @param {string} size - 'xs' | 'sm' | 'md' | 'lg' | 'xl'
 * @param {boolean} goldBorder - Se true, adiciona borda dourada
 * @param {boolean} showEliteBadge - Se true e isElite for true, mostra badge Elite
 * @param {boolean} isElite - Se o usuário é Elite Seller
 * @param {string} className - Classes CSS adicionais
 */
export default function Avatar({ 
  src, 
  name = '', 
  size = 'md', 
  goldBorder = true,
  showEliteBadge = false,
  isElite = false,
  className = '' 
}) {
  const sizeClasses = {
    xs: 'w-6 h-6 text-[8px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-24 h-24 text-2xl',
    '2xl': 'w-32 h-32 text-3xl'
  };

  const iconSizes = {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 24,
    xl: 32,
    '2xl': 40
  };

  const borderClass = goldBorder 
    ? 'ring-2 ring-[#D4AF37]/60' 
    : '';

  // Pegar a primeira letra do nome
  const initial = name ? name.charAt(0).toUpperCase() : '?';

  return (
    <div className="relative inline-block">
      <div 
        className={`
          ${sizeClasses[size]} 
          ${borderClass}
          rounded-full 
          bg-gradient-to-br from-[#D4AF37]/20 to-black/80
          flex items-center justify-center
          overflow-hidden
          shrink-0
          ${className}
        `}
      >
        {src ? (
          <img 
            src={src} 
            alt={name || 'Avatar'} 
            className="w-full h-full object-cover"
            onError={(e) => {
              // Se a imagem falhar, esconde ela e mostra o fallback
              e.target.style.display = 'none';
            }}
          />
        ) : name ? (
          <span className={`font-bold text-[#D4AF37] ${sizeClasses[size].split(' ')[2]}`}>
            {initial}
          </span>
        ) : (
          <User size={iconSizes[size]} className="text-[#D4AF37]/60" />
        )}
      </div>
      
      {/* Badge Elite */}
      {showEliteBadge && isElite && (
        <div 
          className="absolute -bottom-1 -right-1 bg-gradient-to-r from-[#FFD700] via-[#D4AF37] to-[#B8860B] 
                     rounded-full p-1 ring-2 ring-black"
          title="Vendedor Elite"
        >
          <span className="text-[10px]">⭐</span>
        </div>
      )}
    </div>
  );
}
