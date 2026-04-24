import React, { useMemo } from 'react';

export const LCDDisplay = React.memo(function LCDDisplay({ line1, line2, line3, line4 }) {
  const bounds = { top: 5, right: 48, bottom: 10, left: 48 };

  const textStyle = useMemo(() => ({
    fontFamily: "'5x7DotMatrix', 'Courier New', monospace",
    color: '#1a1a1a',
    fontWeight: 'bold',
    textShadow: '1px 1px 0 rgba(255,255,255,0.3)',
  }), []);

  return (
    <div 
      className="relative rounded-lg overflow-hidden"
      style={{ width: '600px', height: '150px', position: 'relative' }}
    >
      <img 
        src="/images/painel/lcd.png"
        alt="LCD Panel"
        className="absolute inset-0 w-full h-full object-contain"
      />

      <div 
        className="absolute flex flex-col items-center justify-start"
        style={{
          top: `${bounds.top}px`,
          right: `${bounds.right}px`,
          bottom: `${bounds.bottom}px`,
          left: `${bounds.left}px`,
          paddingTop: '25px',
        }}
      >
        {line1 && (
          <div className="text-center" style={{ ...textStyle, fontSize: '16px', marginBottom: '4px' }}>
            {line1}
          </div>
        )}
        {line2 && (
          <div className="text-center" style={{ ...textStyle, fontSize: '14px', opacity: 0.8 }}>
            {line2}
          </div>
        )}
        {line3 && (
          <div className="relative w-full overflow-hidden h-6 flex items-center mt-2">
            <div 
              className="absolute whitespace-nowrap flex items-center"
              style={{ ...textStyle, fontSize: '12px', animation: 'marquee-left 12s linear infinite' }}
            >
              <span>{line3} &nbsp;&nbsp;•&nbsp;&nbsp; </span>
              <span>{line3} &nbsp;&nbsp;•&nbsp;&nbsp; </span>
              <span>{line3} &nbsp;&nbsp;•&nbsp;&nbsp; </span>
              <span>{line3} &nbsp;&nbsp;•&nbsp;&nbsp; </span>
            </div>
          </div>
        )}
        {line4 && (
          <div style={{ ...textStyle, fontSize: '12px', marginTop: '2px' }}>
            {line4}
          </div>
        )}
      </div>
    </div>
  );
});
