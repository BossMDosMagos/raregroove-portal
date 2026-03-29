import { useRef, useCallback } from 'react';

export function VolumeKnob({ volume, onVolumeChange, size = 80 }) {
  const knobRef = useRef(null);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback((e) => {
    isDragging.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging.current) return;
    const rect = knobRef.current?.parentElement?.getBoundingClientRect();
    if (!rect) return;
    
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    let normalizedAngle = (angle * 180 / Math.PI + 90 + 360) % 360;
    
    if (normalizedAngle > 300) normalizedAngle = 0;
    else if (normalizedAngle < 240) normalizedAngle = 0;
    else {
      normalizedAngle = (normalizedAngle - 240) / 60;
      normalizedAngle = Math.max(0, Math.min(1, normalizedAngle));
    }
    
    onVolumeChange(normalizedAngle);
  }, [onVolumeChange]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const rotation = -135 + volume * 270;
  const dialStartAngle = 240;
  const dialEndAngle = 300;
  const dialAngle = dialStartAngle + volume * (dialEndAngle - dialStartAngle);

  const createArcPath = (startAngle, endAngle, radius, strokeWidth) => {
    const start = polarToCartesian(50, 50, radius, endAngle);
    const end = polarToCartesian(50, 50, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  };

  function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians)
    };
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className="cursor-pointer select-none"
        onMouseDown={handleMouseDown}
        style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }}
      >
        <defs>
          <radialGradient id="knobGoldGradient" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#F5E6C4" />
            <stop offset="30%" stopColor="#D4AF37" />
            <stop offset="60%" stopColor="#B8960C" />
            <stop offset="100%" stopColor="#8B7355" />
          </radialGradient>

          <radialGradient id="knobBrushedEffect" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="45%" stopColor="transparent" />
            <stop offset="46%" stopColor="rgba(255,255,255,0.3)" />
            <stop offset="47%" stopColor="transparent" />
            <stop offset="48%" stopColor="rgba(0,0,0,0.2)" />
            <stop offset="49%" stopColor="transparent" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.25)" />
            <stop offset="51%" stopColor="transparent" />
            <stop offset="52%" stopColor="rgba(0,0,0,0.15)" />
            <stop offset="53%" stopColor="transparent" />
            <stop offset="95%" stopColor="transparent" />
            <stop offset="96%" stopColor="rgba(255,255,255,0.15)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>

          <linearGradient id="knobEdgeMirror" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFEF0" />
            <stop offset="20%" stopColor="#D4AF37" />
            <stop offset="50%" stopColor="#FFFEF0" />
            <stop offset="80%" stopColor="#B8960C" />
            <stop offset="100%" stopColor="#FFFEF0" />
          </linearGradient>

          <radialGradient id="baseGradient" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#4a4a4a" />
            <stop offset="50%" stopColor="#2a2a2a" />
            <stop offset="100%" stopColor="#1a1a1a" />
          </radialGradient>

          <pattern id="brushedMetalPattern" patternUnits="userSpaceOnUse" width="4" height="4">
            <line x1="0" y1="0" x2="0" y2="4" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
          </pattern>
        </defs>

        <circle cx="50" cy="50" r="48" fill="url(#baseGradient)" />
        <circle cx="50" cy="50" r="47" fill="url(#brushedMetalPattern)" />
        <circle cx="50" cy="50" r="46" fill="none" stroke="#1a1a1a" strokeWidth="1" />

        <circle 
          cx="50" 
          cy="50" 
          r="38" 
          fill="url(#knobGoldGradient)" 
        />
        
        <circle 
          cx="50" 
          cy="50" 
          r="38" 
          fill="url(#knobBrushedEffect)" 
        />

        <circle 
          cx="50" 
          cy="50" 
          r="40" 
          fill="none" 
          stroke="url(#knobEdgeMirror)" 
          strokeWidth="3"
        />

        <circle 
          cx="50" 
          cy="50" 
          r="38" 
          fill="none" 
          stroke="rgba(0,0,0,0.3)" 
          strokeWidth="1"
        />

        <g transform={`rotate(${rotation}, 50, 50)`}>
          <circle cx="50" cy="22" r="6" fill="#0a0a0a" />
          <circle cx="50" cy="22" r="6" fill="none" stroke="#3a3a3a" strokeWidth="0.5" />
          <circle cx="50" cy="22" r="3" fill="#1a1a1a" />
        </g>

        <circle cx="50" cy="50" r="28" fill="none" stroke="#1a1a1a" strokeWidth="1" />

        <circle cx="50" cy="50" r="10" fill="#0a0a0a" />
        <circle cx="50" cy="50" r="9" fill="none" stroke="#2a2a2a" strokeWidth="0.5" />
        <circle cx="50" cy="50" r="5" fill="#1a1a1a" />

        <path
          d={createArcPath(dialStartAngle, dialEndAngle, 42, 2)}
          fill="none"
          stroke="#0a0a0a"
          strokeWidth="3"
          strokeLinecap="round"
        />

        <path
          d={createArcPath(dialStartAngle, dialAngle, 42, 3)}
          fill="none"
          stroke="#00FFFF"
          strokeWidth="2"
          strokeLinecap="round"
          style={{
            filter: 'drop-shadow(0 0 3px #00FFFF)'
          }}
        />

        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
      </svg>

      <span className="text-[10px] font-semibold text-black/70 tracking-wide">Volume</span>
    </div>
  );
}

export default VolumeKnob;
