import React, { useState } from 'react';
import { Gem, ExternalLink } from 'lucide-react';

export default function BarcodeTag({ barcode, size = 'md' }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sem barcode - não mostra nada
  if (!barcode) {
    return null;
  }

  const handleCopy = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(barcode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy barcode:', err);
    }
  };

  const discogsSearchUrl = `https://www.discogs.com/search/?q=${encodeURIComponent(barcode)}&type=release`;

  return (
    <div className="relative inline-block">
      <a
        href={discogsSearchUrl}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={(e) => e.stopPropagation()}
        className={`
          group inline-flex items-center gap-1.5 px-2 py-1 
          bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 
          border border-blue-500/30 rounded-lg
          hover:border-blue-400/60
          hover:shadow-[0_0_15px_rgba(59,130,246,0.4)]
          hover:scale-110
          transition-all duration-300 ease-out
          ${size === 'sm' ? 'text-[8px]' : 'text-[10px]'}
          text-blue-400 font-medium
          cursor-pointer
        `}
      >
        <svg 
          className={`${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} text-cyan-400 group-hover:text-cyan-300 transition-colors`}
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
        >
          <path d="M3 5h2v14H3V5zm4 0h2v14H7V5zm4 0h2v14h-2V5zm4 0h2v14h-2V5zm4 0h2v14h-2V5z" />
        </svg>
        <span className="group-hover:text-blue-300 transition-colors">{barcode}</span>
        <ExternalLink className={`${size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} opacity-50 group-hover:opacity-100 transition-opacity`} />
      </a>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 animate-fade-in">
          <div className={`
            relative px-3 py-2 rounded-lg
            bg-gradient-to-b from-gray-900 to-black
            border border-blue-500/40
            shadow-[0_0_20px_rgba(59,130,246,0.3)]
            ${size === 'sm' ? 'text-[8px]' : 'text-[10px]'}
          `}>
            <div className="flex items-center gap-1.5 text-cyan-400 mb-1">
              <Gem className="w-3 h-3" />
              <span className="font-bold">Autenticidade Garantida</span>
            </div>
            <div className="text-white/70">Ver histórico oficial no Discogs</div>
            
            {/* Seta */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
              <div className="w-3 h-3 bg-black border-r border-b border-blue-500/40 rotate-45 transform -translate-y-1/2" />
            </div>
          </div>
        </div>
      )}

      {/* Copied feedback */}
      {copied && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-green-500/90 text-white text-[8px] rounded whitespace-nowrap animate-fade-in">
          Copiado!
        </div>
      )}
    </div>
  );
}
