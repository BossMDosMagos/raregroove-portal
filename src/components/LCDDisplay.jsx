import { useEffect, useRef } from 'react';

export function LCDDisplay({ title, artist, currentTrackTitle, isPlaying }) {
  const marqueeRef = useRef(null);

  return (
    <div 
      className="relative rounded-lg overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #D4AF37 0%, #B8962E 50%, #8B7500 100%)',
        boxShadow: `
          inset 0 2px 4px rgba(255,255,255,0.4),
          inset 0 -2px 4px rgba(0,0,0,0.3),
          0 4px 20px rgba(212,175,55,0.5)
        `,
        border: '2px solid #8B7500',
        fontFamily: '"Courier New", monospace',
      }}
    >
      <div 
        className="relative p-4"
        style={{
          background: 'linear-gradient(180deg, #C9A227 0%, #D4AF37 10%, #B8860B 90%, #8B6914 100%)',
        }}
      >
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              rgba(0,0,0,0.03) 2px,
              rgba(0,0,0,0.03) 4px
            )`,
          }}
        />

        <div className="relative z-10">
          <div 
            className="text-center"
            style={{
              color: '#1a1a1a',
              textShadow: '1px 1px 0 rgba(255,255,255,0.3)',
            }}
          >
            <h2 
              className="text-lg font-black uppercase tracking-wide truncate"
              style={{ fontFamily: '"Courier New", monospace', fontWeight: 900 }}
            >
              {title || 'SEM TÍTULO'}
            </h2>
            <p 
              className="text-sm font-bold mt-1 truncate"
              style={{ fontFamily: '"Courier New", monospace' }}
            >
              {artist || 'DESCONHECIDO'}
            </p>
          </div>

          <div 
            className="mt-3 pt-3 border-t border-black/20"
            style={{
              background: 'rgba(0,0,0,0.1)',
              borderRadius: '4px',
              padding: '8px 4px',
            }}
          >
            <div className="relative overflow-hidden h-6">
              <div 
                ref={marqueeRef}
                className="absolute whitespace-nowrap"
                style={{
                  color: '#1a1a1a',
                  fontFamily: '"Courier New", monospace',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  animation: isPlaying && currentTrackTitle ? 'marquee 8s linear infinite' : 'none',
                  textShadow: '1px 1px 0 rgba(255,255,255,0.2)',
                }}
              >
                {isPlaying && currentTrackTitle ? `🎵 ${currentTrackTitle} 🎵` : '🎵 PARADO 🎵'}
              </div>
            </div>
          </div>

          <style>{`
            @keyframes marquee {
              0% { transform: translateX(100%); }
              100% { transform: translateX(-100%); }
            }
          `}</style>
        </div>

        <div 
          className="absolute bottom-1 left-0 right-0 h-1 opacity-50"
          style={{
            background: 'linear-gradient(90deg, transparent, #FFD700, transparent)',
          }}
        />
      </div>
    </div>
  );
}