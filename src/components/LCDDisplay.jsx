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
        width: '320px',
        height: '160px',
      }}
    >
      <img 
        src="/images/painel/lcd.png"
        alt="LCD Panel"
        className="absolute inset-0 w-full h-full object-contain"
      />

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>

      <div className="absolute inset-0 flex flex-col p-4" style={{ padding: '16px 24px' }}>
        <div 
          className="flex items-center justify-between text-xs mb-2"
          style={{ 
            color: '#1a1a1a',
            fontFamily: '"Courier New", monospace',
            fontWeight: 'bold',
            letterSpacing: '1px',
            height: '16px',
          }}
        >
          <div className="flex items-center gap-2">
            <span style={{ 
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
          className="flex-1 flex items-center overflow-hidden"
          style={{ minHeight: '24px' }}
        >
          <div 
            ref={marqueeRef}
            className="absolute whitespace-nowrap"
            style={{
              color: '#1a1a1a',
              fontFamily: '"Courier New", monospace',
              fontWeight: 'bold',
              fontSize: '18px',
              letterSpacing: '2px',
              fontSmooth: 'always',
              WebkitFontSmoothing: 'none',
              textShadow: '1px 1px 0 rgba(255,255,255,0.3)',
              animation: isPlaying && currentTrackTitle ? 'marquee 10s linear infinite' : 'none',
              left: '24px',
              right: '24px',
            }}
          >
            {currentTrackTitle ? `♪ ${currentTrackTitle} ♪ ` : title || 'RARE GROOVE'}
          </div>
        </div>

        <div 
          className="flex items-center justify-between text-xs mt-2"
          style={{ 
            color: '#1a1a1a',
            fontFamily: '"Courier New", monospace',
            height: '16px',
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
                    height: '10px',
                    background: i < (volume / 10) ? '#1a1a1a' : 'rgba(0,0,0,0.2)',
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
    </div>
  );
}