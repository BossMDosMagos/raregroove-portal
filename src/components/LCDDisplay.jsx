import { useEffect, useRef, useState } from 'react';

export function LCDDisplay({ title, artist, currentTrackTitle, isPlaying, volume = 80 }) {
  const marqueeRef = useRef(null);
  const [currentTime, setCurrentTime] = useState('00:00');

  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        const now = new Date();
        setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (marqueeRef.current && isPlaying && currentTrackTitle) {
      const el = marqueeRef.current;
      el.style.animation = 'none';
      el.offsetHeight;
      el.style.animation = 'marquee 10s linear infinite';
    }
  }, [currentTrackTitle, isPlaying]);

  return (
    <div 
      className="relative rounded-lg overflow-hidden"
      style={{
        background: 'radial-gradient(circle at center, #f4d03f 0%, #c9a227 40%, #8B6914 100%)',
        boxShadow: `
          0 0 30px rgba(244, 208, 63, 0.6),
          0 0 60px rgba(244, 208, 63, 0.3),
          inset 0 0 20px rgba(0,0,0,0.4),
          inset 0 0 60px rgba(0,0,0,0.2)
        `,
        border: '4px solid #2a2a2a',
        fontFamily: '"Courier New", monospace',
      }}
    >
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }
      `}</style>

      <div 
        className="relative p-3"
        style={{
          background: 'linear-gradient(180deg, #f4d03f 0%, #e6b422 10%, #d4a420 90%, #b8860b 100%)',
          minHeight: '120px',
        }}
      >
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              rgba(0,0,0,0.08) 2px,
              rgba(0,0,0,0.08) 4px
            )`,
          }}
        />

        <div 
          className="absolute inset-0 opacity-30"
          style={{
            background: 'radial-gradient(circle at 50% 30%, rgba(255,255,255,0.4) 0%, transparent 50%)',
          }}
        />

        <div className="relative z-10 flex flex-col gap-2">
          <div 
            className="flex items-center justify-between text-xs"
            style={{ 
              color: 'rgba(0,0,0,0.75)',
              fontFamily: '"Courier New", monospace',
              fontWeight: 'bold',
              letterSpacing: '1px',
            }}
          >
            <div className="flex items-center gap-2">
              <span style={{ 
                animation: isPlaying ? 'pulse 1s ease-in-out infinite' : 'none',
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: isPlaying ? '#1a1a1a' : '#666'
              }} />
              <span>{isPlaying ? 'PLAYING' : 'PAUSED'}</span>
              <span style={{ opacity: 0.5 }}>|</span>
              <span>STEREO</span>
            </div>
            <div className="flex items-center gap-2">
              <span style={{ opacity: 0.7 }}>◉</span>
              <span>{currentTime}</span>
            </div>
          </div>

          <div 
            className="relative overflow-hidden h-10 flex items-center"
            style={{
              borderTop: '2px solid rgba(0,0,0,0.2)',
              borderBottom: '2px solid rgba(0,0,0,0.2)',
              background: 'rgba(0,0,0,0.05)',
            }}
          >
            <div 
              ref={marqueeRef}
              className="absolute whitespace-nowrap"
              style={{
                color: 'rgba(0,0,0,0.85)',
                fontFamily: '"Courier New", monospace',
                fontWeight: 'bold',
                fontSize: '18px',
                letterSpacing: '2px',
                textShadow: '1px 1px 0 rgba(255,255,255,0.3)',
                fontSmooth: 'always',
                WebkitFontSmoothing: 'none',
                animation: isPlaying && currentTrackTitle ? 'marquee 10s linear infinite' : 'none',
              }}
            >
              {currentTrackTitle ? `♪ ${currentTrackTitle} ♪ ` : title || 'RARE GROOVE'}
            </div>
          </div>

          <div 
            className="flex items-center justify-between text-xs pt-2"
            style={{ 
              color: 'rgba(0,0,0,0.7)',
              fontFamily: '"Courier New", monospace',
            }}
          >
            <div className="flex items-center gap-2">
              <span>VOL:</span>
              <div className="flex gap-1">
                {[...Array(10)].map((_, i) => (
                  <div 
                    key={i}
                    style={{
                      width: '4px',
                      height: '12px',
                      background: i < (volume / 10) ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.2)',
                    }}
                  />
                ))}
              </div>
              <span>{volume}%</span>
            </div>

            <div className="flex items-center gap-2">
              <span>EQ:</span>
              <span style={{ 
                background: 'rgba(0,0,0,0.1)',
                padding: '2px 6px',
                borderRadius: '2px',
              }}>VINYL</span>
            </div>

            <div className="flex items-center gap-1 h-4">
              {[...Array(8)].map((_, i) => (
                <div 
                  key={i}
                  style={{
                    width: '3px',
                    height: `${Math.random() * 100}%`,
                    background: 'rgba(0,0,0,0.6)',
                    transition: 'height 0.1s ease',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div 
          className="absolute bottom-1 left-2 right-2 h-1"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.3), transparent)',
          }}
        />
      </div>
    </div>
  );
}