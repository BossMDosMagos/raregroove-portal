import { useEffect, useState } from 'react';

export function LCDDisplay(props) {
  const { line1, line2, line3, line4, isPlaying, showBounds } = props;
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

  const bounds = { top: 10, right: 10, bottom: 10, left: 10 };

  return (
    <div 
      className="relative rounded-lg overflow-hidden"
      style={{
        width: '600px',
        height: '150px',
        position: 'relative',
      }}
    >
      <img 
        src="/images/painel/lcd.png"
        alt="LCD Panel"
        className="absolute inset-0 w-full h-full object-contain"
      />

      {showBounds && (
        <div 
          className="absolute pointer-events-none"
          style={{
            top: bounds.top + 'px',
            right: bounds.right + 'px',
            bottom: bounds.bottom + 'px',
            left: bounds.left + 'px',
            border: '1px solid red',
            borderRadius: '4px',
          }}
        />
      )}
    </div>
  );
}