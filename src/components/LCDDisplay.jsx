import { useEffect, useState } from 'react';

const LCD_DISPLAY_FONT = '/fonts/5x7-dot-matrix.otf';

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

  const textStyle = {
    fontFamily: "'5x7DotMatrix', 'Courier New', monospace",
    color: '#1a1a1a',
    fontWeight: 'bold',
    textShadow: '1px 1px 0 rgba(255,255,255,0.3)',
  };

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

      <style>{`
        @font-face {
          font-family: '5x7DotMatrix';
          src: url('${LCD_DISPLAY_FONT}') format('opentype');
        }
      `}</style>

      <div 
        className="absolute flex flex-col items-center justify-center"
        style={{
          top: bounds.top + 'px',
          right: bounds.right + 'px',
          bottom: bounds.bottom + 'px',
          left: bounds.left + 'px',
        }}
      >
        {line1 && (
          <div className="text-center" style={{ ...textStyle, fontSize: '18px', marginBottom: '4px' }}>
            {line1}
          </div>
        )}
        {line2 && (
          <div className="text-center" style={{ ...textStyle, fontSize: '16px', opacity: 0.8 }}>
            {line2}
          </div>
        )}
        {line3 && (
          <div style={{ ...textStyle, fontSize: '12px', marginTop: '4px' }}>
            {line3}
          </div>
        )}
        {line4 && (
          <div style={{ ...textStyle, fontSize: '12px', marginTop: '2px' }}>
            {line4}
          </div>
        )}
      </div>

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