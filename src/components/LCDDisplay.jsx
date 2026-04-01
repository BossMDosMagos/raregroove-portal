import { useEffect, useRef, useState } from 'react';

export function LCDDisplay({ 
  line1 = '', 
  line2 = '', 
  line3 = '', 
  line4 = '',
  isPlaying = false 
}) {
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

  return (
    <div 
      className="relative rounded-lg overflow-hidden"
      style={{
        width: '600px',
        height: '150px',
      }}
    >
      <img 
        src="/images/painel/lcd.png"
        alt="LCD Panel"
        className="absolute inset-0 w-full h-full object-contain"
      />

      <div className="absolute inset-0 flex flex-col p-4">
        <div 
          className="flex items-center justify-between text-xs mb-1"
          style={{ 
            color: '#1a1a1a',
            fontFamily: '"Courier New", monospace',
            fontWeight: 'bold',
            letterSpacing: '1px',
            height: '14px',
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
          </div>
          <div className="flex items-center gap-2">
            <span style={{ opacity: 0.7 }}>◉</span>
            <span>{currentTime}</span>
          </div>
        </div>

        <div 
          className="flex-1 flex items-center overflow-hidden"
        >
          <div 
            className="absolute whitespace-nowrap"
            style={{
              color: '#1a1a1a',
              fontFamily: '"Courier New", monospace',
              fontWeight: 'bold',
              fontSize: '18px',
              letterSpacing: '2px',
              left: '24px',
              right: '24px',
            }}
          >
            {line1 || 'RARE GROOVE'}
          </div>
        </div>

        <div 
          className="flex items-center justify-between text-xs mt-1"
          style={{ 
            color: '#1a1a1a',
            fontFamily: '"Courier New", monospace',
            height: '14px',
          }}
        >
          <span>{line2}</span>
          <span>{line3}</span>
          <span>{line4}</span>
        </div>
      </div>
    </div>
  );
}